import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { db, membershipsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { bootstrapAdminUser, configuredAdminEmails, enabledModules, requestModule, tryPendingBootstrap } from "../lib/platform-access";

export const requireAuth: RequestHandler = async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    let [member] = await db.select().from(membershipsTable).where(eq(membershipsTable.userId, userId));
    const existed = Boolean(member);
    if (!member) {
      if (configuredAdminEmails().length) await bootstrapAdminUser(await clerkClient.users.getUser(userId));
      await db.insert(membershipsTable).values({ userId }).onConflictDoNothing();
      [member] = await db.select().from(membershipsTable).where(eq(membershipsTable.userId, userId));
    }
    if (member.status === "suspended") {
      res.status(403).json({ error: "Your account is suspended. Contact the platform administrator.", code: "ACCOUNT_SUSPENDED" });
      return;
    }
    // A pending owner may have verified their email after first signing up.
    if (existed && req.path === "/access" && member.role !== "admin") {
      await tryPendingBootstrap(userId);
      [member] = await db.select().from(membershipsTable).where(eq(membershipsTable.userId, userId));
    }
    res.locals.userId = userId;
    res.locals.role = member.role;
    const module = requestModule(req.path);
    if (module && member.role !== "admin" && !(await enabledModules()).includes(module)) {
      res.status(403).json({ error: "This section is temporarily unavailable.", code: "MODULE_DISABLED" });
      return;
    }
    next();
  } catch (error) { next(error); }
};
