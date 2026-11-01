import { clerkClient } from "@clerk/express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, membershipsTable, bootstrapGrantsTable, adminAuditTable, platformSettingsTable } from "@workspace/db";
import { ALL_MODULES, DEFAULT_APPEARANCE, DEFAULT_MODULE_SETTINGS, GetPlatformContentResponse } from "@workspace/api-zod";
import type { ModuleKey, ModuleSetting } from "@workspace/api-zod";

export { ALL_MODULES };

export async function enabledModules(): Promise<ModuleKey[]> {
  return (await platformModuleSettings()).filter(module => module.enabled).map(module => module.key);
}

export async function platformModuleSettings(): Promise<ModuleSetting[]> {
  const [settings] = await db.select({
    enabledModules: platformSettingsTable.enabledModules,
    moduleSettings: platformSettingsTable.moduleSettings,
  }).from(platformSettingsTable).where(eq(platformSettingsTable.key, "main"));
  const parsed = GetPlatformContentResponse.shape.moduleSettings.safeParse(settings?.moduleSettings);
  const keys = parsed.success ? new Set(parsed.data.map(module => module.key)) : new Set<ModuleKey>();
  if (parsed.success && keys.size === ALL_MODULES.length && ALL_MODULES.every(key => keys.has(key))) {
    const defaults = new Map(DEFAULT_MODULE_SETTINGS.map(module => [module.key, module]));
    return parsed.data.map(module => {
      const fallback = defaults.get(module.key)!;
      return {
        ...fallback,
        ...module,
        iconKey: module.iconKey ?? fallback.iconKey,
        accentKey: module.accentKey ?? fallback.accentKey,
        cardStyle: module.cardStyle ?? fallback.cardStyle,
        blocks: module.blocks ?? [],
      };
    });
  }
  const previouslyEnabled = new Set(
    (settings?.enabledModules ?? ALL_MODULES.filter(key => key !== "languages"))
      .filter((key): key is ModuleKey => ALL_MODULES.includes(key as ModuleKey)),
  );
  return DEFAULT_MODULE_SETTINGS.map(module => ({
    ...module,
    enabled: module.key === "languages" ? true
      : module.key === "graduates" && !keys.has("graduates") ? true
        : previouslyEnabled.has(module.key),
  }));
}

export async function platformAppearance() {
  const [settings] = await db.select({ appearance: platformSettingsTable.appearance })
    .from(platformSettingsTable).where(eq(platformSettingsTable.key, "main"));
  const parsed = GetPlatformContentResponse.shape.appearance.safeParse(settings?.appearance);
  if (!parsed.success) return DEFAULT_APPEARANCE;
  const legacyDefault = parsed.data.primaryColor.toUpperCase() === "#4F46E5" &&
    parsed.data.accentColor.toUpperCase() === "#6366F1" &&
    parsed.data.canvasColor.toUpperCase() === "#F8FAFC" &&
    parsed.data.surfaceColor.toUpperCase() === "#FFFFFF";
  return legacyDefault ? {
    ...DEFAULT_APPEARANCE,
    welcomeTitle: parsed.data.welcomeTitle,
    welcomeDescription: parsed.data.welcomeDescription,
  } : parsed.data;
}

export function configuredAdminEmails() {
  return [...new Set((process.env.ADMIN_BOOTSTRAP_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean))];
}

/** Owner-configured, verified identifiers only. Ledger prevents re-granting revoked roles. */
export async function bootstrapAdminUser(user: Awaited<ReturnType<typeof clerkClient.users.getUser>>) {
  const primary = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId);
  if (!primary || primary.verification?.status !== "verified") return false;
  const email = primary.emailAddress.toLowerCase();
  if (!configuredAdminEmails().includes(email)) return false;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(812604)`);
    const [done] = await tx.select().from(bootstrapGrantsTable).where(eq(bootstrapGrantsTable.email, email));
    if (done) return false;
    await tx.insert(membershipsTable).values({ userId: user.id, role: "admin", status: "active" })
      .onConflictDoUpdate({ target: membershipsTable.userId, set: { role: "admin", status: "active" } });
    await tx.insert(bootstrapGrantsTable).values({ email, userId: user.id });
    await tx.insert(adminAuditTable).values({ actorId: "system:bootstrap", action: "admin.bootstrap", target: user.id });
    return true;
  });
}

export async function seedConfiguredAdmins() {
  let granted = 0, pending = 0;
  for (const email of configuredAdminEmails()) {
    const [done] = await db.select().from(bootstrapGrantsTable).where(eq(bootstrapGrantsTable.email, email));
    if (done) continue;
    const { data } = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
    // Never create an account or mark an unverified address verified.
    const exact = data.filter(user => user.emailAddresses.some(address =>
      address.id === user.primaryEmailAddressId && address.emailAddress.toLowerCase() === email &&
      address.verification?.status === "verified"));
    if (exact.length === 1 && await bootstrapAdminUser(exact[0])) granted++;
    else pending++;
  }
  return { granted, pending };
}

export async function tryPendingBootstrap(userId: string) {
  const emails = configuredAdminEmails();
  if (!emails.length) return;
  const completed = await db.select({ email: bootstrapGrantsTable.email }).from(bootstrapGrantsTable)
    .where(inArray(bootstrapGrantsTable.email, emails));
  if (emails.every(email => completed.some(grant => grant.email === email))) return;
  await bootstrapAdminUser(await clerkClient.users.getUser(userId));
}

export function requestModule(path: string): ModuleKey | undefined {
  if (/^\/(achievements|ai\/achievement-draft)(\/|$)/.test(path)) return "achievements";
  if (/^\/learning-items(\/|$)/.test(path)) return "learning";
  if (/^\/(languages|language-learning)(\/|$)/.test(path)) return "languages";
  if (/^\/graduates(\/|$)/.test(path)) return "graduates";
  if (/^\/academy(\/|$)/.test(path)) return "academy";
  if (/^\/(career-plan|ai\/career-plan-suggestions)(\/|$)/.test(path)) return "roadmap";
  if (/^\/(resume|student\/resume-share)(\/|$)/.test(path)) return "resume";
  if (/^\/ai\/career-assistant(\/|$)/.test(path)) return "assistant";
  return undefined;
}

export async function isSuspended(userId: string) {
  const [member] = await db.select().from(membershipsTable).where(and(
    eq(membershipsTable.userId, userId), eq(membershipsTable.status, "suspended"),
  ));
  return Boolean(member);
}
