import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool, careerPlansTable, careerTasksTable } from "@workspace/db";
import { deliverRoadmapReminders, pushKeys, validPushEndpoint, WEEK_MS } from "./roadmap-push";

// Use a historical clock so no real student reminder can be selected by tests.
const now = new Date("1900-01-01T00:00:00Z");
const past = new Date(now.getTime() - 1000);
const userIds: string[] = [];
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test-only",
  keys: { auth: "test", p256dh: "test" },
  origin: "https://athar.example",
  roadmapPath: "/roadmap",
};

async function fixture(overrides: Partial<typeof careerPlansTable.$inferInsert> = {}, status = "planned") {
  const userId = `reminder-test-${randomUUID()}`;
  userIds.push(userId);
  const [task] = await db.insert(careerTasksTable).values({ userId, title: "Private task", status }).returning();
  const [plan] = await db.insert(careerPlansTable).values({
    userId, targetRole: "Test", timeframeDays: 30, overview: "",
    weeklyReminderEnabled: true, reminderChannel: "push",
    reminderTaskId: task.id, nextReminderAt: past,
    pushConsentAt: past, pushSubscription: subscription,
    ...overrides,
  }).returning();
  return { plan, task };
}

after(async () => {
  for (const userId of userIds) {
    await db.delete(careerPlansTable).where(eq(careerPlansTable.userId, userId));
    await db.delete(careerTasksTable).where(eq(careerTasksTable.userId, userId));
  }
  await pool.end();
});

test("public VAPID identity is stable and endpoints cannot target arbitrary hosts", () => {
  assert.equal(pushKeys().publicKey, pushKeys().publicKey);
  assert.equal(Buffer.from(pushKeys().publicKey, "base64url").length, 65);
  assert.equal(validPushEndpoint(subscription.endpoint), true);
  assert.equal(validPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/123"), true);
  assert.equal(validPushEndpoint("https://web.push.apple.com/test"), true);
  for (const url of ["http://fcm.googleapis.com/test", "https://127.0.0.1/test",
    "https://fcm.googleapis.com.evil.example/test", "https://fcm.googleapis.com:444/test",
    "https://user:pass@fcm.googleapis.com/test"]) {
    assert.equal(validPushEndpoint(url), false);
  }
});

test("one weekly send links to the chosen task and never includes its private title", async () => {
  const { plan, task } = await fixture();
  let count = 0;
  const sender: Parameters<typeof deliverRoadmapReminders>[1] = async (_sub, payload, options) => {
    count++;
    const notification = JSON.parse(String(payload));
    assert.equal(notification.url, `/roadmap#roadmap-task-${task.id}`);
    assert.equal(String(payload).includes(task.title), false);
    assert.equal(options?.TTL, 0);
    return { statusCode: 201, body: "", headers: {} };
  };
  await deliverRoadmapReminders(now, sender);
  await deliverRoadmapReminders(now, sender);
  assert.equal(count, 1);
  const [saved] = await db.select().from(careerPlansTable).where(eq(careerPlansTable.id, plan.id));
  assert.equal(saved.nextReminderAt?.getTime(), now.getTime() + WEEK_MS);
});

test("disabled, completed, deleted, future and non-consenting reminders do not send", async () => {
  await fixture({ weeklyReminderEnabled: false });
  await fixture({}, "completed");
  const deleted = await fixture();
  await db.delete(careerTasksTable).where(eq(careerTasksTable.id, deleted.task.id));
  await fixture({ nextReminderAt: new Date(now.getTime() + WEEK_MS) });
  await fixture({ pushConsentAt: null });
  await fixture({ reminderChannel: "in_app" });
  await deliverRoadmapReminders(now, async () => { assert.fail("Unexpected external delivery"); });
});

test("expired subscriptions revert to in-app; temporary failures retry later", async () => {
  for (const statusCode of [410, 503]) {
    const { plan } = await fixture();
    await deliverRoadmapReminders(now, async () => { throw { statusCode }; });
    const [saved] = await db.select().from(careerPlansTable)
      .where(and(eq(careerPlansTable.id, plan.id), eq(careerPlansTable.userId, plan.userId)));
    if (statusCode === 410) {
      assert.equal(saved.reminderChannel, "in_app");
      assert.equal(saved.pushSubscription, null);
      assert.equal(saved.pushConsentAt, null);
    } else {
      assert.equal(saved.nextReminderAt?.getTime(), now.getTime() + 60 * 60 * 1000);
    }
  }
});
