import { Router, type IRouter } from "express";
import { asc, and, eq } from "drizzle-orm";
import {
  careerPlansTable,
  careerTasksTable,
  db,
  studentsTable,
  achievementsTable,
} from "@workspace/db";
import {
  CreateCareerTasksBody,
  CreateCareerTasksResponse,
  DeleteCareerTaskParams,
  GenerateCareerPlanSuggestionsBody,
  GenerateCareerPlanSuggestionsResponse,
  GetCareerPlanResponse,
  GetCareerPushConfigResponse,
  SaveCareerPlanBody,
  SaveCareerPlanResponse,
  SaveCareerReminderBody,
  SaveCareerReminderResponse,
  SnoozeCareerReminderResponse,
  UpdateCareerTaskBody,
  UpdateCareerTaskParams,
  UpdateCareerTaskResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";
import { pushKeys, validPushEndpoint } from "../lib/roadmap-push";

const router: IRouter = Router();
const taskStatuses = ["planned", "in_progress", "completed"] as const;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

router.get("/career-plan", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const [planRows, taskRows] = await Promise.all([
    db.select().from(careerPlansTable).where(eq(careerPlansTable.userId, userId)).limit(1),
    db
      .select()
      .from(careerTasksTable)
      .where(eq(careerTasksTable.userId, userId))
      .orderBy(asc(careerTasksTable.stage), asc(careerTasksTable.createdAt)),
  ]);

  const overview = {
    plan: planRows[0] ? toCareerPlan(planRows[0]) : null,
    tasks: taskRows.map(toCareerTask),
    reminder: planRows[0] ? toCareerReminder(planRows[0]) : { enabled: false, taskId: null, nextReminderAt: null, channel: "in_app", consentAt: null },
  };
  res.json(GetCareerPlanResponse.parse(overview));
});

router.put("/career-plan", requireAuth, async (req, res): Promise<void> => {
  const parsed = SaveCareerPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [plan] = await db
    .insert(careerPlansTable)
    .values({
      userId,
      targetRole: parsed.data.targetRole.trim(),
      timeframeDays: parsed.data.timeframeDays,
      overview: parsed.data.overview.trim(),
      focusSkills: parsed.data.focusSkills.map((skill) => skill.trim()).filter(Boolean),
    })
    .onConflictDoUpdate({
      target: careerPlansTable.userId,
      set: {
        targetRole: parsed.data.targetRole.trim(),
        timeframeDays: parsed.data.timeframeDays,
        overview: parsed.data.overview.trim(),
        focusSkills: parsed.data.focusSkills.map((skill) => skill.trim()).filter(Boolean),
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(SaveCareerPlanResponse.parse(toCareerPlan(plan)));
});

router.get("/career-plan/reminder/push-config", requireAuth, async (_req, res): Promise<void> => {
  try {
    res.json(GetCareerPushConfigResponse.parse({ publicKey: pushKeys().publicKey }));
  } catch {
    res.status(503).json({ error: "Push delivery is not configured" });
  }
});

router.put("/career-plan/reminder", requireAuth, async (req, res): Promise<void> => {
  const parsed = SaveCareerReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [plan] = await db
    .select({ id: careerPlansTable.id })
    .from(careerPlansTable)
    .where(eq(careerPlansTable.userId, userId))
    .limit(1);
  if (!plan) {
    res.status(400).json({ error: "Save a career goal before setting a reminder" });
    return;
  }

  let taskId: string | null = null;
  if (parsed.data.enabled) {
    if (!parsed.data.taskId) {
      res.status(400).json({ error: "Choose an incomplete action item for the reminder" });
      return;
    }
    const [selectedTask] = await db
      .select({ id: careerTasksTable.id, status: careerTasksTable.status })
      .from(careerTasksTable)
      .where(
        and(
          eq(careerTasksTable.id, parsed.data.taskId),
          eq(careerTasksTable.userId, userId),
        ),
      )
      .limit(1);
    if (!selectedTask || selectedTask.status === "completed") {
      res.status(400).json({ error: "Choose an incomplete action item for the reminder" });
      return;
    }
    taskId = parsed.data.taskId;
  }

  const nextReminderAt = parsed.data.enabled ? new Date(Date.now() + WEEK_MS) : null;
  const usePush = parsed.data.enabled && parsed.data.channel === "push";
  const sub = parsed.data.subscription;
  const origin = req.get("origin");
  if (usePush) {
    if (!parsed.data.pushConsent || !sub || !validPushEndpoint(sub.endpoint) ||
        !/^[A-Za-z0-9_-]+=*$/.test(sub.keys.p256dh) ||
        !/^[A-Za-z0-9_-]+=*$/.test(sub.keys.auth) ||
        Buffer.from(sub.keys.p256dh, "base64url").length !== 65 ||
        Buffer.from(sub.keys.p256dh, "base64url")[0] !== 4 ||
        Buffer.from(sub.keys.auth, "base64url").length !== 16 ||
        !origin || !URL.canParse(origin) || new URL(origin).protocol !== "https:" ||
        new URL(origin).origin !== origin) {
      res.status(400).json({ error: "Push requires explicit consent and a valid browser subscription" });
      return;
    }
    try { pushKeys(); } catch {
      res.status(503).json({ error: "Push delivery is not configured" });
      return;
    }
  }
  const [updatedPlan] = await db
    .update(careerPlansTable)
    .set({
      weeklyReminderEnabled: parsed.data.enabled,
      reminderTaskId: taskId,
      nextReminderAt,
      reminderChannel: usePush ? "push" : "in_app",
      pushConsentAt: usePush ? new Date() : null,
      pushSubscription: usePush && sub && origin ? { ...sub, origin } : null,
      updatedAt: new Date(),
    })
    .where(eq(careerPlansTable.id, plan.id))
    .returning();
  res.json(SaveCareerReminderResponse.parse(toCareerReminder(updatedPlan)));
});

router.post("/career-plan/reminder/snooze", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const [plan] = await db
    .select()
    .from(careerPlansTable)
    .where(eq(careerPlansTable.userId, userId))
    .limit(1);
  if (!plan?.weeklyReminderEnabled || !plan.reminderTaskId) {
    res.status(400).json({ error: "No active weekly reminder" });
    return;
  }

  const [updatedPlan] = await db
    .update(careerPlansTable)
    .set({ nextReminderAt: new Date(Date.now() + WEEK_MS), updatedAt: new Date() })
    .where(eq(careerPlansTable.id, plan.id))
    .returning();
  res.json(SnoozeCareerReminderResponse.parse(toCareerReminder(updatedPlan)));
});

router.post(
  "/career-plan/tasks/batch",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = CreateCareerTasksBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = res.locals.userId as string;
    const [plan] = await db
      .select({ id: careerPlansTable.id })
      .from(careerPlansTable)
      .where(eq(careerPlansTable.userId, userId))
      .limit(1);
    if (!plan) {
      res.status(400).json({ error: "Save a career goal before adding action items" });
      return;
    }

    const tasks = await db
      .insert(careerTasksTable)
      .values(
        parsed.data.tasks.map((task) => ({
          ...task,
          userId,
          title: task.title.trim(),
          detail: task.detail.trim(),
          status: "planned",
        })),
      )
      .returning();

    res.status(201).json(CreateCareerTasksResponse.parse(tasks.map(toCareerTask)));
  },
);

router.patch(
  "/career-plan/tasks/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = UpdateCareerTaskParams.safeParse(req.params);
    const parsed = UpdateCareerTaskBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = res.locals.userId as string;
    const update: Partial<typeof careerTasksTable.$inferInsert> = {
      ...parsed.data,
      updatedAt: new Date(),
    };
    if (parsed.data.title !== undefined) update.title = parsed.data.title.trim();
    if (parsed.data.detail !== undefined) update.detail = parsed.data.detail.trim();

    const [task] = await db
      .update(careerTasksTable)
      .set(update)
      .where(
        and(
          eq(careerTasksTable.id, params.data.id),
          eq(careerTasksTable.userId, userId),
        ),
      )
      .returning();
    if (!task) {
      res.status(404).json({ error: "Action item not found" });
      return;
    }

    if (parsed.data.status === "completed") {
      await disableReminderForTask(userId, task.id);
    }
    res.json(UpdateCareerTaskResponse.parse(toCareerTask(task)));
  },
);

router.delete(
  "/career-plan/tasks/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DeleteCareerTaskParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const userId = res.locals.userId as string;
    const [task] = await db
      .delete(careerTasksTable)
      .where(
        and(
          eq(careerTasksTable.id, params.data.id),
          eq(careerTasksTable.userId, userId),
        ),
      )
      .returning({ id: careerTasksTable.id });
    if (!task) {
      res.status(404).json({ error: "Action item not found" });
      return;
    }

    await disableReminderForTask(userId, task.id);
    res.sendStatus(204);
  },
);

router.post(
  "/ai/career-plan-suggestions",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = GenerateCareerPlanSuggestionsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = res.locals.userId as string;
    const [profileRows, achievementRows] = await Promise.all([
      db
        .select({
          major: studentsTable.major,
          skills: studentsTable.skills,
        })
        .from(studentsTable)
        .where(eq(studentsTable.userId, userId))
        .limit(1),
      db
        .select({
          title: achievementsTable.title,
          category: achievementsTable.category,
          action: achievementsTable.action,
          result: achievementsTable.result,
          skills: achievementsTable.skills,
        })
        .from(achievementsTable)
        .where(eq(achievementsTable.userId, userId))
        .orderBy(asc(achievementsTable.achievedOn))
        .limit(6),
    ]);

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-terra",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "أنت مرشد مهني يساعد طلاب الجامعات على الانتقال من الدراسة إلى العمل. أجب بكائن JSON فقط بهذه المفاتيح: overview، focusSkills، suggestions. overview فقرة قصيرة بالعربية. focusSkills مصفوفة من 3 إلى 6 مهارات مناسبة للهدف. suggestions مصفوفة من 4 إلى 8 خطوات عملية قابلة للإنجاز، ولكل خطوة title وdetail وstage. اجعل stage رقماً صحيحاً من 1 إلى 12، ووزّع الخطوات زمنياً على مدة الخطة. لا تدّعِ أن الطالب يمتلك مهارات لم يذكرها. اجعل الخطوات قابلة للتنفيذ بموارد طالب جامعي، ووازن بين التعلم والتطبيق وبناء دليل عمل. لا تخترع شهادات أو فرص توظيف أو نتائج مضمونة.",
        },
        {
          role: "user",
          content: JSON.stringify({
            targetRole: parsed.data.targetRole,
            timeframeDays: parsed.data.timeframeDays,
            studyField: profileRows[0]?.major ?? null,
            savedSkills: profileRows[0]?.skills ?? [],
            achievements: achievementRows,
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      res.status(502).json({ error: "The career assistant returned no suggestions" });
      return;
    }

    let result: unknown;
    try {
      result = JSON.parse(content);
    } catch {
      res.status(502).json({ error: "The career assistant returned invalid suggestions" });
      return;
    }
    const validated = GenerateCareerPlanSuggestionsResponse.safeParse(result);
    if (!validated.success) {
      res.status(502).json({ error: "The career assistant returned an invalid plan" });
      return;
    }
    res.json(validated.data);
  },
);

function toCareerPlan(plan: typeof careerPlansTable.$inferSelect) {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function toCareerReminder(plan: typeof careerPlansTable.$inferSelect) {
  return {
    enabled: plan.weeklyReminderEnabled,
    taskId: plan.reminderTaskId,
    nextReminderAt: plan.nextReminderAt?.toISOString() ?? null,
    channel: plan.reminderChannel,
    consentAt: plan.pushConsentAt?.toISOString() ?? null,
  };
}

async function disableReminderForTask(userId: string, taskId: string): Promise<void> {
  await db
    .update(careerPlansTable)
    .set({
      weeklyReminderEnabled: false,
      reminderTaskId: null,
      nextReminderAt: null,
      pushConsentAt: null,
      pushSubscription: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(careerPlansTable.userId, userId),
        eq(careerPlansTable.reminderTaskId, taskId),
      ),
    );
}

function toCareerTask(task: typeof careerTasksTable.$inferSelect) {
  return {
    ...task,
    status: taskStatuses.includes(task.status as (typeof taskStatuses)[number])
      ? task.status
      : "planned",
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export default router;
