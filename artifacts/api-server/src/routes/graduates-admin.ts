import { Router, type IRouter, type Response } from "express";
import {
  CreateAdminGraduateItemBody,
  CreateAdminGraduateItemResponse,
  DeleteAdminGraduateItemParams,
  DeleteAdminGraduateItemResponse,
  ListAdminGraduateItemsResponse,
  ReviewAdminGraduateItemBody,
  ReviewAdminGraduateItemParams,
  ReviewAdminGraduateItemResponse,
} from "@workspace/api-zod";
import { graduateItemsTable, db } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use("/admin/graduates", requireAuth, requireAdmin);

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
    ownerId: row.ownerId,
    status: row.status,
    reviewNote: row.reviewNote,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

async function safeUrl(value: string | null | undefined): Promise<string | null> {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

router.get("/admin/graduates/items", async (_req, res): Promise<void> => {
  noStore(res);
  const items = await db.select().from(graduateItemsTable)
    .orderBy(desc(graduateItemsTable.createdAt));
  res.json(ListAdminGraduateItemsResponse.parse({ items: items.map(graduateItemView) }));
});

router.post("/admin/graduates/items", async (req, res): Promise<void> => {
  noStore(res);
  const parsed = CreateAdminGraduateItemBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const actionUrl = await safeUrl(parsed.data.actionUrl);
  if (parsed.data.actionUrl && !actionUrl) {
    return void res.status(400).json({ error: "رابط الإجراء غير صالح." });
  }
  const now = new Date();
  const [row] = await db.insert(graduateItemsTable).values({
    kind: parsed.data.kind,
    title: parsed.data.title.trim(),
    summary: parsed.data.summary.trim(),
    body: parsed.data.body.trim(),
    actionLabel: actionUrl ? parsed.data.actionLabel?.trim() || "فتح المحتوى" : null,
    actionUrl,
    ownerId: res.locals.userId as string,
    status: "published",
    reviewedBy: res.locals.userId as string,
    reviewedAt: now,
  }).returning();
  res.status(201).json(CreateAdminGraduateItemResponse.parse(graduateItemView(row)));
});

router.patch("/admin/graduates/items/:itemId", async (req, res): Promise<void> => {
  noStore(res);
  const params = ReviewAdminGraduateItemParams.safeParse(req.params);
  const parsed = ReviewAdminGraduateItemBody.safeParse(req.body);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const [existing] = await db.select().from(graduateItemsTable)
    .where(eq(graduateItemsTable.id, params.data.itemId)).limit(1);
  if (!existing) return void res.status(404).json({ error: "Graduate item not found" });
  if (Object.keys(parsed.data).length === 0) {
    return void res.status(400).json({ error: "Provide at least one update." });
  }
  const actionUrl = parsed.data.actionUrl === undefined
    ? existing.actionUrl
    : await safeUrl(parsed.data.actionUrl);
  if (parsed.data.actionUrl && !actionUrl) {
    return void res.status(400).json({ error: "رابط الإجراء غير صالح." });
  }
  const reviewerId = res.locals.userId as string;
  const [updated] = await db.update(graduateItemsTable).set({
    ...(parsed.data.title === undefined ? {} : { title: parsed.data.title.trim() }),
    ...(parsed.data.summary === undefined ? {} : { summary: parsed.data.summary.trim() }),
    ...(parsed.data.body === undefined ? {} : { body: parsed.data.body.trim() }),
    ...(parsed.data.actionUrl === undefined && parsed.data.actionLabel === undefined ? {} : {
      actionUrl,
      actionLabel: actionUrl ? parsed.data.actionLabel?.trim() || existing.actionLabel || "فتح المحتوى" : null,
    }),
    ...(parsed.data.status === undefined ? {} : {
      status: parsed.data.status,
      reviewNote: parsed.data.reviewNote?.trim() || null,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    }),
  }).where(eq(graduateItemsTable.id, existing.id)).returning();
  res.json(ReviewAdminGraduateItemResponse.parse(graduateItemView(updated)));
});

router.delete("/admin/graduates/items/:itemId", async (req, res): Promise<void> => {
  noStore(res);
  const params = DeleteAdminGraduateItemParams.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  const [deleted] = await db.delete(graduateItemsTable)
    .where(eq(graduateItemsTable.id, params.data.itemId)).returning({ id: graduateItemsTable.id });
  if (!deleted) return void res.status(404).json({ error: "Graduate item not found" });
  DeleteAdminGraduateItemResponse.parse(undefined);
  res.status(204).end();
});

export default router;
