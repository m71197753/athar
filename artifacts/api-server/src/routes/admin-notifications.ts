import { Router, type IRouter, type Response } from "express";
import {
  ListAdminNotificationsResponse,
  MarkAllAdminNotificationsReadResponse,
  MarkAdminNotificationReadParams,
  MarkAdminNotificationReadResponse,
} from "@workspace/api-zod";
import { adminNotificationsTable, db } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use("/admin/notifications", requireAuth, requireAdmin);

function noStore(res: Response) {
  res.set("Cache-Control", "private, no-store");
}

function userOf(res: Response): string {
  return res.locals.userId as string;
}

function notificationView(row: typeof adminNotificationsTable.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    targetId: row.targetId,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}

router.get("/admin/notifications", async (_req, res): Promise<void> => {
  noStore(res);
  const recipientId = userOf(res);
  const [rows, unreadCount] = await Promise.all([
    db.select().from(adminNotificationsTable)
      .where(eq(adminNotificationsTable.recipientId, recipientId))
      .orderBy(desc(adminNotificationsTable.createdAt))
      .limit(50),
    db.$count(adminNotificationsTable, and(
      eq(adminNotificationsTable.recipientId, recipientId),
      isNull(adminNotificationsTable.readAt),
    )),
  ]);
  res.json(ListAdminNotificationsResponse.parse({
    items: rows.map(notificationView),
    unreadCount,
  }));
});

router.patch("/admin/notifications/read-all", async (_req, res): Promise<void> => {
  noStore(res);
  const updated = await db.update(adminNotificationsTable)
    .set({ readAt: new Date() })
    .where(and(
      eq(adminNotificationsTable.recipientId, userOf(res)),
      isNull(adminNotificationsTable.readAt),
    ))
    .returning({ id: adminNotificationsTable.id });
  res.json(MarkAllAdminNotificationsReadResponse.parse({ updated: updated.length }));
});

router.patch("/admin/notifications/:notificationId/read", async (req, res): Promise<void> => {
  noStore(res);
  const params = MarkAdminNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [updated] = await db.update(adminNotificationsTable)
    .set({ readAt: new Date() })
    .where(and(
      eq(adminNotificationsTable.id, params.data.notificationId),
      eq(adminNotificationsTable.recipientId, userOf(res)),
    ))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(MarkAdminNotificationReadResponse.parse(notificationView(updated)));
});

export default router;
