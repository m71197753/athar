import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";
import { achievementsTable, careerPlansTable, db, learningItemsTable, studentsTable } from "@workspace/db";
import {
  AskCareerAssistantBody,
  AskCareerAssistantResponse,
  CompareCareerAssistantBody,
  CompareCareerAssistantResponse,
  GenerateAchievementDraftBody,
  GenerateAchievementDraftResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const comparisonRequests = new Map<string, number>();

router.post(
  "/ai/achievement-draft",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = GenerateAchievementDraftBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const facts = parsed.data;
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "أنت مساعد مهني للطلاب. أعد JSON صالحاً بالمفاتيح resumeBullet وinterviewStory وserviceOffer وsummary. اكتب بالعربية الواضحة وبصياغة مهنية. استخدم الحقائق التي قدمها الطالب فقط، ولا تخترع أرقاماً أو نتائج أو مسؤوليات. إذا كانت النتيجة غير كمية، صفها دون ادعاء نسبة أو أثر غير مذكور. اجعل resumeBullet جملة قصيرة مناسبة للسيرة الذاتية، وinterviewStory إجابة مختصرة وفق STAR، وserviceOffer تعريفاً موجزاً بمشروع الطالب أو مهارته وما يمكن أن يقدمه، وsummary خلاصة من سطر واحد.",
        },
        {
          role: "user",
          content: JSON.stringify(facts),
        },
      ],
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      res.status(502).json({ error: "The writing assistant returned no draft" });
      return;
    }

    let draft: unknown;
    try {
      draft = JSON.parse(content);
    } catch {
      res.status(502).json({ error: "The writing assistant returned an invalid draft" });
      return;
    }
    res.json(GenerateAchievementDraftResponse.parse(draft));
  },
);

router.post(
  "/ai/career-assistant",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = AskCareerAssistantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = res.locals.userId as string;
    const [profiles, achievements, learningItems, plans] = await Promise.all([
      db.select().from(studentsTable).where(eq(studentsTable.userId, userId)).limit(1),
      db
        .select()
        .from(achievementsTable)
        .where(eq(achievementsTable.userId, userId))
        .orderBy(desc(achievementsTable.achievedOn))
        .limit(8),
      db
        .select()
        .from(learningItemsTable)
        .where(eq(learningItemsTable.userId, userId))
        .orderBy(desc(learningItemsTable.updatedAt))
        .limit(8),
      db.select().from(careerPlansTable).where(eq(careerPlansTable.userId, userId)).limit(1),
    ]);

    const context = {
      profile: profiles[0]
        ? {
            fullName: profiles[0].fullName,
            university: profiles[0].university,
            major: profiles[0].major,
            yearOfStudy: profiles[0].yearOfStudy,
            skills: profiles[0].skills,
          }
        : null,
      recentExperiences: achievements.map((item) => ({
        title: item.title,
        context: item.context,
        action: item.action,
        result: item.result,
        skills: item.skills,
      })),
      learning: learningItems.map((item) => ({
        title: item.title,
        kind: item.kind,
        status: item.status,
        subject: item.subject,
      })),
      careerGoal: plans[0]
        ? { targetRole: plans[0].targetRole, focusSkills: plans[0].focusSkills }
        : null,
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-terra",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            "أنت مرشد مهني وتعليمي للطلاب. أجب بالعربية الواضحة والمهنية، وكن عملياً ومشجعاً من دون مبالغة. استفد من السياق المحفوظ للطالب عند ملاءمته، ولا تخترع خبرات أو نتائج أو معلومات. إذا احتجت تفاصيل ناقصة فاسأل سؤالاً محدداً. ساعد في السيرة الذاتية، المقابلات، اختيار مهارات للتعلم، تنظيم الدراسة، وعرض المشاريع. لا تدّعِ ضمان وظيفة أو نتيجة، ولا تذكر أسماء منصات أو أكاديميات أو أشخاص تعليميين خارجيين؛ استخدم مصطلحات أثر.",
        },
        {
          role: "user",
          content: JSON.stringify({ question: parsed.data.message, studentContext: context }),
        },
      ],
    });
    const reply = completion.choices[0]?.message.content?.trim();
    if (!reply) {
      res.status(502).json({ error: "The career assistant returned no reply" });
      return;
    }
    res.json(AskCareerAssistantResponse.parse({ reply }));
  },
);

router.post(
  "/ai/compare-career-assistant",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = CompareCareerAssistantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const userId = res.locals.userId as string;
    const now = Date.now();
    const previous = comparisonRequests.get(userId);
    if (previous && now - previous < 10_000) {
      res.status(429).json({ error: "انتظر قليلًا قبل طلب مقارنة أخرى." });
      return;
    }
    comparisonRequests.set(userId, now);
    if (comparisonRequests.size > 5_000) {
      for (const [id, timestamp] of comparisonRequests) {
        if (now - timestamp > 60_000) comparisonRequests.delete(id);
      }
    }

    try {
      const answers = await batchProcess(
        ["first", "second"] as const,
        async (_variant, index) => {
          const completion = await openai.chat.completions.create({
            model: index === 0 ? "gpt-5.6-luna" : "gpt-5.6-terra",
            max_completion_tokens: 8192,
            messages: [
              {
                role: "system",
                content:
                  "أجب عن سؤال الطالب بالعربية الواضحة وبأسلوب عملي. لا تفترض معلومات شخصية أو محفوظة عن الطالب، ولا تخترع حقائق أو نتائج. إذا احتجت تفاصيل ناقصة فاذكر الافتراض أو اسأل عنها. اجعل الرد مركزًا وقابلًا للتطبيق، ولا تذكر أسماء منصات أو أكاديميات أو أشخاص تعليميين خارجيين؛ استخدم مصطلحات أثر.",
              },
              { role: "user", content: parsed.data.message },
            ],
          });
          const answer = completion.choices[0]?.message.content?.trim();
          if (!answer) throw new Error("Assistant returned an empty answer");
          return answer;
        },
        { concurrency: 2, retries: 2, minTimeout: 750, maxTimeout: 5_000 },
      );
      res.json(CompareCareerAssistantResponse.parse({ answers }));
    } catch (error) {
      req.log.error(
        { errorType: error instanceof Error ? error.name : "UnknownError" },
        "Career answer comparison failed",
      );
      res.status(502).json({ error: "تعذّرت مقارنة الإجابتين الآن. حاول لاحقًا." });
    }
  },
);

export default router;
