import { Router, type IRouter } from "express";
import { and, asc, count, eq, gte, inArray, lte, max, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  db,
  languageContentItemsTable,
  languagePracticeSessionsTable,
  languageReviewStatesTable,
  type StoredLanguageAnswer,
} from "@workspace/db";
import {
  GetLanguageLearningProgressQueryParams,
  GetLanguageLearningProgressResponse,
  StreamLanguageVoiceConversationBody,
  SubmitLanguageLearningSessionBody,
  SubmitLanguageLearningSessionResponse,
} from "@workspace/api-zod";
import { gradeLanguageAnswer, type LanguageContentItem } from "@workspace/language-content";
import { ensureBuiltinLanguageContent, getLanguageAdminSettings } from "../lib/language-admin-settings";
import {
  calculateLanguageSessionRewards,
  collectRewardedContentIds,
  getUtcRewardDayStart,
} from "../lib/language-session-rewards";
import { requireAuth } from "../middlewares/requireAuth";
import {
  addWeeklyLanguageXp,
  buildLanguageGamificationSummary,
  calculateLanguageStreak,
  ensureCurrentLanguageLeague,
  ensureLanguageGameProfile,
  getLanguageGamificationSummary,
  getLocalLanguageDay,
  isValidLanguageTimezone,
  refillLanguageHearts,
  withLanguageGameProfile,
} from "./language-gamification";

const router: IRouter = Router();
const duePreviewLimit = 12;
const voiceLanguageNames: Record<string, string> = {
  en: "الإنجليزية",
  fr: "الفرنسية",
  es: "الإسبانية",
  de: "الألمانية",
  tr: "التركية",
};
const voiceScenarioNames: Record<string, string> = {
  introduction: "التعارف والتعريف بالنفس",
  work_interview: "مقابلة عمل",
  travel: "السفر وطلب المساعدة",
  study: "الدراسة والعمل ضمن فريق",
};

router.post("/languages/voice-conversation", requireAuth, async (req, res): Promise<void> => {
  const parsed = StreamLanguageVoiceConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { languageCode, level, scenario, history, message } = parsed.data;
  const { page } = await getLanguageAdminSettings();
  if (!page.enabledLanguages.includes(languageCode)) {
    res.status(403).json({ error: "هذه اللغة غير متاحة حاليًا." });
    return;
  }
  const languageName = voiceLanguageNames[languageCode];
  const scenarioName = voiceScenarioNames[scenario];
  if (!languageName || !scenarioName) {
    res.status(400).json({ error: "إعدادات المحادثة غير مدعومة." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const send = (event: { type: string; data?: string }) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice: "alloy", format: "pcm16" },
      messages: [
        {
          role: "system",
          content:
            `أنت مدرب محادثة لغوية لطيف. تدرب مع طالب يتحدث العربية على ${languageName} بمستوى ${level} في موقف ${scenarioName}. ` +
            "استخدم جملًا قصيرة وطبيعية باللغة المستهدفة. إذا ظهر خطأ واضح، ابدأ بتصحيح عربي قصير جدًا ثم أعطِ صياغة صحيحة ومتابعة مناسبة للموقف. " +
            "لا تدّعِ قياس النطق أو تقييمه من النص. اسأل سؤالًا واحدًا قصيرًا في كل دور، ولا تستخدم أسماء منصات أو أشخاص.",
        },
        ...history.map((turn) => ({ role: turn.role, content: turn.text })),
        { role: "user", content: message },
      ],
      stream: true,
    });
    let emittedText = false;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as unknown as {
        audio?: { transcript?: string; data?: string };
        content?: string | null;
      } | undefined;
      if (!delta) continue;
      if (delta.audio?.transcript) {
        emittedText = true;
        send({ type: "transcript", data: delta.audio.transcript });
      } else if (delta.content) {
        emittedText = true;
        send({ type: "transcript", data: delta.content });
      }
      if (delta.audio?.data) send({ type: "audio", data: delta.audio.data });
    }
    send({ type: emittedText ? "done" : "empty" });
    res.end();
  } catch (error) {
    req.log.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "Language conversation stream failed",
    );
    send({ type: "error", data: "تعذّر إكمال المحادثة الآن. حاول مرة أخرى." });
    res.end();
  }
});

function toReviewState(row: typeof languageReviewStatesTable.$inferSelect) {
  return {
    contentId: row.contentId,
    languageCode: row.languageCode,
    level: row.level,
    repetitions: row.repetitions,
    intervalMinutes: row.intervalMinutes,
    dueAt: row.dueAt.toISOString(),
    lastQuality: row.lastQuality,
    lastResponseMs: row.lastResponseMs,
    correctCount: row.correctCount,
    incorrectCount: row.incorrectCount,
    lastReviewedAt: row.lastReviewedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSession(row: typeof languagePracticeSessionsTable.$inferSelect) {
  return {
    id: row.id,
    languageCode: row.languageCode,
    level: row.level,
    totalQuestions: row.totalQuestions,
    correctAnswers: row.correctAnswers,
    elapsedSeconds: row.elapsedSeconds,
    completedAt: row.completedAt.toISOString(),
  };
}

function calculateReview(
  previous: typeof languageReviewStatesTable.$inferSelect | undefined,
  answer: { isCorrect: boolean; responseMs: number },
  now: Date,
) {
  const quality = !answer.isCorrect
    ? 1
    : answer.responseMs <= 4_000
      ? 5
      : answer.responseMs <= 9_000
        ? 4
        : 3;
  const repetitions = answer.isCorrect ? (previous?.repetitions ?? 0) + 1 : 0;
  let intervalMinutes: number;

  if (!answer.isCorrect) {
    intervalMinutes = 10;
  } else if (repetitions === 1) {
    intervalMinutes = quality === 3 ? 60 : 1_440;
  } else if (repetitions === 2) {
    intervalMinutes = quality === 3 ? 720 : 4_320;
  } else {
    const factor = quality === 3 ? 1.5 : quality === 4 ? 2 : 2.5;
    intervalMinutes = Math.min(
      60 * 24 * 60,
      Math.ceil((previous?.intervalMinutes ?? 1_440) * factor),
    );
  }

  return {
    quality,
    repetitions,
    intervalMinutes,
    dueAt: new Date(now.getTime() + intervalMinutes * 60_000),
  };
}

router.get("/languages/progress", requireAuth, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const parsed = GetLanguageLearningProgressQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  const { languageCode, level } = parsed.data;
  const { page } = await getLanguageAdminSettings();
  if (!page.enabledLanguages.includes(languageCode)) {
    res.status(403).json({ error: "هذه اللغة غير متاحة حاليًا." });
    return;
  }
  const now = new Date();
  const progressFilter = and(
    eq(languageReviewStatesTable.userId, userId),
    eq(languageReviewStatesTable.languageCode, languageCode),
    level ? eq(languageReviewStatesTable.level, level) : undefined,
  );
  const sessionFilter = and(
    eq(languagePracticeSessionsTable.userId, userId),
    eq(languagePracticeSessionsTable.languageCode, languageCode),
    level ? eq(languagePracticeSessionsTable.level, level) : undefined,
  );

  const [reviewCounts] = await db.select({
    reviewedCount: count(),
    dueCount: sql<number>`count(*) filter (where ${languageReviewStatesTable.dueAt} <= ${now})::int`,
    masteredCount: sql<number>`count(*) filter (where ${languageReviewStatesTable.repetitions} >= 3)::int`,
  }).from(languageReviewStatesTable).where(progressFilter);
  const [sessionCounts] = await db.select({
    sessionsCompleted: count(),
    latestSessionAt: max(languagePracticeSessionsTable.completedAt),
  }).from(languagePracticeSessionsTable).where(sessionFilter);
  const dueReviews = await db.select().from(languageReviewStatesTable)
    .where(and(progressFilter, lte(languageReviewStatesTable.dueAt, now)))
    .orderBy(asc(languageReviewStatesTable.dueAt))
    .limit(duePreviewLimit);

  res.json(GetLanguageLearningProgressResponse.parse({
    languageCode,
    dueCount: reviewCounts?.dueCount ?? 0,
    reviewedCount: reviewCounts?.reviewedCount ?? 0,
    masteredCount: reviewCounts?.masteredCount ?? 0,
    sessionsCompleted: sessionCounts?.sessionsCompleted ?? 0,
    latestSessionAt: sessionCounts?.latestSessionAt?.toISOString() ?? null,
    dueReviews: dueReviews.map(toReviewState),
  }));
});

router.post("/languages/sessions", requireAuth, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const parsed = SubmitLanguageLearningSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  const userId = res.locals.userId as string;
  const { page, game: gameRules } = await getLanguageAdminSettings();
  if (!page.enabledLanguages.includes(input.languageCode)) {
    res.status(403).json({ error: "هذه اللغة غير متاحة حاليًا." });
    return;
  }
  if (input.timezone && !isValidLanguageTimezone(input.timezone)) {
    res.status(400).json({ error: "Invalid time zone." });
    return;
  }
  const contentIds = input.answers.map(answer => answer.contentId);
  if (new Set(contentIds).size !== contentIds.length) {
    res.status(400).json({ error: "A session cannot include the same learning item twice." });
    return;
  }

  await ensureBuiltinLanguageContent();
  const contentRows = await db.select().from(languageContentItemsTable)
    .where(inArray(languageContentItemsTable.id, contentIds));
  const contentById = new Map(contentRows.map(item => [item.id, item]));
  const validationResults = input.answers.map(answer => {
    const item = contentById.get(answer.contentId);
    if (!item || item.languageCode !== input.languageCode || item.level !== input.level) return null;
    const grade = gradeLanguageAnswer(item as LanguageContentItem, answer.mode, answer.submittedAnswer);
    return grade ? { ...answer, ...grade } : null;
  });
  if (validationResults.some(answer => answer === null)) {
    res.status(400).json({ error: "تعذّر التحقق من محتوى بعض الأسئلة. حدّث الصفحة وابدأ جلسة جديدة." });
    return;
  }
  const validatedAnswers = validationResults.filter(
    (answer): answer is NonNullable<typeof answer> => answer !== null,
  );

  const now = new Date();
  const correctAnswers = validatedAnswers.filter(answer => answer.isCorrect).length;
  const saved = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`language-session:${userId}:${input.sessionRef}`}))`);
    const existing = await tx.select().from(languagePracticeSessionsTable)
      .where(and(
        eq(languagePracticeSessionsTable.userId, userId),
        eq(languagePracticeSessionsTable.sessionRef, input.sessionRef),
      )).limit(1);
    if (existing[0]) {
      return {
        duplicate: true as const,
        session: existing[0],
        reviewUpdates: [] as (typeof languageReviewStatesTable.$inferSelect)[],
      };
    }

    const initialProfile = await ensureLanguageGameProfile(
      tx, userId, input.languageCode, now, input.timezone, gameRules,
    );
    const { profile, membership } = await ensureCurrentLanguageLeague(
      tx, userId, input.languageCode, initialProfile, now, gameRules,
    );
    const previousRows = await tx.select().from(languageReviewStatesTable)
      .where(and(
        eq(languageReviewStatesTable.userId, userId),
        eq(languageReviewStatesTable.languageCode, input.languageCode),
        eq(languageReviewStatesTable.level, input.level),
        inArray(languageReviewStatesTable.contentId, contentIds),
      ));
    const previousById = new Map(previousRows.map(row => [row.contentId, row]));
    const sameDaySessions = await tx.select({
      answers: languagePracticeSessionsTable.answers,
    }).from(languagePracticeSessionsTable).where(and(
      eq(languagePracticeSessionsTable.userId, userId),
      eq(languagePracticeSessionsTable.languageCode, input.languageCode),
      gte(languagePracticeSessionsTable.completedAt, getUtcRewardDayStart(now)),
    ));
    const rewardedContentIds = collectRewardedContentIds(sameDaySessions);
    const reviewPlans = validatedAnswers.map(answer => ({
      answer,
      schedule: calculateReview(previousById.get(answer.contentId), answer, now),
      previous: previousById.get(answer.contentId),
    }));
    const dueAnswerCount = reviewPlans.filter(
      plan => plan.previous && plan.previous.dueAt <= now,
    ).length;
    const dueContentIds = new Set(reviewPlans
      .filter(plan => plan.previous && plan.previous.dueAt <= now)
      .map(plan => plan.answer.contentId));
    const rewards = calculateLanguageSessionRewards({
      answers: validatedAnswers,
      rewardedContentIds,
      dueContentIds,
      sessionKind: input.sessionKind,
      rules: gameRules,
    });
    const heartsBeforeSession = refillLanguageHearts(profile, now, gameRules);

    if (input.sessionKind === "review" && dueAnswerCount < 10) {
      return { error: "review-not-ready" as const };
    }
    if (input.sessionKind === "lesson" && heartsBeforeSession.hearts === 0) {
      return { error: "no-hearts" as const };
    }

    const storedAnswers: StoredLanguageAnswer[] = reviewPlans.map(({ answer, schedule }) => ({
      contentId: answer.contentId,
      mode: answer.mode,
      isCorrect: answer.isCorrect,
      pronunciationScore: answer.pronunciationScore,
      responseMs: answer.responseMs,
      quality: schedule.quality,
      intervalMinutes: schedule.intervalMinutes,
    }));
    const [session] = await tx.insert(languagePracticeSessionsTable).values({
      sessionRef: input.sessionRef,
      userId,
      languageCode: input.languageCode,
      level: input.level,
      totalQuestions: input.answers.length,
      correctAnswers,
      elapsedSeconds: input.elapsedSeconds,
      answers: storedAnswers,
    }).onConflictDoNothing({
      target: [languagePracticeSessionsTable.userId, languagePracticeSessionsTable.sessionRef],
    }).returning();

    if (!session) {
      const duplicate = await tx.select().from(languagePracticeSessionsTable)
        .where(and(
          eq(languagePracticeSessionsTable.userId, userId),
          eq(languagePracticeSessionsTable.sessionRef, input.sessionRef),
        )).limit(1);
      if (!duplicate[0]) throw new Error("A repeated language session could not be loaded.");
      return {
        duplicate: true as const,
        session: duplicate[0],
        reviewUpdates: [] as (typeof languageReviewStatesTable.$inferSelect)[],
      };
    }

    const reviewUpdates: (typeof languageReviewStatesTable.$inferSelect)[] = [];
    for (const { answer, schedule, previous } of reviewPlans) {
      const values = {
        userId,
        languageCode: input.languageCode,
        level: input.level,
        contentId: answer.contentId,
        repetitions: schedule.repetitions,
        intervalMinutes: schedule.intervalMinutes,
        dueAt: schedule.dueAt,
        lastQuality: schedule.quality,
        lastResponseMs: answer.responseMs,
        correctCount: (previous?.correctCount ?? 0) + (answer.isCorrect ? 1 : 0),
        incorrectCount: (previous?.incorrectCount ?? 0) + (answer.isCorrect ? 0 : 1),
        lastReviewedAt: now,
        updatedAt: now,
      };
      const [updated] = await tx.insert(languageReviewStatesTable).values(values)
        .onConflictDoUpdate({
          target: [
            languageReviewStatesTable.userId,
            languageReviewStatesTable.languageCode,
            languageReviewStatesTable.contentId,
          ],
          set: {
            level: values.level,
            repetitions: values.repetitions,
            intervalMinutes: values.intervalMinutes,
            dueAt: values.dueAt,
            lastQuality: values.lastQuality,
            lastResponseMs: values.lastResponseMs,
            correctCount: values.correctCount,
            incorrectCount: values.incorrectCount,
            lastReviewedAt: values.lastReviewedAt,
            updatedAt: values.updatedAt,
          },
        }).returning();
      reviewUpdates.push(updated);
    }

    const xpEarned = rewards.xpEarned;
    const streak = calculateLanguageStreak(
      profile,
      getLocalLanguageDay(now, profile.timezone),
    );
    const gemsEarned = Math.max(
      0,
      Math.floor(streak.currentStreak / gameRules.streakGemInterval)
        - Math.floor(profile.currentStreak / gameRules.streakGemInterval),
    );
    const heartsAfterAnswers = Math.max(
      0,
      heartsBeforeSession.hearts - (input.answers.length - correctAnswers),
    );
    const hearts = Math.min(
      gameRules.maxHearts,
      heartsAfterAnswers + (rewards.reviewQualified ? 1 : 0),
    );
    const heartsUpdatedAt = hearts >= gameRules.maxHearts
      || (heartsBeforeSession.hearts === gameRules.maxHearts && hearts < gameRules.maxHearts)
      || (rewards.reviewQualified && hearts < gameRules.maxHearts)
      ? now
      : heartsBeforeSession.heartsUpdatedAt;
    const updatedProfile = await withLanguageGameProfile(tx, profile, {
      xpTotal: profile.xpTotal + xpEarned,
      gems: profile.gems + gemsEarned,
      hearts,
      heartsUpdatedAt,
      currentStreak: streak.currentStreak,
      bestStreak: Math.max(profile.bestStreak, streak.currentStreak),
      lastActiveDay: getLocalLanguageDay(now, profile.timezone),
      streakFreezeCredits: streak.streakFreezeCredits,
      updatedAt: now,
    });
    const updatedMembership = await addWeeklyLanguageXp(tx, membership, xpEarned, now);
    const gamification = await buildLanguageGamificationSummary(
      tx, userId, input.languageCode, updatedProfile, updatedMembership, now,
      gameRules,
    );
    return { duplicate: false as const, session, reviewUpdates, gamification };
  });

  if ("error" in saved) {
    res.status(409).json({
      error: saved.error === "no-hearts"
        ? "نفدت القلوب؛ أكمل مراجعة مستحقة أو انتظر تجدد قلب."
        : "تحتاج إلى عشرة عناصر مراجعة مستحقة على الأقل.",
    });
    return;
  }
  const gamification = "gamification" in saved
    ? saved.gamification
    : await getLanguageGamificationSummary(userId, input.languageCode);
  res.json(SubmitLanguageLearningSessionResponse.parse({
    duplicate: saved.duplicate,
    session: toSession(saved.session),
    reviewUpdates: saved.reviewUpdates.map(toReviewState),
    gamification,
    answerResults: saved.duplicate
      ? saved.session.answers.map(answer => ({
        contentId: answer.contentId,
        isCorrect: answer.isCorrect,
        pronunciationScore: answer.pronunciationScore ?? null,
      }))
      : validatedAnswers.map(answer => ({
        contentId: answer.contentId,
        isCorrect: answer.isCorrect,
        pronunciationScore: answer.pronunciationScore,
      })),
  }));
});

export default router;
