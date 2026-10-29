import { createECDH, hkdfSync } from "node:crypto";
import webpush from "web-push";
import { and, eq, lte } from "drizzle-orm";
import { db, careerPlansTable, careerTasksTable } from "@workspace/db";
import { logger } from "./logger";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Domain-separated derivation keeps the VAPID identity stable across restarts
// and replicas without storing a second private key. Rotating SESSION_SECRET
// requires students to opt in again on their browsers.
export function pushKeys() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Push requires SESSION_SECRET of at least 32 characters");
  const key = Buffer.from(hkdfSync("sha256", secret, "athar-web-push", "vapid-p256-v1", 32));
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(key);
  return { publicKey: ecdh.getPublicKey().toString("base64url"), privateKey: key.toString("base64url") };
}

export function validPushEndpoint(endpoint: string): boolean {
  const url = new URL(endpoint);
  // Never let a user-supplied subscription turn the sender into an SSRF proxy.
  return url.protocol === "https:" && !url.username && !url.password && !url.port &&
    (url.hostname === "fcm.googleapis.com" ||
      url.hostname.endsWith(".push.services.mozilla.com") ||
      url.hostname === "web.push.apple.com" ||
      url.hostname.endsWith(".push.apple.com") ||
      url.hostname.endsWith(".notify.windows.com"));
}

export async function deliverRoadmapReminders(
  now = new Date(),
  send: typeof webpush.sendNotification = webpush.sendNotification,
) {
  const keys = pushKeys();
  // Process a bounded batch. Row locks serialize sending against opt-out,
  // snooze and task changes, and prevent duplicate sends from API replicas.
  for (let i = 0; i < 50; i++) {
    const processed = await db.transaction(async tx => {
      const [plan] = await tx.select().from(careerPlansTable)
        .where(and(eq(careerPlansTable.weeklyReminderEnabled, true),
          eq(careerPlansTable.reminderChannel, "push"), lte(careerPlansTable.nextReminderAt, now)))
        .limit(1).for("update", { skipLocked: true });
      if (!plan) return false;
      const [task] = plan.reminderTaskId ? await tx.select().from(careerTasksTable)
        .where(and(eq(careerTasksTable.id, plan.reminderTaskId), eq(careerTasksTable.userId, plan.userId)))
        .for("update", { skipLocked: true }) : [];
      // A locked task might be in the process of being completed/deleted.
      // Leave it for the next pass instead of sending using a stale snapshot.
      if (!task && plan.reminderTaskId) {
        const [exists] = await tx.select({ id: careerTasksTable.id }).from(careerTasksTable)
          .where(and(eq(careerTasksTable.id, plan.reminderTaskId), eq(careerTasksTable.userId, plan.userId)));
        if (exists) return false;
      }
      if (!task || task.status === "completed" || !plan.pushConsentAt || !plan.pushSubscription) {
        await tx.update(careerPlansTable).set({
          weeklyReminderEnabled: false, nextReminderAt: null,
          pushSubscription: null, pushConsentAt: null,
        }).where(eq(careerPlansTable.id, plan.id));
        return true;
      }
      const sub = plan.pushSubscription;
      try {
        await send(sub, JSON.stringify({
          // Do not put private task titles on a shared device's lock screen.
          title: "أثر — تذكيرك الأسبوعي",
          body: "حان وقت متابعة خطوتك المهنية. افتح خطتك للمتابعة.",
          url: `${sub.roadmapPath}#roadmap-task-${task.id}`,
          tag: "athar-roadmap",
        }), {
          vapidDetails: { ...keys, subject: sub.origin },
          TTL: 0, timeout: 10_000,
        });
        await tx.update(careerPlansTable).set({
          nextReminderAt: new Date(now.getTime() + WEEK_MS),
        }).where(eq(careerPlansTable.id, plan.id));
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await tx.update(careerPlansTable).set({
            reminderChannel: "in_app", pushSubscription: null, pushConsentAt: null,
          }).where(eq(careerPlansTable.id, plan.id));
        } else {
          // Retry next hour without losing the reminder or spinning on failure.
          await tx.update(careerPlansTable).set({
            nextReminderAt: new Date(now.getTime() + 60 * 60 * 1000),
          }).where(eq(careerPlansTable.id, plan.id));
        }
        // Provider errors contain subscription URLs/keys; never log the error.
        logger.warn({ status, expired: status === 404 || status === 410 }, "Roadmap push delivery failed");
      }
      return true;
    });
    if (!processed) break;
  }
}

export function startRoadmapReminderDelivery() {
  try { pushKeys(); } catch {
    logger.warn("External roadmap reminders unavailable: configure SESSION_SECRET (32+ characters)");
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await deliverRoadmapReminders(); }
    catch { logger.error("Roadmap reminder delivery pass failed"); }
    finally { running = false; }
  };
  void tick();
  setInterval(() => void tick(), 60_000).unref();
}
