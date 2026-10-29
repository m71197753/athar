import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { enabledModules, isSuspended } from "../lib/platform-access";
import {
  achievementsTable,
  db,
  learningItemsTable,
  resumeSharesTable,
  studentsTable,
} from "@workspace/db";
import {
  GetPublicResumeResponse,
  GetPublicResumeParams,
  GetResumeShareSettingsResponse,
  SaveResumeShareSettingsBody,
  SaveResumeShareSettingsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const defaultSettings = {
  enabled: false,
  token: null,
  showName: false,
  showHeadline: false,
  showUniversity: false,
  showMajor: false,
  showYearOfStudy: false,
  showSkills: false,
  achievementIds: [] as string[],
  courseIds: [] as string[],
};

function toSettings(row: typeof resumeSharesTable.$inferSelect | undefined) {
  return {
    ...defaultSettings,
    ...(row
      ? {
          enabled: row.enabled,
          token: row.enabled ? row.token : null,
          showName: row.showName,
          showHeadline: row.showHeadline,
          showUniversity: row.showUniversity,
          showMajor: row.showMajor,
          showYearOfStudy: row.showYearOfStudy,
          showSkills: row.showSkills,
          achievementIds: row.achievementIds,
          courseIds: row.courseIds,
        }
      : {}),
  };
}

router.get(
  "/student/resume-share",
  requireAuth,
  async (_req, res): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    const userId = res.locals.userId as string;
    const [row] = await db
      .select()
      .from(resumeSharesTable)
      .where(eq(resumeSharesTable.userId, userId))
      .limit(1);
    res.json(GetResumeShareSettingsResponse.parse(toSettings(row)));
  },
);

router.put(
  "/student/resume-share",
  requireAuth,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    const parsed = SaveResumeShareSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = res.locals.userId as string;
    const data = parsed.data;
    const achievementIds = [...new Set(data.achievementIds)];
    const courseIds = [...new Set(data.courseIds)];
    if (achievementIds.length !== data.achievementIds.length || courseIds.length !== data.courseIds.length) {
      res.status(400).json({ error: "Selected items must not contain duplicates" });
      return;
    }

    const [ownedAchievements, ownedCourses] = await Promise.all([
      achievementIds.length
        ? db
            .select({ id: achievementsTable.id })
            .from(achievementsTable)
            .where(
              and(
                eq(achievementsTable.userId, userId),
                inArray(achievementsTable.id, achievementIds),
              ),
            )
        : Promise.resolve([]),
      courseIds.length
        ? db
            .select({ id: learningItemsTable.id })
            .from(learningItemsTable)
            .where(
              and(
                eq(learningItemsTable.userId, userId),
                eq(learningItemsTable.kind, "course"),
                eq(learningItemsTable.status, "completed"),
                inArray(learningItemsTable.id, courseIds),
              ),
            )
        : Promise.resolve([]),
    ]);
    if (ownedAchievements.length !== achievementIds.length || ownedCourses.length !== courseIds.length) {
      res.status(400).json({ error: "A selected item is unavailable" });
      return;
    }

    const [existing] = await db
      .select()
      .from(resumeSharesTable)
      .where(eq(resumeSharesTable.userId, userId))
      .limit(1);
    const token = data.enabled
      ? existing?.enabled && existing.token
        ? existing.token
        : randomBytes(32).toString("hex")
      : null;
    const [saved] = await db
      .insert(resumeSharesTable)
      .values({
        userId,
        token,
        enabled: data.enabled,
        showName: data.showName,
        showHeadline: data.showHeadline,
        showUniversity: data.showUniversity,
        showMajor: data.showMajor,
        showYearOfStudy: data.showYearOfStudy,
        showSkills: data.showSkills,
        achievementIds,
        courseIds,
      })
      .onConflictDoUpdate({
        target: resumeSharesTable.userId,
        set: {
          token,
          enabled: data.enabled,
          showName: data.showName,
          showHeadline: data.showHeadline,
          showUniversity: data.showUniversity,
          showMajor: data.showMajor,
          showYearOfStudy: data.showYearOfStudy,
          showSkills: data.showSkills,
          achievementIds,
          courseIds,
          updatedAt: new Date(),
        },
      })
      .returning();
    res.json(SaveResumeShareSettingsResponse.parse(toSettings(saved)));
  },
);

router.get(
  "/public/resume/:token",
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    const params = GetPublicResumeParams.safeParse(req.params);
    if (!params.success) {
      res.status(404).json({ error: "Shared profile not found" });
      return;
    }
    const token = params.data.token;
    const [share] = await db
      .select()
      .from(resumeSharesTable)
      .where(and(eq(resumeSharesTable.token, token), eq(resumeSharesTable.enabled, true)))
      .limit(1);

    if (!share || await isSuspended(share.userId) || !(await enabledModules()).includes("resume")) {
      res.status(404).json({ error: "Shared profile not found" });
      return;
    }

    const [profileRows, achievementRows, courseRows] = await Promise.all([
      share.showName ||
      share.showHeadline ||
      share.showUniversity ||
      share.showMajor ||
      share.showYearOfStudy ||
      share.showSkills
        ? db
            .select({
              fullName: studentsTable.fullName,
              headline: studentsTable.headline,
              university: studentsTable.university,
              major: studentsTable.major,
              yearOfStudy: studentsTable.yearOfStudy,
              skills: studentsTable.skills,
            })
            .from(studentsTable)
            .where(eq(studentsTable.userId, share.userId))
            .limit(1)
        : Promise.resolve([]),
      share.achievementIds.length
        ? db
            .select({
              title: achievementsTable.title,
              category: achievementsTable.category,
              achievedOn: achievementsTable.achievedOn,
              resumeBullet: achievementsTable.resumeBullet,
              result: achievementsTable.result,
              skills: achievementsTable.skills,
            })
            .from(achievementsTable)
            .where(
              and(
                eq(achievementsTable.userId, share.userId),
                inArray(achievementsTable.id, share.achievementIds),
              ),
            )
            .orderBy(desc(achievementsTable.achievedOn))
        : Promise.resolve([]),
      share.courseIds.length
        ? db
            .select({
              title: learningItemsTable.title,
              source: learningItemsTable.source,
              subject: learningItemsTable.subject,
              skills: learningItemsTable.skills,
            })
            .from(learningItemsTable)
            .where(
              and(
                eq(learningItemsTable.userId, share.userId),
                eq(learningItemsTable.kind, "course"),
                eq(learningItemsTable.status, "completed"),
                inArray(learningItemsTable.id, share.courseIds),
              ),
            )
        : Promise.resolve([]),
    ]);
    const profile = profileRows[0];
    res.json(
      GetPublicResumeResponse.parse({
        fullName: share.showName ? profile?.fullName ?? null : null,
        headline: share.showHeadline ? profile?.headline ?? null : null,
        university: share.showUniversity ? profile?.university ?? null : null,
        major: share.showMajor ? profile?.major ?? null : null,
        yearOfStudy: share.showYearOfStudy ? profile?.yearOfStudy ?? null : null,
        skills: share.showSkills
          ? [...new Set([
              ...(profile?.skills ?? []),
              ...achievementRows.flatMap(item => item.skills),
              ...courseRows.flatMap(item => item.skills ?? []),
            ])]
          : [],
        achievements: achievementRows.map(({ result, skills: _skills, ...item }) => ({
          ...item,
          resumeBullet: item.resumeBullet || result,
        })),
        courses: courseRows.map(({ skills: _skills, ...course }) => course),
      }),
    );
  },
);

export default router;
