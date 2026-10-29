import { Router, type IRouter, type Response } from "express";
import {
  ListGraduateItemsResponse,
  SubmitGraduateCommunityPostBody,
  SubmitGraduateCommunityPostResponse,
} from "@workspace/api-zod";
import { graduateItemsTable, db } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function noStore(res: Response) {
  res.set("Cache-Control", "private, no-store");
}

function graduateItemView(row: typeof graduateItemsTable.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    body: row.body,
    actionLabel: row.actionLabel,
    actionUrl: row.actionUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/graduates/items", requireAuth, async (_req, res): Promise<void> => {
  noStore(res);
  const items = await db.select().from(graduateItemsTable)
    .where(eq(graduateItemsTable.status, "published"))
    .orderBy(asc(graduateItemsTable.kind), asc(graduateItemsTable.createdAt));
  res.json(ListGraduateItemsResponse.parse({ items: items.map(graduateItemView) }));
});

router.post("/graduates/community", requireAuth, async (req, res): Promise<void> => {
  noStore(res);
  const parsed = SubmitGraduateCommunityPostBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const actionUrl = parsed.data.actionUrl?.trim() || null;
  if (actionUrl) {
    let url: URL;
    try {
      url = new URL(actionUrl);
    } catch {
      return void res.status(400).json({ error: "رابط المشاركة غير صالح." });
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return void res.status(400).json({ error: "استخدم رابطًا يبدأ بـ HTTP أو HTTPS." });
    }
  }
  const [row] = await db.insert(graduateItemsTable).values({
    kind: "community",
    title: parsed.data.title.trim(),
    summary: parsed.data.summary.trim(),
    body: parsed.data.body.trim(),
    actionLabel: actionUrl ? parsed.data.actionLabel?.trim() || "فتح المحتوى" : null,
    actionUrl,
    ownerId: res.locals.userId as string,
    status: "pending",
  }).returning();
  res.status(201).json(SubmitGraduateCommunityPostResponse.parse({
    id: row.id,
    status: row.status,
  }));
});

export default router;
