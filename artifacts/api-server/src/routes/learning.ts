import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  academyProgressTable,
  db,
  learningItemsTable,
  platformSectionsTable,
  platformSettingsTable,
  platformMediaAssetsTable,
  sectionMediaProgressTable,
} from "@workspace/db";
import {
  CompletePlatformSectionCourseParams,
  CompletePlatformSectionCourseResponse,
  CreateLearningItemBody,
  CreateLearningItemResponse,
  DeleteLearningItemParams,
  GetAcademyProgressResponse,
  GetSectionMediaProgressParams,
  GetSectionMediaProgressResponse,
  ListLearningItemsQueryParams,
  ListLearningItemsResponse,
  SaveSectionMediaProgressBody,
  SaveSectionMediaProgressParams,
  SaveSectionMediaProgressResponse,
  SaveAcademyProgressBody,
  SaveAcademyProgressParams,
  SaveAcademyProgressResponse,
  UpdateLearningItemBody,
  UpdateLearningItemParams,
  UpdateLearningItemResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { enabledModules } from "../lib/platform-access";

const router: IRouter = Router();
const learningKinds = ["course", "lecture"] as const;
const learningStatuses = ["planned", "in_progress", "completed"] as const;
const sectionMediaUrl = (id: string) => `/api/platform/section-media/${id}`;
const playableMedia = (block: { type: string; mediaType?: string; url: string }, assetId: string, mime: string) =>
  block.type === "media" &&
  (block.mediaType === "audio" ? mime.startsWith("audio/") : block.mediaType === "video" && mime.startsWith("video/")) &&
  block.url === sectionMediaUrl(assetId);

async function getPublishedMediaScope(slug: string) {
  const [section] = await db.select().from(platformSectionsTable).where(and(
    eq(platformSectionsTable.slug, slug),
    eq(platformSectionsTable.published, true),
  )).limit(1);
  if (section) return { section, moduleBlocks: null };

  const [settings] = await db.select({ moduleSettings: platformSettingsTable.moduleSettings })
    .from(platformSettingsTable).where(eq(platformSettingsTable.key, "main")).limit(1);
  const enabled = await enabledModules();
  const module = settings?.moduleSettings?.find(item =>
    item.key === slug && item.enabled && enabled.some(key => key === item.key),
  );
  return module ? { section: null, moduleBlocks: module.blocks ?? [] } : null;
}

router.get("/sections/:slug/media-progress", requireAuth, async (req, res): Promise<void> => {
  const params = GetSectionMediaProgressParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid section" }); return; }
  const scope = await getPublishedMediaScope(params.data.slug);
  if (!scope) { res.status(404).json({ error: "Published section not found" }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const rows = await db.select().from(sectionMediaProgressTable).where(and(
    eq(sectionMediaProgressTable.userId, res.locals.userId as string),
    eq(sectionMediaProgressTable.sectionSlug, params.data.slug),
  ));
  res.json(GetSectionMediaProgressResponse.parse(rows.map(toSectionMediaProgress)));
});

router.put("/sections/:slug/media-progress", requireAuth, async (req, res): Promise<void> => {
  const params = SaveSectionMediaProgressParams.safeParse(req.params);
  const parsed = SaveSectionMediaProgressBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid playback progress" }); return;
  }
  const { slug } = params.data;
  const { contextKey, mediaAssetId, watchedSeconds, durationSeconds } = parsed.data;
  const scope = await getPublishedMediaScope(slug);
  if (!scope) { res.status(404).json({ error: "Published section not found" }); return; }

  const [asset] = await db.select().from(platformMediaAssetsTable).where(and(
    eq(platformMediaAssetsTable.id, mediaAssetId),
    eq(platformMediaAssetsTable.status, "ready"),
  )).limit(1);
  if (!asset || (!asset.mime.startsWith("audio/") && !asset.mime.startsWith("video/"))) {
    res.status(404).json({ error: "Published media not found" }); return;
  }

  const courseMatch = /^course:([a-f0-9-]{36})$/i.exec(contextKey);
  const contextIsPublished = scope.section
    ? courseMatch
      ? scope.section.courses.some(course =>
          course.id === courseMatch[1] && course.materials.some(block => playableMedia(block, mediaAssetId, asset.mime)),
        )
      : contextKey === "section" && scope.section.blocks.some(block => playableMedia(block, mediaAssetId, asset.mime))
    : contextKey === "section" && (scope.moduleBlocks ?? []).some(block => playableMedia(block, mediaAssetId, asset.mime));
  if (!contextIsPublished) { res.status(404).json({ error: "Published media not found" }); return; }

  res.setHeader("Cache-Control", "private, no-store");
  const userId = res.locals.userId as string;
  const [saved] = await db.insert(sectionMediaProgressTable).values({
    userId, sectionSlug: slug, contextKey, mediaAssetId, watchedSeconds, durationSeconds,
  }).onConflictDoUpdate({
    target: [
      sectionMediaProgressTable.userId,
      sectionMediaProgressTable.sectionSlug,
      sectionMediaProgressTable.contextKey,
      sectionMediaProgressTable.mediaAssetId,
    ],
    set: {
      watchedSeconds: sql`GREATEST(${sectionMediaProgressTable.watchedSeconds}, EXCLUDED.watched_seconds)`,
      durationSeconds: sql`GREATEST(${sectionMediaProgressTable.durationSeconds}, EXCLUDED.duration_seconds)`,
      updatedAt: new Date(),
    },
  }).returning();

  if (courseMatch) {
    const [aggregate] = await db.select({
      seconds: sql<number>`COALESCE(SUM(${sectionMediaProgressTable.watchedSeconds}), 0)`,
    }).from(sectionMediaProgressTable).where(and(
      eq(sectionMediaProgressTable.userId, userId),
      eq(sectionMediaProgressTable.sectionSlug, slug),
      eq(sectionMediaProgressTable.contextKey, contextKey),
    ));
    const studyMinutes = Math.floor(Number(aggregate?.seconds ?? 0) / 60);
    await db.update(learningItemsTable).set({
      studyMinutes: sql`GREATEST(${learningItemsTable.studyMinutes}, ${studyMinutes})`,
      updatedAt: new Date(),
    }).where(and(
      eq(learningItemsTable.userId, userId),
      eq(learningItemsTable.sectionCourseId, courseMatch[1]),
      eq(learningItemsTable.kind, "course"),
      eq(learningItemsTable.status, "completed"),
    ));
  }
  res.json(SaveSectionMediaProgressResponse.parse(toSectionMediaProgress(saved)));
});

router.get("/learning-items", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListLearningItemsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const filters = [eq(learningItemsTable.userId, userId)];
  if (parsed.data.kind) {
    filters.push(eq(learningItemsTable.kind, parsed.data.kind));
  }
  const rows = await db
    .select()
    .from(learningItemsTable)
    .where(and(...filters))
    .orderBy(asc(learningItemsTable.kind), asc(learningItemsTable.createdAt));

  res.json(ListLearningItemsResponse.parse(rows.map(toLearningItem)));
});

router.post("/learning-items", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateLearningItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db
    .insert(learningItemsTable)
    .values({
      userId: res.locals.userId as string,
      kind: parsed.data.kind,
      title: parsed.data.title.trim(),
      source: parsed.data.source?.trim() || null,
      subject: parsed.data.subject?.trim() || null,
      url: parsed.data.url?.trim() || null,
      notes: parsed.data.notes?.trim() ?? "",
      status: parsed.data.status ?? "planned",
    })
    .returning();

  res
    .status(201)
    .json(CreateLearningItemResponse.parse(toLearningItem(item)));
});

router.post("/sections/:slug/courses/:courseId/complete", requireAuth, async (req, res): Promise<void> => {
  const params = CompletePlatformSectionCourseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [section] = await db.select().from(platformSectionsTable).where(and(
    eq(platformSectionsTable.slug, params.data.slug),
    eq(platformSectionsTable.published, true),
  )).limit(1);
  const course = section?.courses.find(item => item.id === params.data.courseId);
  if (!section || !course) {
    res.status(404).json({ error: "Published course not found" });
    return;
  }

  const userId = res.locals.userId as string;
  const [aggregate] = await db.select({
    seconds: sql<number>`COALESCE(SUM(${sectionMediaProgressTable.watchedSeconds}), 0)`,
  }).from(sectionMediaProgressTable).where(and(
    eq(sectionMediaProgressTable.userId, userId),
    eq(sectionMediaProgressTable.sectionSlug, section.slug),
    eq(sectionMediaProgressTable.contextKey, `course:${course.id}`),
  ));
  const studyMinutes = Math.floor(Number(aggregate?.seconds ?? 0) / 60);
  const item = await db.transaction(async tx => {
    const [inserted] = await tx.insert(learningItemsTable).values({
      userId,
      sectionCourseId: course.id,
      kind: "course",
      title: course.title,
      source: "أثر",
      subject: section.title,
      url: `/sections/${section.slug}#course-${course.id}`,
      notes: course.description,
      skills: [...new Set((course.skills ?? []).map(skill => skill.trim()).filter(Boolean))],
      status: "completed",
      studyMinutes,
    }).onConflictDoNothing({
      target: [learningItemsTable.userId, learningItemsTable.sectionCourseId],
    }).returning();
    if (inserted) return inserted;
    const [existing] = await tx.update(learningItemsTable)
      .set({
        skills: [...new Set((course.skills ?? []).map(skill => skill.trim()).filter(Boolean))],
        studyMinutes: sql`GREATEST(${learningItemsTable.studyMinutes}, ${studyMinutes})`,
      })
      .where(and(
        eq(learningItemsTable.userId, userId),
        eq(learningItemsTable.sectionCourseId, course.id),
      )).returning();
    return existing;
  });

  if (!item) {
    res.status(500).json({ error: "Unable to save course completion" });
    return;
  }
  res.json(CompletePlatformSectionCourseResponse.parse(toLearningItem(item)));
});

router.patch(
  "/learning-items/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = UpdateLearningItemParams.safeParse(req.params);
    const parsed = UpdateLearningItemBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const fields = parsed.data;
    const update: Partial<typeof learningItemsTable.$inferInsert> & {
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
      ...(fields.title !== undefined ? { title: fields.title.trim() } : {}),
      ...(fields.source !== undefined
        ? { source: fields.source?.trim() || null }
        : {}),
      ...(fields.subject !== undefined
        ? { subject: fields.subject?.trim() || null }
        : {}),
      ...(fields.url !== undefined ? { url: fields.url?.trim() || null } : {}),
      ...(fields.notes !== undefined ? { notes: fields.notes.trim() } : {}),
      ...(fields.status !== undefined ? { status: fields.status } : {}),
    };
    const [item] = await db
      .update(learningItemsTable)
      .set(update)
      .where(
        and(
          eq(learningItemsTable.id, params.data.id),
          eq(learningItemsTable.userId, res.locals.userId as string),
        ),
      )
      .returning();

    if (!item) {
      res.status(404).json({ error: "Learning item not found" });
      return;
    }
    res.json(UpdateLearningItemResponse.parse(toLearningItem(item)));
  },
);

router.delete(
  "/learning-items/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DeleteLearningItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [item] = await db
      .delete(learningItemsTable)
      .where(
        and(
          eq(learningItemsTable.id, params.data.id),
          eq(learningItemsTable.userId, res.locals.userId as string),
        ),
      )
      .returning({ id: learningItemsTable.id });
    if (!item) {
      res.status(404).json({ error: "Learning item not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/academy/progress", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(academyProgressTable)
    .where(eq(academyProgressTable.userId, res.locals.userId as string));
  res.json(GetAcademyProgressResponse.parse(rows.map(toAcademyProgress)));
});

router.put(
  "/academy/progress/:lessonId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = SaveAcademyProgressParams.safeParse(req.params);
    const parsed = SaveAcademyProgressBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = res.locals.userId as string;
    const [progress] = await db
      .insert(academyProgressTable)
      .values({
        userId,
        lessonId: params.data.lessonId,
        completed: parsed.data.completed,
        quizScore: parsed.data.quizScore,
      })
      .onConflictDoUpdate({
        target: [
          academyProgressTable.userId,
          academyProgressTable.lessonId,
        ],
        set: {
          completed: sql`${academyProgressTable.completed} OR EXCLUDED.completed`,
          quizScore: sql`GREATEST(${academyProgressTable.quizScore}, EXCLUDED.quiz_score)`,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(SaveAcademyProgressResponse.parse(toAcademyProgress(progress)));
  },
);

function toLearningItem(item: typeof learningItemsTable.$inferSelect) {
  return {
    id: item.id,
    kind: learningKinds.includes(item.kind as (typeof learningKinds)[number])
      ? item.kind
      : "course",
    title: item.title,
    source: item.source,
    subject: item.subject,
    url: item.url,
    notes: item.notes,
    skills: item.skills ?? [],
    status: learningStatuses.includes(item.status as (typeof learningStatuses)[number])
      ? item.status
      : "planned",
    studyMinutes: item.studyMinutes ?? 0,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toSectionMediaProgress(progress: typeof sectionMediaProgressTable.$inferSelect) {
  return {
    contextKey: progress.contextKey,
    mediaAssetId: progress.mediaAssetId,
    watchedSeconds: progress.watchedSeconds,
    durationSeconds: progress.durationSeconds,
    updatedAt: progress.updatedAt.toISOString(),
  };
}

function toAcademyProgress(
  progress: typeof academyProgressTable.$inferSelect,
) {
  return {
    lessonId: progress.lessonId,
    completed: progress.completed,
    quizScore: progress.quizScore,
    updatedAt: progress.updatedAt.toISOString(),
  };
}

export default router;
