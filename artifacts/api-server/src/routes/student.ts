import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  achievementsTable,
  academyProgressTable,
  db,
  learningItemsTable,
  studentsTable,
} from "@workspace/db";
import {
  CreateAchievementBody,
  CreateAchievementResponse,
  DeleteAchievementParams,
  GetDashboardSummaryResponse,
  GetStudentProfileResponse,
  ListAchievementsQueryParams,
  ListAchievementsResponse,
  SaveStudentProfileBody,
  SaveStudentProfileResponse,
  UpdateAchievementBody,
  UpdateAchievementParams,
  UpdateAchievementResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

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

router.delete("/achievements/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteAchievementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = res.locals.userId as string;
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
