import { Router, type IRouter, type Request, type Response } from "express";
import {
  ConfirmAcademyCourseSubmissionUploadParams,
  ConfirmAcademyCourseSubmissionUploadResponse,
  ListApprovedAcademyCommunityCoursesResponse,
  ListMyAcademyCourseSubmissionsResponse,
  RequestAcademyCourseSubmissionUploadBody,
  RequestAcademyCourseSubmissionUploadResponse,
  SubmitAcademyCourseLinkBody,
  SubmitAcademyCourseLinkResponse,
} from "@workspace/api-zod";
import { academyCourseSubmissionsTable, adminNotificationsTable, db, membershipsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import {
  isAcademyVideoMime,
  supportedAcademyCourseUpload,
  type AcademyCourseUploadMime,
} from "../lib/academy-content";
import {
  createAcademyUpload,
  deleteAcademyAsset,
  streamAcademyAsset,
  validateAcademyUpload,
} from "../lib/academy-storage";

const router: IRouter = Router();

function noStore(res: Response) {
  res.set("Cache-Control", "private, no-store");
}

function userOf(res: Response): string {
  return res.locals.userId as string;
}

async function notifyActiveAdminsOfSubmission(req: Request, submissionId: string, title: string): Promise<void> {
  const admins = await db.select({ recipientId: membershipsTable.userId })
    .from(membershipsTable)
    .where(and(
      eq(membershipsTable.role, "admin"),
      eq(membershipsTable.status, "active"),
    ));
  if (!admins.length) return;
  await db.insert(adminNotificationsTable).values(admins.map(({ recipientId }) => ({
    recipientId,
    type: "academy_course_submission",
    title: "محتوى جديد للمراجعة",
    message: `أرسل أحد الأعضاء «${title}» لمراجعته واعتماده.`,
    targetId: submissionId,
  }))).onConflictDoNothing();
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
    createdAt: row.createdAt.toISOString(),
  };
}

function adminSubmissionView(row: typeof academyCourseSubmissionsTable.$inferSelect) {
  return {
    ...submissionView(row),
    ownerId: row.ownerId,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

router.get("/academy/course-submissions", requireAuth, async (_req, res): Promise<void> => {
  noStore(res);
  const items = await db.select().from(academyCourseSubmissionsTable)
    .where(eq(academyCourseSubmissionsTable.ownerId, userOf(res)))
    .orderBy(desc(academyCourseSubmissionsTable.createdAt));
  res.json(ListMyAcademyCourseSubmissionsResponse.parse({ items: items.map(submissionView) }));
});

router.post("/academy/course-submissions", requireAuth, async (req, res): Promise<void> => {
  noStore(res);
  const parsed = SubmitAcademyCourseLinkBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(parsed.data.sourceUrl);
  } catch {
    return void res.status(400).json({ error: "رابط المحتوى غير صالح." });
  }
  if (sourceUrl.protocol !== "https:" && sourceUrl.protocol !== "http:") {
    return void res.status(400).json({ error: "استخدم رابطًا يبدأ بـ HTTP أو HTTPS." });
  }
  const [row] = await db.insert(academyCourseSubmissionsTable).values({
    ownerId: userOf(res),
    title: parsed.data.title.trim(),
    description: parsed.data.description.trim(),
    sourceUrl: sourceUrl.toString(),
    status: "pending",
  }).returning();
  try {
    await notifyActiveAdminsOfSubmission(req, row.id, row.title);
  } catch (error) {
    req.log.error({ err: error, submissionId: row.id }, "Could not create admin notification for course submission");
  }
  res.status(201).json(SubmitAcademyCourseLinkResponse.parse(submissionView(row)));
});

router.post("/academy/course-submissions/upload-url", requireAuth, async (req, res): Promise<void> => {
  noStore(res);
  const parsed = RequestAcademyCourseSubmissionUploadBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const { originalName, mime, size, title, description } = parsed.data;
  if (!Number.isSafeInteger(size) || !supportedAcademyCourseUpload(originalName, mime)) {
    return void res.status(400).json({ error: "الصيغ المتاحة PDF وDOCX وTXT وMP4 وWebM ضمن حد الرفع." });
  }
  const upload = await createAcademyUpload();
  const [row] = await db.insert(academyCourseSubmissionsTable).values({
    ownerId: userOf(res),
    title: title.trim(),
    description: description.trim(),
    objectPath: upload.objectPath,
    originalName: safeFileName(originalName),
    mime,
    size,
    status: "uploading",
  }).returning();
  res.status(201).json(RequestAcademyCourseSubmissionUploadResponse.parse({
    id: row.id,
    uploadUrl: upload.uploadUrl,
  }));
});

router.post("/academy/course-submissions/:submissionId/confirm", requireAuth, async (req, res): Promise<void> => {
  noStore(res);
  const params = ConfirmAcademyCourseSubmissionUploadParams.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  const ownerId = userOf(res);
  const [row] = await db.select().from(academyCourseSubmissionsTable).where(and(
    eq(academyCourseSubmissionsTable.id, params.data.submissionId),
    eq(academyCourseSubmissionsTable.ownerId, ownerId),
  )).limit(1);
  if (!row) return void res.status(404).json({ error: "لم يتم العثور على المشاركة." });
  if (row.status === "pending" || row.status === "approved") {
    return void res.json(ConfirmAcademyCourseSubmissionUploadResponse.parse(submissionView(row)));
  }
  if (row.status !== "uploading" || !row.objectPath || !row.originalName || !row.mime || !row.size) {
    return void res.status(400).json({ error: "هذه المشاركة لا تنتظر رفع ملف." });
  }
  if (!supportedAcademyCourseUpload(row.originalName, row.mime)) {
    return void res.status(400).json({ error: "صيغة الملف غير مدعومة." });
  }
  const confirmedPath = await validateAcademyUpload(row.objectPath, row.mime as AcademyCourseUploadMime, row.size, null);
  if (!confirmedPath) return void res.status(400).json({ error: "تعذّر التحقق من الملف المرفوع." });
  const [updated] = await db.update(academyCourseSubmissionsTable).set({
    objectPath: confirmedPath,
    status: "pending",
  }).where(and(
    eq(academyCourseSubmissionsTable.id, row.id),
    eq(academyCourseSubmissionsTable.ownerId, ownerId),
    eq(academyCourseSubmissionsTable.status, "uploading"),
  )).returning();
  if (!updated) {
    await deleteAcademyAsset(confirmedPath);
    return void res.status(409).json({ error: "تغيّرت حالة المشاركة. حدّث الصفحة." });
  }
  try {
    await notifyActiveAdminsOfSubmission(req, updated.id, updated.title);
  } catch (error) {
    req.log.error({ err: error, submissionId: updated.id }, "Could not create admin notification for course submission");
  }
  res.json(ConfirmAcademyCourseSubmissionUploadResponse.parse(submissionView(updated)));
});

router.get("/academy/community-courses", requireAuth, async (_req, res): Promise<void> => {
  noStore(res);
  const items = await db.select().from(academyCourseSubmissionsTable).where(
    eq(academyCourseSubmissionsTable.status, "approved"),
  ).orderBy(desc(academyCourseSubmissionsTable.createdAt));
  res.json(ListApprovedAcademyCommunityCoursesResponse.parse({
    items: items.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      sourceUrl: row.sourceUrl,
      originalName: row.originalName,
      mime: row.mime,
      size: row.size,
      downloadUrl: row.objectPath ? `/api/academy/community-courses/${row.id}/download` : null,
      createdAt: row.createdAt.toISOString(),
    })),
  }));
});

router.get("/academy/community-courses/:submissionId/download", requireAuth, async (req, res): Promise<void> => {
  noStore(res);
  const params = ConfirmAcademyCourseSubmissionUploadParams.safeParse({ submissionId: req.params.submissionId });
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  const [row] = await db.select().from(academyCourseSubmissionsTable).where(and(
    eq(academyCourseSubmissionsTable.id, params.data.submissionId),
    eq(academyCourseSubmissionsTable.status, "approved"),
  )).limit(1);
  if (!row?.objectPath || !row.mime || !row.originalName) {
    return void res.status(404).json({ error: "الملف غير متاح." });
  }
  if (isAcademyVideoMime(row.mime) && row.size) {
    streamVideo(res, req.header("range"), row.objectPath, row.originalName, row.mime, row.size);
    return;
  }
  res.setHeader("Content-Type", row.mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(safeFileName(row.originalName))}`);
  const stream = streamAcademyAsset(row.objectPath);
  stream.on("error", () => {
    if (!res.headersSent) res.status(404).json({ error: "تعذّر فتح الملف." });
    else res.destroy();
  });
  stream.pipe(res);
});

function streamVideo(
  res: Response,
  rangeHeader: string | undefined,
  path: string,
  name: string,
  mime: string,
  size: number,
) {
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!match || (!match[1] && !match[2])) {
      res.setHeader("Content-Range", `bytes */${size}`);
      res.status(416).end();
      return;
    }
    if (!match[1]) {
      const suffix = Number(match[2]);
      if (!Number.isFinite(suffix) || suffix < 1) {
        res.setHeader("Content-Range", `bytes */${size}`);
        res.status(416).end();
        return;
      }
      start = Math.max(0, size - suffix);
    } else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), size - 1);
    }
    if (start >= size || end < start) {
      res.setHeader("Content-Range", `bytes */${size}`);
      res.status(416).end();
      return;
    }
    status = 206;
  }
  res.status(status);
  res.setHeader("Content-Type", mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(safeFileName(name))}`);
  res.setHeader("Content-Length", String(end - start + 1));
  if (status === 206) res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  streamAcademyAsset(path, { start, end })
    .on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "تعذّر فتح الملف." });
      else res.destroy();
    })
    .pipe(res);
}

export default router;
