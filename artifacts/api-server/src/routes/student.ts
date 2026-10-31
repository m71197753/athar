import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  achievementAttachmentsTable,
  achievementsTable,
  academyProgressTable,
  db,
  learningItemsTable,
  studentsTable,
} from "@workspace/db";
import {
  CreateAchievementBody,
  CreateAchievementResponse,
  CreateAchievementAttachmentBody,
  CreateAchievementAttachmentResponse,
  ConfirmAchievementAttachmentUploadParams,
  ConfirmAchievementAttachmentUploadResponse,
  DeleteAchievementAttachmentParams,
  DeleteAchievementAttachmentResponse,
  DeleteAchievementParams,
  DownloadAchievementAttachmentParams,
  GetDashboardSummaryResponse,
  GetStudentProfileResponse,
  ListAchievementAttachmentsParams,
  ListAchievementAttachmentsResponse,
  ListAchievementsQueryParams,
  ListAchievementsResponse,
  RequestAchievementAttachmentUploadBody,
  RequestAchievementAttachmentUploadParams,
  RequestAchievementAttachmentUploadResponse,
  SaveStudentProfileBody,
  SaveStudentProfileResponse,
  UpdateAchievementBody,
  UpdateAchievementParams,
  UpdateAchievementResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
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
import { ownsAchievement } from "../lib/achievement-access";

const router: IRouter = Router();
const categories = [
  "project",
  "internship",
  "volunteer",
  "competition",
  "course",
  "research",
  "other",
] as const;

function safeAttachmentName(name: string): string {
  return name
    .split(/[\\/]/)
    .at(-1)!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255) || "evidence";
}

function toAchievementAttachment(row: typeof achievementAttachmentsTable.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    content: row.content,
    url: row.url,
    originalName: row.originalName,
    mime: row.mime,
    size: row.size,
    status: row.status,
    downloadUrl: row.kind === "file" && row.status === "ready"
      ? `/api/achievements/${row.achievementId}/attachments/${row.id}/download`
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function streamAchievementVideo(
  res: Response,
  rangeHeader: string | undefined,
  path: string,
  name: string,
  mime: string,
  size: number,
): void {
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
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(safeAttachmentName(name))}`);
  res.setHeader("Content-Length", String(end - start + 1));
  if (status === 206) res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  streamAcademyAsset(path, { start, end })
    .on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "تعذّر فتح الملف." });
      else res.destroy();
    })
    .pipe(res);
}

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const [profileRows, achievementRows, learningRows, lessonProgressRows] = await Promise.all([
    db.select().from(studentsTable).where(eq(studentsTable.userId, userId)).limit(1),
    db
      .select()
      .from(achievementsTable)
      .where(eq(achievementsTable.userId, userId))
      .orderBy(desc(achievementsTable.achievedOn), desc(achievementsTable.createdAt)),
    db
      .select()
      .from(learningItemsTable)
      .where(eq(learningItemsTable.userId, userId)),
    db
      .select()
      .from(academyProgressTable)
      .where(eq(academyProgressTable.userId, userId)),
  ]);

  const profile = profileRows[0];
  const profileFields = profile
    ? [
        Boolean(profile.fullName.trim()),
        Boolean(profile.university.trim()),
        Boolean(profile.major.trim()),
        Boolean(profile.headline?.trim()),
        profile.skills.length > 0,
      ]
    : [];
  const profileCompletion = profile
    ? Math.round((profileFields.filter(Boolean).length / 5) * 100)
    : 0;
  const evidenceCompletion = Math.min(achievementRows.length, 5) * 20;
  const readinessScore = Math.round(profileCompletion * 0.65 + evidenceCompletion * 0.35);
  const month = new Date().toISOString().slice(0, 7);
  const completedCourses = learningRows.filter(
    (item) => item.kind === "course" && item.status === "completed",
  ).length;
  const completedLessons = lessonProgressRows.filter((item) => item.completed).length;
  const passedQuizzes = lessonProgressRows.filter(
    (item) => item.quizScore !== null && item.quizScore >= 70,
  ).length;
  const recentAchievements = achievementRows.slice(0, 4).map(toAchievement);
  const summary = {
    totalAchievements: achievementRows.length,
    achievementsThisMonth: achievementRows.filter((item) =>
      item.achievedOn.startsWith(month),
    ).length,
    profileCompletion,
    readinessScore,
    completedCourses,
    completedLessons,
    points:
      achievementRows.length * 15 +
      completedCourses * 30 +
      passedQuizzes * 20,
    recentAchievements,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/student/profile", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const [profile] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.userId, userId))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(GetStudentProfileResponse.parse(toProfile(profile)));
});

router.put("/student/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = SaveStudentProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [profile] = await db
    .insert(studentsTable)
    .values({
      userId,
      fullName: parsed.data.fullName.trim(),
      university: parsed.data.university.trim(),
      major: parsed.data.major.trim(),
      yearOfStudy: parsed.data.yearOfStudy ?? null,
      headline: parsed.data.headline?.trim() || null,
      skills: parsed.data.skills.map((skill) => skill.trim()).filter(Boolean),
    })
    .onConflictDoUpdate({
      target: studentsTable.userId,
      set: {
        fullName: parsed.data.fullName.trim(),
        university: parsed.data.university.trim(),
        major: parsed.data.major.trim(),
        yearOfStudy: parsed.data.yearOfStudy ?? null,
        headline: parsed.data.headline?.trim() || null,
        skills: parsed.data.skills.map((skill) => skill.trim()).filter(Boolean),
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(SaveStudentProfileResponse.parse(toProfile(profile)));
});

router.get("/achievements", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListAchievementsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const filters = [eq(achievementsTable.userId, userId)];
  if (parsed.data.category) {
    filters.push(eq(achievementsTable.category, parsed.data.category));
  }
  if (parsed.data.query?.trim()) {
    const term = `%${parsed.data.query.trim()}%`;
    const searchFilter = or(
      ilike(achievementsTable.title, term),
      ilike(achievementsTable.context, term),
      ilike(achievementsTable.action, term),
      ilike(achievementsTable.result, term),
    );
    if (searchFilter) filters.push(searchFilter);
  }

  const rows = await db
    .select()
    .from(achievementsTable)
    .where(and(...filters))
    .orderBy(desc(achievementsTable.achievedOn), desc(achievementsTable.createdAt));
  res.json(ListAchievementsResponse.parse(rows.map(toAchievement)));
});

router.post("/achievements", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateAchievementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [achievement] = await db
    .insert(achievementsTable)
    .values({
      ...parsed.data,
      achievedOn: toDateString(parsed.data.achievedOn),
      userId,
      challenge: parsed.data.challenge?.trim() || null,
      skills: parsed.data.skills.map((skill) => skill.trim()).filter(Boolean),
      resumeBullet: parsed.data.resumeBullet?.trim() || null,
      interviewStory: parsed.data.interviewStory?.trim() || null,
      serviceOffer: parsed.data.serviceOffer?.trim() || null,
      summary: parsed.data.summary?.trim() || null,
    })
    .returning();

  res.status(201).json(CreateAchievementResponse.parse(toAchievement(achievement)));
});

router.patch("/achievements/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateAchievementParams.safeParse(req.params);
  const parsed = UpdateAchievementBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const { achievedOn, ...fields } = parsed.data;
  const update: Partial<typeof achievementsTable.$inferInsert> & {
    updatedAt: Date;
  } = {
    ...fields,
    updatedAt: new Date(),
    ...(achievedOn ? { achievedOn: toDateString(achievedOn) } : {}),
  };
  if (parsed.data.skills) {
    update.skills = parsed.data.skills.map((skill) => skill.trim()).filter(Boolean);
  }
  if (parsed.data.challenge !== undefined) {
    update.challenge = parsed.data.challenge?.trim() || null;
  }
  if (parsed.data.resumeBullet !== undefined) {
    update.resumeBullet = parsed.data.resumeBullet?.trim() || null;
  }
  if (parsed.data.interviewStory !== undefined) {
    update.interviewStory = parsed.data.interviewStory?.trim() || null;
  }
  if (parsed.data.serviceOffer !== undefined) {
    update.serviceOffer = parsed.data.serviceOffer?.trim() || null;
  }
  if (parsed.data.summary !== undefined) {
    update.summary = parsed.data.summary?.trim() || null;
  }

  const [achievement] = await db
    .update(achievementsTable)
    .set(update)
    .where(
      and(
        eq(achievementsTable.id, params.data.id),
        eq(achievementsTable.userId, userId),
      ),
    )
    .returning();

  if (!achievement) {
    res.status(404).json({ error: "Achievement not found" });
    return;
  }

  res.json(UpdateAchievementResponse.parse(toAchievement(achievement)));
});

router.get("/achievements/:id/attachments", requireAuth, async (req, res): Promise<void> => {
  const params = ListAchievementAttachmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  if (!(await ownsAchievement(params.data.id, userId))) {
    res.status(404).json({ error: "Achievement not found" });
    return;
  }
  const rows = await db
    .select()
    .from(achievementAttachmentsTable)
    .where(eq(achievementAttachmentsTable.achievementId, params.data.id))
    .orderBy(desc(achievementAttachmentsTable.createdAt));
  res.json(ListAchievementAttachmentsResponse.parse(rows.map(toAchievementAttachment)));
});

router.post("/achievements/:id/attachments", requireAuth, async (req, res): Promise<void> => {
  const params = ListAchievementAttachmentsParams.safeParse(req.params);
  const parsed = CreateAchievementAttachmentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  if (!(await ownsAchievement(params.data.id, userId))) {
    res.status(404).json({ error: "Achievement not found" });
    return;
  }

  const title = parsed.data.title.trim();
  const content = parsed.data.content?.trim() || null;
  const url = parsed.data.url?.trim() || null;
  if (!title || (parsed.data.kind === "text" && !content)) {
    res.status(400).json({ error: "أضف عنواناً ومحتوى للنص." });
    return;
  }
  if (parsed.data.kind === "link") {
    try {
      const parsedUrl = new URL(url || "");
      if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
        res.status(400).json({ error: "أدخل رابطاً آمناً يبدأ بـ http أو https." });
        return;
      }
    } catch {
      res.status(400).json({ error: "أدخل رابطاً صحيحاً." });
      return;
    }
  }

  const [row] = await db
    .insert(achievementAttachmentsTable)
    .values({
      achievementId: params.data.id,
      kind: parsed.data.kind,
      title,
      content: parsed.data.kind === "text" ? content : null,
      url: parsed.data.kind === "link" ? url : null,
      status: "ready",
    })
    .returning();
  res.status(201).json(CreateAchievementAttachmentResponse.parse(toAchievementAttachment(row)));
});

router.post("/achievements/:id/attachments/uploads", requireAuth, async (req, res): Promise<void> => {
  const params = RequestAchievementAttachmentUploadParams.safeParse(req.params);
  const parsed = RequestAchievementAttachmentUploadBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  if (!(await ownsAchievement(params.data.id, userId))) {
    res.status(404).json({ error: "Achievement not found" });
    return;
  }

  const name = safeAttachmentName(parsed.data.name);
  const mime = parsed.data.mime.split(";")[0].trim().toLowerCase();
  if (
    !Number.isSafeInteger(parsed.data.size) ||
    parsed.data.size < 1 ||
    (!supportedAcademyFile(name, mime) && !supportedAcademyCourseUpload(name, mime))
  ) {
    res.status(400).json({ error: "الملف غير مدعوم. استخدم صورة أو فيديو MP4/WebM أو PDF أو DOCX أو TXT." });
    return;
  }

  const upload = await createAcademyUpload();
  const [attachment] = await db
    .insert(achievementAttachmentsTable)
    .values({
      achievementId: params.data.id,
      kind: "file",
      title: name,
      originalName: name,
      mime,
      size: parsed.data.size,
      objectPath: upload.objectPath,
      status: "uploading",
    })
    .returning({ id: achievementAttachmentsTable.id });
  res.status(201).json(
    RequestAchievementAttachmentUploadResponse.parse({
      id: attachment.id,
      uploadUrl: upload.uploadUrl,
    }),
  );
});

router.post(
  "/achievements/:id/attachments/:attachmentId/confirm",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ConfirmAchievementAttachmentUploadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = res.locals.userId as string;
    if (!(await ownsAchievement(params.data.id, userId))) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const [attachment] = await db
      .select()
      .from(achievementAttachmentsTable)
      .where(and(
        eq(achievementAttachmentsTable.id, params.data.attachmentId),
        eq(achievementAttachmentsTable.achievementId, params.data.id),
        eq(achievementAttachmentsTable.kind, "file"),
      ))
      .limit(1);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    if (attachment.status === "ready") {
      res.json(ConfirmAchievementAttachmentUploadResponse.parse(toAchievementAttachment(attachment)));
      return;
    }
    if (!attachment.objectPath || !attachment.mime || !attachment.size) {
      res.status(400).json({ error: "لم يكتمل رفع الملف." });
      return;
    }

    let confirmedPath: string | null = null;
    try {
      confirmedPath = await validateAcademyUpload(
        attachment.objectPath,
        attachment.mime as AcademyUploadMime,
        attachment.size,
        null,
      );
    } catch (error) {
      req.log.warn({ err: error, attachmentId: attachment.id }, "Could not verify achievement evidence upload");
    }
    if (!confirmedPath) {
      await deleteAcademyAsset(attachment.objectPath);
      await db.delete(achievementAttachmentsTable).where(eq(achievementAttachmentsTable.id, attachment.id));
      res.status(400).json({ error: "تعذّر التحقق من الملف. أعد رفعه بصيغة مدعومة." });
      return;
    }

    const [updated] = await db
      .update(achievementAttachmentsTable)
      .set({ objectPath: confirmedPath, status: "ready" })
      .where(eq(achievementAttachmentsTable.id, attachment.id))
      .returning();
    await deleteAcademyAsset(attachment.objectPath);
    res.json(ConfirmAchievementAttachmentUploadResponse.parse(toAchievementAttachment(updated)));
  },
);

router.get(
  "/achievements/:id/attachments/:attachmentId/download",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DownloadAchievementAttachmentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = res.locals.userId as string;
    if (!(await ownsAchievement(params.data.id, userId))) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    const [attachment] = await db
      .select()
      .from(achievementAttachmentsTable)
      .where(and(
        eq(achievementAttachmentsTable.id, params.data.attachmentId),
        eq(achievementAttachmentsTable.achievementId, params.data.id),
        eq(achievementAttachmentsTable.kind, "file"),
        eq(achievementAttachmentsTable.status, "ready"),
      ))
      .limit(1);
    if (!attachment?.objectPath || !attachment.mime || !attachment.originalName) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    if (isAcademyVideoMime(attachment.mime) && attachment.size) {
      streamAchievementVideo(
        res,
        req.header("range"),
        attachment.objectPath,
        attachment.originalName,
        attachment.mime,
        attachment.size,
      );
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", attachment.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    const disposition =
      isAcademyImageMime(attachment.mime) ||
      attachment.mime === "application/pdf" ||
      attachment.mime === "text/plain"
        ? "inline"
        : "attachment";
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename*=UTF-8''${encodeURIComponent(safeAttachmentName(attachment.originalName))}`,
    );
    if (attachment.size) res.setHeader("Content-Length", String(attachment.size));
    const stream = streamAcademyAsset(attachment.objectPath);
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "تعذّر فتح الملف." });
      else res.destroy();
    });
    stream.pipe(res);
  },
);

router.delete(
  "/achievements/:id/attachments/:attachmentId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DeleteAchievementAttachmentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = res.locals.userId as string;
    if (!(await ownsAchievement(params.data.id, userId))) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    const [attachment] = await db
      .select()
      .from(achievementAttachmentsTable)
      .where(and(
        eq(achievementAttachmentsTable.id, params.data.attachmentId),
        eq(achievementAttachmentsTable.achievementId, params.data.id),
      ))
      .limit(1);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    if (attachment.objectPath) await deleteAcademyAsset(attachment.objectPath);
    await db
      .delete(achievementAttachmentsTable)
      .where(eq(achievementAttachmentsTable.id, attachment.id));
    DeleteAchievementAttachmentResponse.parse(undefined);
    res.sendStatus(204);
  },
);

router.delete("/achievements/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteAchievementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  if (!(await ownsAchievement(params.data.id, userId))) {
    res.status(404).json({ error: "Achievement not found" });
    return;
  }
  const existingAttachments = await db
    .select({ objectPath: achievementAttachmentsTable.objectPath })
    .from(achievementAttachmentsTable)
    .where(eq(achievementAttachmentsTable.achievementId, params.data.id));
  for (const attachment of existingAttachments) {
    if (attachment.objectPath) await deleteAcademyAsset(attachment.objectPath);
  }
  const [achievement] = await db
    .delete(achievementsTable)
    .where(
      and(
        eq(achievementsTable.id, params.data.id),
        eq(achievementsTable.userId, userId),
      ),
    )
    .returning({ id: achievementsTable.id });
  if (!achievement) {
    res.status(404).json({ error: "Achievement not found" });
    return;
  }
  res.sendStatus(204);
});

function toProfile(profile: typeof studentsTable.$inferSelect) {
  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function toAchievement(achievement: typeof achievementsTable.$inferSelect) {
  return {
    id: achievement.id,
    title: achievement.title,
    category: categories.includes(achievement.category as (typeof categories)[number])
      ? achievement.category
      : "other",
    context: achievement.context,
    challenge: achievement.challenge,
    action: achievement.action,
    result: achievement.result,
    achievedOn: achievement.achievedOn,
    skills: achievement.skills,
    resumeBullet: achievement.resumeBullet,
    interviewStory: achievement.interviewStory,
    serviceOffer: achievement.serviceOffer,
    summary: achievement.summary,
    createdAt: achievement.createdAt.toISOString(),
    updatedAt: achievement.updatedAt.toISOString(),
  };
}

function toDateString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

export default router;
