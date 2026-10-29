import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  academyProgressTable,
  db,
  learningItemsTable,
  platformSectionsTable,
} from "@workspace/db";
import {
  CompletePlatformSectionCourseParams,
  CompletePlatformSectionCourseResponse,
  CreateLearningItemBody,
  CreateLearningItemResponse,
  DeleteLearningItemParams,
  GetAcademyProgressResponse,
  ListLearningItemsQueryParams,
  ListLearningItemsResponse,
  SaveAcademyProgressBody,
  SaveAcademyProgressParams,
  SaveAcademyProgressResponse,
  UpdateLearningItemBody,
  UpdateLearningItemParams,
  UpdateLearningItemResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const learningKinds = ["course", "lecture"] as const;
const learningStatuses = ["planned", "in_progress", "completed"] as const;

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
    }).onConflictDoNothing({
      target: [learningItemsTable.userId, learningItemsTable.sectionCourseId],
    }).returning();
    if (inserted) return inserted;
    const [existing] = await tx.update(learningItemsTable)
      .set({ skills: [...new Set((course.skills ?? []).map(skill => skill.trim()).filter(Boolean))] })
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
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
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
