import { Router, type IRouter, type Response } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import {
  db,
  adminAuditTable,
  moduleStudentSubmissionsTable,
} from "@workspace/db";
import {
  ConfirmModuleSubmissionUploadParams,
  ConfirmModuleSubmissionUploadResponse,
  DeleteModuleSubmissionParams,
  DownloadAdminModuleSubmissionParams,
  DownloadModuleSubmissionParams,
  ListAdminModuleSubmissionsQueryParams,
  ListAdminModuleSubmissionsResponse,
  ListModuleSubmissionsParams,
  ListModuleSubmissionsResponse,
  RequestModuleSubmissionUploadBody,
  RequestModuleSubmissionUploadParams,
  RequestModuleSubmissionUploadResponse,
  ReviewAdminModuleSubmissionBody,
  ReviewAdminModuleSubmissionParams,
  ReviewAdminModuleSubmissionResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  isAcademyImageMime,
  isAcademyVideoMime,
  supportedAcademyCourseUpload,
  supportedAcademyFile,
  type AcademyUploadMime,
} from "../lib/academy-content";
import {
  createAcademyUpload,
  deleteAcademyAsset,
  streamAcademyAsset,
  validateAcademyUpload,
} from "../lib/academy-storage";
import { platformModuleSettings } from "../lib/platform-access";

const router: IRouter = Router();
const ADMIN_PAGE_SIZE = 20;
const STUDENT_LIST_LIMIT = 100;

function safeFileName(name: string): string {
  return name
    .split(/[\\/]/)
    .at(-1)!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255) || "student-file";
}

function submissionView(row: typeof moduleStudentSubmissionsTable.$inferSelect) {
  return {
    id: row.id,
    moduleKey: row.moduleKey,
    title: row.title,
    note: row.note,
    originalName: row.originalName,
    mime: row.mime,
    size: row.size,
    status: row.status,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    downloadUrl: row.status === "uploading"
      ? null
      : `/api/modules/${encodeURIComponent(row.moduleKey)}/submissions/${row.id}/download`,
    createdAt: row.createdAt.toISOString(),
  };
}

function streamSubmission(
  res: Response,
  rangeHeader: string | undefined,
  row: typeof moduleStudentSubmissionsTable.$inferSelect,
): void {
  const size = row.size;
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
      if (!Number.isSafeInteger(suffix) || suffix < 1) {
        res.setHeader("Content-Range", `bytes */${size}`);
        res.status(416).end();
        return;
      }
      start = Math.max(0, size - suffix);
    } else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), size - 1);
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
      res.setHeader("Content-Range", `bytes */${size}`);
      res.status(416).end();
      return;
    }
    status = 206;
  }

  res.status(status);
  res.setHeader("Content-Type", row.mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(safeFileName(row.originalName))}`,
  );
  res.setHeader("Content-Length", String(end - start + 1));
  if (status === 206) res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  streamAcademyAsset(row.objectPath, { start, end })
    .on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "تعذّر فتح الملف." });
      else res.destroy();
    })
    .pipe(res);
}

async function enabledModule(moduleKey: string): Promise<boolean> {
  const settings = await platformModuleSettings();
  return settings.some((item) => item.key === moduleKey && item.enabled);
}

router.get("/modules/:moduleKey/submissions", requireAuth, async (req, res): Promise<void> => {
  const params = ListModuleSubmissionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "القسم غير صالح." });
    return;
  }
  const rows = await db.select().from(moduleStudentSubmissionsTable).where(and(
    eq(moduleStudentSubmissionsTable.ownerId, res.locals.userId),
    eq(moduleStudentSubmissionsTable.moduleKey, params.data.moduleKey),
  )).orderBy(desc(moduleStudentSubmissionsTable.createdAt)).limit(STUDENT_LIST_LIMIT);
  res.json(ListModuleSubmissionsResponse.parse({ items: rows.map(submissionView) }));
});

router.post("/modules/:moduleKey/submissions/uploads", requireAuth, async (req, res): Promise<void> => {
  const params = RequestModuleSubmissionUploadParams.safeParse(req.params);
  const body = RequestModuleSubmissionUploadBody.strict().safeParse(req.body);
  if (!params.success || !body.success || !Number.isSafeInteger(body.data.size)) {
    res.status(400).json({ error: "راجع بيانات الملف وحاول مرة أخرى." });
    return;
  }
  const originalName = safeFileName(body.data.originalName);
  const mime = body.data.mime;
  if (
    (!supportedAcademyFile(originalName, mime) && !supportedAcademyCourseUpload(originalName, mime)) ||
    !(isAcademyImageMime(mime) || isAcademyVideoMime(mime) ||
      mime === "application/pdf" ||
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "text/plain")
  ) {
    res.status(400).json({ error: "نوع الملف غير مدعوم." });
    return;
  }
  if (!await enabledModule(params.data.moduleKey)) {
    res.status(403).json({ error: "هذا القسم غير متاح للرفع الآن." });
    return;
  }

  const { objectPath, uploadUrl } = await createAcademyUpload();
  const [row] = await db.insert(moduleStudentSubmissionsTable).values({
    ownerId: res.locals.userId,
    moduleKey: params.data.moduleKey,
    title: body.data.title.trim(),
    note: body.data.note?.trim() || null,
    originalName,
    mime,
    size: body.data.size,
    objectPath,
    status: "uploading",
  }).returning();
  res.status(201).json(RequestModuleSubmissionUploadResponse.parse({ id: row.id, uploadUrl }));
});

router.post("/modules/:moduleKey/submissions/:submissionId/confirm", requireAuth, async (req, res): Promise<void> => {
  const params = ConfirmModuleSubmissionUploadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "بيانات الرفع غير صالحة." });
    return;
  }
  const [row] = await db.select().from(moduleStudentSubmissionsTable).where(and(
    eq(moduleStudentSubmissionsTable.id, params.data.submissionId),
    eq(moduleStudentSubmissionsTable.ownerId, res.locals.userId),
    eq(moduleStudentSubmissionsTable.moduleKey, params.data.moduleKey),
    eq(moduleStudentSubmissionsTable.status, "uploading"),
  )).limit(1);
  if (!row) {
    res.status(404).json({ error: "الملف غير موجود أو اكتمل رفعه بالفعل." });
    return;
  }
  const confirmedPath = await validateAcademyUpload(
    row.objectPath,
    row.mime as AcademyUploadMime,
    row.size,
    null,
  );
  if (!confirmedPath) {
    await deleteAcademyAsset(row.objectPath);
    await db.delete(moduleStudentSubmissionsTable).where(eq(moduleStudentSubmissionsTable.id, row.id));
    res.status(400).json({ error: "لم يطابق الملف النوع المعلن أو لم يكتمل رفعه." });
    return;
  }
  const [updated] = await db.update(moduleStudentSubmissionsTable)
    .set({ objectPath: confirmedPath, status: "pending" })
    .where(and(
      eq(moduleStudentSubmissionsTable.id, row.id),
      eq(moduleStudentSubmissionsTable.ownerId, res.locals.userId),
      eq(moduleStudentSubmissionsTable.status, "uploading"),
    ))
    .returning();
  res.json(ConfirmModuleSubmissionUploadResponse.parse(submissionView(updated)));
});

router.delete("/modules/:moduleKey/submissions/:submissionId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteModuleSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "بيانات الملف غير صالحة." });
    return;
  }
  const [row] = await db.select().from(moduleStudentSubmissionsTable).where(and(
    eq(moduleStudentSubmissionsTable.id, params.data.submissionId),
    eq(moduleStudentSubmissionsTable.ownerId, res.locals.userId),
    eq(moduleStudentSubmissionsTable.moduleKey, params.data.moduleKey),
  )).limit(1);
  if (!row) {
    res.status(404).end();
    return;
  }
  await db.delete(moduleStudentSubmissionsTable).where(eq(moduleStudentSubmissionsTable.id, row.id));
  await deleteAcademyAsset(row.objectPath);
  res.status(204).end();
});

router.get("/modules/:moduleKey/submissions/:submissionId/download", requireAuth, async (req, res): Promise<void> => {
  const params = DownloadModuleSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).end();
    return;
  }
  const [row] = await db.select().from(moduleStudentSubmissionsTable).where(and(
    eq(moduleStudentSubmissionsTable.id, params.data.submissionId),
    eq(moduleStudentSubmissionsTable.ownerId, res.locals.userId),
    eq(moduleStudentSubmissionsTable.moduleKey, params.data.moduleKey),
  )).limit(1);
  if (!row || row.status === "uploading") {
    res.status(404).end();
    return;
  }
  streamSubmission(res, req.header("range"), row);
});

router.get("/admin/module-submissions", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const query = ListAdminModuleSubmissionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "خيارات التصفية غير صالحة." });
    return;
  }
  const status = query.data.status ?? "pending";
  const page = query.data.page;
  const where = eq(moduleStudentSubmissionsTable.status, status);
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(moduleStudentSubmissionsTable).where(where)
      .orderBy(desc(moduleStudentSubmissionsTable.createdAt))
      .limit(ADMIN_PAGE_SIZE).offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: count() }).from(moduleStudentSubmissionsTable).where(where),
  ]);
  const items = rows.map((row) => ({
    ...submissionView(row),
    ownerId: row.ownerId,
    reviewedBy: row.reviewedBy,
    downloadUrl: row.status === "uploading"
      ? null
      : `/api/admin/module-submissions/${row.id}/download`,
  }));
  res.json(ListAdminModuleSubmissionsResponse.parse({
    items,
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  }));
});

router.patch("/admin/module-submissions/:submissionId/review", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = ReviewAdminModuleSubmissionParams.safeParse(req.params);
  const body = ReviewAdminModuleSubmissionBody.strict().safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "حالة المراجعة غير صالحة." });
    return;
  }
  const [updated] = await db.update(moduleStudentSubmissionsTable).set({
    status: body.data.status,
    reviewNote: body.data.reviewNote?.trim() || null,
    reviewedBy: res.locals.userId,
    reviewedAt: new Date(),
  }).where(and(
    eq(moduleStudentSubmissionsTable.id, params.data.submissionId),
    eq(moduleStudentSubmissionsTable.status, "pending"),
  )).returning();
  if (!updated) {
    res.status(404).json({ error: "الملف غير موجود أو تمت مراجعته." });
    return;
  }
  await db.insert(adminAuditTable).values({
    actorId: res.locals.userId,
    action: `module-submission.${body.data.status}`,
    target: updated.id,
  });
  res.json(ReviewAdminModuleSubmissionResponse.parse({
    ...submissionView(updated),
    ownerId: updated.ownerId,
    reviewedBy: updated.reviewedBy,
    downloadUrl: `/api/admin/module-submissions/${updated.id}/download`,
  }));
});

router.get("/admin/module-submissions/:submissionId/download", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = DownloadAdminModuleSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).end();
    return;
  }
  const [row] = await db.select().from(moduleStudentSubmissionsTable)
    .where(eq(moduleStudentSubmissionsTable.id, params.data.submissionId)).limit(1);
  if (!row || row.status === "uploading") {
    res.status(404).end();
    return;
  }
  streamSubmission(res, req.header("range"), row);
});

export default router;
