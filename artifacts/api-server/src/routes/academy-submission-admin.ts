import { Router, type IRouter, type Response } from "express";
import {
  DownloadAdminAcademyCourseSubmissionParams,
  ListAdminAcademyCourseSubmissionsResponse,
  ReviewAdminAcademyCourseSubmissionBody,
  ReviewAdminAcademyCourseSubmissionParams,
  ReviewAdminAcademyCourseSubmissionResponse,
} from "@workspace/api-zod";
import { academyCourseSubmissionsTable, db } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { deleteAcademyAsset, streamAcademyAsset } from "../lib/academy-storage";

const router: IRouter = Router();
router.use("/admin/academy/course-submissions", requireAuth, requireAdmin);

function noStore(res: Response) {
  res.set("Cache-Control", "private, no-store");
}

function safeFileName(name: string): string {
  return name.replace(/[^\p{L}\p{N}_. -]/gu, "_").slice(0, 180) || "course-file";
}

function submissionView(row: typeof academyCourseSubmissionsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sourceUrl: row.sourceUrl,
    originalName: row.originalName,
    mime: row.mime,
    size: row.size,
    status: row.status,
    reviewNote: row.reviewNote,
    ownerId: row.ownerId,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/admin/academy/course-submissions", async (_req, res): Promise<void> => {
  noStore(res);
  const items = await db.select().from(academyCourseSubmissionsTable)
    .orderBy(desc(academyCourseSubmissionsTable.createdAt));
  res.json(ListAdminAcademyCourseSubmissionsResponse.parse({ items: items.map(submissionView) }));
});

router.patch("/admin/academy/course-submissions/:submissionId/review", async (req, res): Promise<void> => {
  noStore(res);
  const params = ReviewAdminAcademyCourseSubmissionParams.safeParse(req.params);
  const parsed = ReviewAdminAcademyCourseSubmissionBody.safeParse(req.body);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const [row] = await db.select().from(academyCourseSubmissionsTable)
    .where(eq(academyCourseSubmissionsTable.id, params.data.submissionId)).limit(1);
  if (!row) return void res.status(404).json({ error: "Submission not found" });
  if (parsed.data.status === "approved" && row.status !== "pending" && row.status !== "approved") {
    return void res.status(400).json({ error: "Only completed submissions can be approved" });
  }
  const reviewerId = res.locals.userId as string;
  const status = parsed.data.status;
  const [updated] = await db.update(academyCourseSubmissionsTable).set({
    status,
    reviewNote: parsed.data.reviewNote?.trim() || null,
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
  }).where(eq(academyCourseSubmissionsTable.id, row.id)).returning();
  if (status === "rejected" && row.objectPath) await deleteAcademyAsset(row.objectPath);
  res.json(ReviewAdminAcademyCourseSubmissionResponse.parse(submissionView(updated)));
});

router.get("/admin/academy/course-submissions/:submissionId/download", async (req, res): Promise<void> => {
  noStore(res);
  const params = DownloadAdminAcademyCourseSubmissionParams.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  const [row] = await db.select().from(academyCourseSubmissionsTable)
    .where(eq(academyCourseSubmissionsTable.id, params.data.submissionId)).limit(1);
  if (!row?.objectPath || !row.mime || !row.originalName || row.status === "rejected") {
    return void res.status(404).json({ error: "Submission file not found" });
  }
  res.setHeader("Content-Type", row.mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(safeFileName(row.originalName))}`);
  const stream = streamAcademyAsset(row.objectPath);
  stream.on("error", () => {
    if (!res.headersSent) res.status(404).json({ error: "Submission file not found" });
    else res.destroy();
  });
  stream.pipe(res);
});

export default router;
