import { and, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateStudentResumeBody,
  CreateStudentResumeResponse,
  DeleteStudentResumeParams,
  ListStudentResumesResponse,
  UpdateStudentResumeBody,
  UpdateStudentResumeParams,
  UpdateStudentResumeResponse,
} from "@workspace/api-zod";
import { db, studentResumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const MAX_RESUMES_PER_ORIGIN = 20;

function toStudentResume(row: typeof studentResumesTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    origin: row.origin,
    template: row.template,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/student/resumes", requireAuth, async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(studentResumesTable)
    .where(eq(studentResumesTable.userId, userId))
    .orderBy(desc(studentResumesTable.updatedAt), desc(studentResumesTable.createdAt))
    .limit(MAX_RESUMES_PER_ORIGIN * 2);

  res.json(ListStudentResumesResponse.parse(rows.map(toStudentResume)));
});

router.post("/student/resumes", requireAuth, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const parsed = CreateStudentResumeBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.title.trim()) {
    res.status(400).json({ error: parsed.success ? "Resume title is required" : parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [existing] = await db
    .select({ total: count() })
    .from(studentResumesTable)
    .where(and(eq(studentResumesTable.userId, userId), eq(studentResumesTable.origin, parsed.data.origin)));
  if ((existing?.total ?? 0) >= MAX_RESUMES_PER_ORIGIN) {
    res.status(429).json({ error: "وصلت للحد الأقصى لعدد السير المحفوظة." });
    return;
  }

  const [row] = await db
    .insert(studentResumesTable)
    .values({
      userId,
      title: parsed.data.title.trim(),
      origin: parsed.data.origin,
      template: parsed.data.template,
      content: parsed.data.content,
    })
    .returning();

  res.status(201).json(CreateStudentResumeResponse.parse(toStudentResume(row)));
});

router.put("/student/resumes/:id", requireAuth, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const params = UpdateStudentResumeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateStudentResumeBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.title.trim()) {
    res.status(400).json({ error: parsed.success ? "Resume title is required" : parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [row] = await db
    .update(studentResumesTable)
    .set({
      title: parsed.data.title.trim(),
      origin: parsed.data.origin,
      template: parsed.data.template,
      content: parsed.data.content,
      updatedAt: new Date(),
    })
    .where(and(eq(studentResumesTable.id, params.data.id), eq(studentResumesTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Resume draft not found" });
    return;
  }

  res.json(UpdateStudentResumeResponse.parse(toStudentResume(row)));
});

router.delete("/student/resumes/:id", requireAuth, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const params = DeleteStudentResumeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [deleted] = await db
    .delete(studentResumesTable)
    .where(and(eq(studentResumesTable.id, params.data.id), eq(studentResumesTable.userId, userId)))
    .returning({ id: studentResumesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Resume draft not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
