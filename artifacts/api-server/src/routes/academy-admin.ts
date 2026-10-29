import { Router, type IRouter, type Response } from "express";
import {
  ConfirmAdminAcademyCourseFileParams,
  ConfirmAdminAcademyCourseFileResponse,
  CreateAdminAcademyExamBody,
  CreateAdminAcademyExamResponse,
  CreateAdminAcademyLessonBody,
  CreateAdminAcademyLessonResponse,
  CreateAdminAcademySubjectBody,
  CreateAdminAcademySubjectResponse,
  DeleteAdminAcademyCourseFileParams,
  DeleteAdminAcademyCourseFileResponse,
  ListAdminAcademyResponse,
  RequestAdminAcademyCourseFileUploadBody,
  RequestAdminAcademyCourseFileUploadParams,
  RequestAdminAcademyCourseFileUploadResponse,
  SaveAdminAcademyQuestionsBody,
  SaveAdminAcademyQuestionsParams,
  SaveAdminAcademyQuestionsResponse,
  UpdateAdminAcademyExamBody,
  UpdateAdminAcademyExamParams,
  UpdateAdminAcademyExamResponse,
  UpdateAdminAcademyLessonBody,
  UpdateAdminAcademyLessonParams,
  UpdateAdminAcademyLessonResponse,
  UpdateAdminAcademySubjectBody,
  UpdateAdminAcademySubjectParams,
  UpdateAdminAcademySubjectResponse,
} from "@workspace/api-zod";
import {
  academyCourseFilesTable,
  academyExamsTable,
  academyLessonsTable,
  academyQuestionsTable,
  academySourceChunksTable,
  academySubjectsTable,
  db,
} from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  chunkAcademyText,
  extractAcademyText,
  isAcademyVideoMime,
  MAX_ACADEMY_FILE_BYTES,
  MAX_ACADEMY_VIDEO_BYTES,
  normalizeAcademyText,
  supportedAcademyCourseUpload,
  type AcademyCourseUploadMime,
  type AcademyMime,
} from "../lib/academy-content";
import {
  createAcademyUpload,
  deleteAcademyAsset,
  readAcademyAsset,
  validateAcademyUpload,
} from "../lib/academy-storage";

const router: IRouter = Router();
router.use("/admin/academy", requireAuth, requireAdmin);

router.get("/admin/academy", async (_req, res): Promise<void> => {
  noStore(res);
  const subjects = await db.select().from(academySubjectsTable)
    .orderBy(asc(academySubjectsTable.position), asc(academySubjectsTable.title));
  const subjectIds = subjects.map((row) => row.id);
  const [lessons, exams] = await Promise.all([
    subjectIds.length
      ? db.select().from(academyLessonsTable).where(inArray(academyLessonsTable.subjectId, subjectIds))
        .orderBy(asc(academyLessonsTable.position))
      : Promise.resolve([]),
    subjectIds.length
      ? db.select().from(academyExamsTable).where(inArray(academyExamsTable.subjectId, subjectIds))
        .orderBy(asc(academyExamsTable.createdAt))
      : Promise.resolve([]),
  ]);
  const lessonIds = lessons.map((row) => row.id);
  const examIds = exams.map((row) => row.id);
  const [files, questions] = await Promise.all([
    lessonIds.length
      ? db.select().from(academyCourseFilesTable).where(and(
        inArray(academyCourseFilesTable.lessonId, lessonIds),
        eq(academyCourseFilesTable.status, "ready"),
      ))
      : Promise.resolve([]),
    examIds.length
      ? db.select().from(academyQuestionsTable).where(inArray(academyQuestionsTable.examId, examIds))
        .orderBy(asc(academyQuestionsTable.position))
      : Promise.resolve([]),
  ]);
  const questionsByExam = groupBy(questions, (row) => row.examId);
  const filesByLesson = groupBy(files, (row) => row.lessonId);
  const examBySubject = groupBy(exams, (row) => row.subjectId);
  const lessonsBySubject = groupBy(lessons, (row) => row.subjectId);
  const output = {
    subjects: subjects.map((subject) => ({
      id: subject.id,
      slug: subject.slug,
      title: subject.title,
      description: subject.description,
      level: subject.level,
      skillTags: subject.skillTags,
      lessonCount: lessonsBySubject[subject.id]?.length ?? 0,
      completedLessons: 0,
      enrolled: false,
      position: subject.position,
      published: subject.published,
      lessons: (lessonsBySubject[subject.id] ?? []).map((lesson) => ({
        id: lesson.id,
        subjectId: lesson.subjectId,
        title: lesson.title,
        summary: lesson.summary,
        position: lesson.position,
        estimatedMinutes: lesson.estimatedMinutes,
        completed: false,
        subjectTitle: subject.title,
        body: lesson.body,
        published: lesson.published,
        files: (filesByLesson[lesson.id] ?? []).map(courseFilePublic),
      })),
      exams: (examBySubject[subject.id] ?? []).map((exam) => ({
        id: exam.id,
        subjectId: exam.subjectId,
        lessonId: exam.lessonId,
        title: exam.title,
        description: exam.description,
        timeLimitSeconds: exam.timeLimitSeconds,
        passingScore: exam.passingScore,
        published: exam.published,
        questionCount: questionsByExam[exam.id]?.length ?? 0,
        questions: (questionsByExam[exam.id] ?? []).map((question) => ({
          id: question.id, position: question.position, prompt: question.prompt,
          options: question.options, correctOption: question.correctOption,
          explanation: question.explanation, skillTags: question.skillTags,
        })),
      })),
    })),
  };
  res.json(ListAdminAcademyResponse.parse(output));
});

router.post("/admin/academy/subjects", async (req, res): Promise<void> => {
  noStore(res);
  const parsed = CreateAdminAcademySubjectBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  if (parsed.data.published) {
    return void res.status(400).json({ error: "Save the subject as a draft, add a published lesson, then publish it" });
  }
  try {
    const [subject] = await db.insert(academySubjectsTable).values(subjectValues(parsed.data))
      .returning();
    res.status(201).json(CreateAdminAcademySubjectResponse.parse(subjectDetail(subject, [], [], [], [])));
  } catch {
    res.status(400).json({ error: "The subject slug is already in use or its fields are invalid" });
  }
});

router.put("/admin/academy/subjects/:subjectId", async (req, res): Promise<void> => {
  noStore(res);
  const params = UpdateAdminAcademySubjectParams.safeParse(req.params);
  const parsed = UpdateAdminAcademySubjectBody.safeParse(req.body);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  if (parsed.data.published) {
    const [publishedLesson] = await db.select({ id: academyLessonsTable.id }).from(academyLessonsTable)
      .where(and(
        eq(academyLessonsTable.subjectId, params.data.subjectId),
        eq(academyLessonsTable.published, true),
      )).limit(1);
    if (!publishedLesson) {
      return void res.status(400).json({ error: "Publish at least one lesson before publishing a subject" });
    }
  }
  try {
    const [subject] = await db.update(academySubjectsTable).set({
      ...subjectValues(parsed.data), updatedAt: new Date(),
    }).where(eq(academySubjectsTable.id, params.data.subjectId)).returning();
    if (!subject) return void res.status(404).json({ error: "Subject not found" });
    const [lessons, exams] = await Promise.all([
      db.select().from(academyLessonsTable).where(eq(academyLessonsTable.subjectId, subject.id)),
      db.select().from(academyExamsTable).where(eq(academyExamsTable.subjectId, subject.id)),
    ]);
    await Promise.all(lessons.filter((lesson) => lesson.published)
      .map((lesson) => replaceLessonIndex(lesson, subject.title)));
    const [files, questions] = await Promise.all([
      lessons.length
        ? db.select().from(academyCourseFilesTable).where(and(
          inArray(academyCourseFilesTable.lessonId, lessons.map((item) => item.id)),
          eq(academyCourseFilesTable.status, "ready"),
        ))
        : Promise.resolve([]),
      exams.length
        ? db.select().from(academyQuestionsTable).where(inArray(
          academyQuestionsTable.examId, exams.map((item) => item.id),
        ))
        : Promise.resolve([]),
    ]);
    res.json(UpdateAdminAcademySubjectResponse.parse(
      subjectDetail(subject, lessons, exams, files, questions),
    ));
  } catch {
    res.status(400).json({ error: "The subject slug is already in use or its fields are invalid" });
  }
});

router.post("/admin/academy/lessons", async (req, res): Promise<void> => {
  noStore(res);
  const parsed = CreateAdminAcademyLessonBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const [subject] = await db.select().from(academySubjectsTable)
    .where(eq(academySubjectsTable.id, parsed.data.subjectId)).limit(1);
  if (!subject) return void res.status(400).json({ error: "Choose an existing subject" });
  const [lesson] = await db.insert(academyLessonsTable).values({
    ...lessonValues(parsed.data),
    published: parsed.data.published,
  }).returning();
  if (lesson.published) await replaceLessonIndex(lesson, subject.title);
  res.status(201).json(CreateAdminAcademyLessonResponse.parse(lessonDetail(lesson, subject.title, [])));
});

router.put("/admin/academy/lessons/:lessonId", async (req, res): Promise<void> => {
  noStore(res);
  const params = UpdateAdminAcademyLessonParams.safeParse(req.params);
  const parsed = UpdateAdminAcademyLessonBody.safeParse(req.body);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const [subject] = await db.select().from(academySubjectsTable)
    .where(eq(academySubjectsTable.id, parsed.data.subjectId)).limit(1);
  if (!subject) return void res.status(400).json({ error: "Choose an existing subject" });
  const [lesson] = await db.update(academyLessonsTable).set({
    ...lessonValues(parsed.data),
    updatedAt: new Date(),
  }).where(eq(academyLessonsTable.id, params.data.lessonId)).returning();
  if (!lesson) return void res.status(404).json({ error: "Lesson not found" });
  if (lesson.published) await replaceLessonIndex(lesson, subject.title);
  else await db.delete(academySourceChunksTable).where(and(
    eq(academySourceChunksTable.sourceType, "lesson"),
    eq(academySourceChunksTable.sourceId, lesson.id),
  ));
  const files = await db.select().from(academyCourseFilesTable).where(and(
    eq(academyCourseFilesTable.lessonId, lesson.id),
    eq(academyCourseFilesTable.status, "ready"),
  ));
  await Promise.all(files.map((file) => db.update(academySourceChunksTable).set({
    subjectId: lesson.subjectId,
    href: `/academy/lessons/${lesson.id}`,
  }).where(and(
    eq(academySourceChunksTable.sourceType, "course_file"),
    eq(academySourceChunksTable.sourceId, file.id),
  ))));
  res.json(UpdateAdminAcademyLessonResponse.parse(lessonDetail(lesson, subject.title, files)));
});

router.post("/admin/academy/lessons/:lessonId/upload-url", async (req, res): Promise<void> => {
  noStore(res);
  const params = RequestAdminAcademyCourseFileUploadParams.safeParse(req.params);
  const parsed = RequestAdminAcademyCourseFileUploadBody.safeParse(req.body);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const { title, originalName, mime, size } = parsed.data;
  const maxSize = isAcademyVideoMime(mime) ? MAX_ACADEMY_VIDEO_BYTES : MAX_ACADEMY_FILE_BYTES;
  if (size > maxSize || !supportedAcademyCourseUpload(originalName, mime)) {
    return void res.status(400).json({ error: "Use PDF, DOCX, TXT, MP4, or WebM within the upload size limit" });
  }
  const [lesson] = await db.select().from(academyLessonsTable)
    .where(eq(academyLessonsTable.id, params.data.lessonId)).limit(1);
  if (!lesson) return void res.status(404).json({ error: "Lesson not found" });
  const upload = await createAcademyUpload();
  const [file] = await db.insert(academyCourseFilesTable).values({
    lessonId: lesson.id, title: title.trim(), originalName: safeFileName(originalName),
    objectPath: upload.objectPath, mime, size, status: "pending",
  }).returning();
  res.status(201).json(RequestAdminAcademyCourseFileUploadResponse.parse({
    id: file.id, uploadUrl: upload.uploadUrl,
  }));
});

router.post("/admin/academy/course-files/:fileId/confirm", async (req, res): Promise<void> => {
  noStore(res);
  const params = ConfirmAdminAcademyCourseFileParams.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  const [record] = await db.select({
    file: academyCourseFilesTable,
    lesson: academyLessonsTable,
    subject: academySubjectsTable,
  }).from(academyCourseFilesTable)
    .innerJoin(academyLessonsTable, eq(academyLessonsTable.id, academyCourseFilesTable.lessonId))
    .innerJoin(academySubjectsTable, eq(academySubjectsTable.id, academyLessonsTable.subjectId))
    .where(eq(academyCourseFilesTable.id, params.data.fileId)).limit(1);
  if (!record) return void res.status(404).json({ error: "Attachment not found" });
  if (record.file.status === "ready") {
    return void res.json(ConfirmAdminAcademyCourseFileResponse.parse(courseFilePublic(record.file)));
  }
  if (!supportedAcademyCourseUpload(record.file.originalName, record.file.mime)) {
    return void res.status(400).json({ error: "Unsupported file type" });
  }
  const confirmedPath = await validateAcademyUpload(
    record.file.objectPath, record.file.mime as AcademyCourseUploadMime, record.file.size,
  );
  if (!confirmedPath) return void res.status(400).json({ error: "The uploaded file did not pass validation" });
  try {
    const chunks = isAcademyVideoMime(record.file.mime)
      ? []
      : chunkAcademyText(await extractAcademyText(
          await readAcademyAsset(confirmedPath),
          record.file.mime as AcademyMime,
        ));
    const [saved] = await db.transaction(async (tx) => {
      const [updated] = await tx.update(academyCourseFilesTable).set({
        objectPath: confirmedPath, status: "ready",
      }).where(and(
        eq(academyCourseFilesTable.id, record.file.id),
        eq(academyCourseFilesTable.status, "pending"),
      )).returning();
      if (!updated) return [];
      if (chunks.length) {
        await tx.insert(academySourceChunksTable).values(chunks.map((content, position) => ({
          sourceType: "course_file",
          sourceId: updated.id,
          ownerId: null,
          subjectId: record.subject.id,
          title: `${record.file.title} — ${record.file.originalName}`,
          href: `/academy/lessons/${record.lesson.id}`,
          position,
          content,
          normalizedContent: normalizeAcademyText(content),
        })));
      }
      return [updated];
    });
    if (!saved) {
      await deleteAcademyAsset(confirmedPath);
      const [existing] = await db.select().from(academyCourseFilesTable)
        .where(eq(academyCourseFilesTable.id, record.file.id)).limit(1);
      if (existing?.status === "ready") {
        return void res.json(ConfirmAdminAcademyCourseFileResponse.parse(courseFilePublic(existing)));
      }
      return void res.status(409).json({ error: "Upload confirmation is already in progress" });
    }
    res.json(ConfirmAdminAcademyCourseFileResponse.parse(courseFilePublic(saved)));
  } catch {
    await deleteAcademyAsset(confirmedPath);
    await db.delete(academyCourseFilesTable).where(eq(academyCourseFilesTable.id, record.file.id));
    res.status(400).json({ error: "We could not extract searchable text from this document" });
  }
});

router.delete("/admin/academy/course-files/:fileId", async (req, res): Promise<void> => {
  noStore(res);
  const params = DeleteAdminAcademyCourseFileParams.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  const [file] = await db.select().from(academyCourseFilesTable)
    .where(eq(academyCourseFilesTable.id, params.data.fileId)).limit(1);
  if (!file) return void res.status(404).json({ error: "Attachment not found" });
  await deleteAcademyAsset(file.objectPath);
  await db.transaction(async (tx) => {
    await tx.delete(academySourceChunksTable).where(and(
      eq(academySourceChunksTable.sourceType, "course_file"),
      eq(academySourceChunksTable.sourceId, file.id),
    ));
    await tx.delete(academyCourseFilesTable).where(eq(academyCourseFilesTable.id, file.id));
  });
  res.sendStatus(204);
});

router.post("/admin/academy/exams", async (req, res): Promise<void> => {
  noStore(res);
  const parsed = CreateAdminAcademyExamBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const issue = await validateExamReferences(parsed.data);
  if (issue) return void res.status(400).json({ error: issue });
  if (parsed.data.published) {
    return void res.status(400).json({ error: "Save the exam as a draft, add 10–200 explained questions, then publish it" });
  }
  const [exam] = await db.insert(academyExamsTable).values(examValues(parsed.data)).returning();
  res.status(201).json(CreateAdminAcademyExamResponse.parse({ ...exam, questionCount: 0 }));
});

router.put("/admin/academy/exams/:examId", async (req, res): Promise<void> => {
  noStore(res);
  const params = UpdateAdminAcademyExamParams.safeParse(req.params);
  const parsed = UpdateAdminAcademyExamBody.safeParse(req.body);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const issue = await validateExamReferences(parsed.data);
  if (issue) return void res.status(400).json({ error: issue });
  if (parsed.data.published) {
    const questions = await db.select().from(academyQuestionsTable)
      .where(eq(academyQuestionsTable.examId, params.data.examId));
    if (questions.length < 10 || questions.length > 200) {
      return void res.status(400).json({ error: "A published exam must contain between 10 and 200 questions with explanations" });
    }
    const [subject] = await db.select({ published: academySubjectsTable.published })
      .from(academySubjectsTable).where(eq(academySubjectsTable.id, parsed.data.subjectId)).limit(1);
    if (!subject?.published) return void res.status(400).json({ error: "Publish the subject before publishing its exam" });
  }
  const [exam] = await db.update(academyExamsTable).set({
    ...examValues(parsed.data), updatedAt: new Date(),
  }).where(eq(academyExamsTable.id, params.data.examId)).returning();
  if (!exam) return void res.status(404).json({ error: "Exam not found" });
  const questions = await db.select({ id: academyQuestionsTable.id })
    .from(academyQuestionsTable).where(eq(academyQuestionsTable.examId, exam.id));
  res.json(UpdateAdminAcademyExamResponse.parse({ ...exam, questionCount: questions.length }));
});

router.put("/admin/academy/exams/:examId/questions", async (req, res): Promise<void> => {
  noStore(res);
  const params = SaveAdminAcademyQuestionsParams.safeParse(req.params);
  const parsed = SaveAdminAcademyQuestionsBody.safeParse(req.body);
  if (!params.success) return void res.status(400).json({ error: params.error.message });
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  if (parsed.data.questions.some((question) => question.correctOption >= question.options.length)) {
    return void res.status(400).json({ error: "Each correct answer must match an available choice" });
  }
  const [exam] = await db.select().from(academyExamsTable)
    .where(eq(academyExamsTable.id, params.data.examId)).limit(1);
  if (!exam) return void res.status(404).json({ error: "Exam not found" });
  if (exam.published && parsed.data.questions.length < 10) {
    return void res.status(400).json({ error: "A published exam must keep at least 10 questions" });
  }
  const saved = await db.transaction(async (tx) => {
    await tx.delete(academyQuestionsTable).where(eq(academyQuestionsTable.examId, exam.id));
    return tx.insert(academyQuestionsTable).values(parsed.data.questions.map((question, position) => ({
      examId: exam.id,
      position,
      prompt: question.prompt.trim(),
      options: question.options.map((option) => option.trim()),
      correctOption: question.correctOption,
      explanation: question.explanation.trim(),
      skillTags: cleanTags(question.skillTags),
    }))).returning();
  });
  res.json(SaveAdminAcademyQuestionsResponse.parse(saved));
});

async function replaceLessonIndex(lesson: typeof academyLessonsTable.$inferSelect, subjectTitle: string) {
  const content = `${lesson.title}\n${lesson.summary}\n${lesson.body}`;
  const chunks = chunkAcademyText(content);
  await db.transaction(async (tx) => {
    await tx.delete(academySourceChunksTable).where(and(
      eq(academySourceChunksTable.sourceType, "lesson"),
      eq(academySourceChunksTable.sourceId, lesson.id),
    ));
    await tx.insert(academySourceChunksTable).values(chunks.map((part, position) => ({
      sourceType: "lesson", sourceId: lesson.id, ownerId: null, subjectId: lesson.subjectId,
      title: `${subjectTitle} — ${lesson.title}`,
      href: `/academy/lessons/${lesson.id}`,
      position, content: part, normalizedContent: normalizeAcademyText(part),
    })));
  });
}

async function validateExamReferences(input: {
  subjectId: string;
  lessonId: string | null;
}) {
  const [subject] = await db.select({ id: academySubjectsTable.id }).from(academySubjectsTable)
    .where(eq(academySubjectsTable.id, input.subjectId)).limit(1);
  if (!subject) return "Choose an existing subject";
  if (input.lessonId) {
    const [lesson] = await db.select({ id: academyLessonsTable.id }).from(academyLessonsTable)
      .where(and(
        eq(academyLessonsTable.id, input.lessonId),
        eq(academyLessonsTable.subjectId, input.subjectId),
      )).limit(1);
    if (!lesson) return "The exam checkpoint must belong to the selected subject";
  }
  return null;
}

function subjectValues(input: {
  slug: string; title: string; description: string; level: string;
  skillTags: string[]; position: number; published: boolean;
}) {
  return {
    slug: input.slug.trim().toLowerCase(),
    title: input.title.trim(),
    description: input.description.trim(),
    level: input.level,
    skillTags: cleanTags(input.skillTags),
    position: input.position,
    published: input.published,
  };
}

function lessonValues(input: {
  subjectId: string; title: string; summary: string; body: string;
  position: number; estimatedMinutes: number; published: boolean;
}) {
  return {
    subjectId: input.subjectId,
    title: input.title.trim(),
    summary: input.summary.trim(),
    body: input.body.trim(),
    position: input.position,
    estimatedMinutes: input.estimatedMinutes,
    published: input.published,
  };
}

function examValues(input: {
  subjectId: string; lessonId: string | null; title: string; description: string;
  timeLimitSeconds: number | null; passingScore: number; published: boolean;
}) {
  return {
    subjectId: input.subjectId,
    lessonId: input.lessonId,
    title: input.title.trim(),
    description: input.description.trim(),
    timeLimitSeconds: input.timeLimitSeconds,
    passingScore: input.passingScore,
    published: input.published,
  };
}

function subjectDetail(
  subject: typeof academySubjectsTable.$inferSelect,
  lessons: (typeof academyLessonsTable.$inferSelect)[],
  exams: (typeof academyExamsTable.$inferSelect)[],
  files: (typeof academyCourseFilesTable.$inferSelect)[],
  questions: (typeof academyQuestionsTable.$inferSelect)[],
) {
  const filesByLesson = groupBy(files, (file) => file.lessonId);
  const questionsByExam = groupBy(questions, (question) => question.examId);
  return {
    id: subject.id,
    slug: subject.slug,
    title: subject.title,
    description: subject.description,
    level: subject.level,
    skillTags: subject.skillTags,
    lessonCount: lessons.filter((lesson) => lesson.published).length,
    completedLessons: 0,
    enrolled: false,
    position: subject.position,
    published: subject.published,
    lessons: lessons.map((lesson) => lessonDetail(
      lesson, subject.title, filesByLesson[lesson.id] ?? [],
    )),
    exams: exams.map((exam) => ({
      id: exam.id, subjectId: exam.subjectId, lessonId: exam.lessonId,
      title: exam.title, description: exam.description, timeLimitSeconds: exam.timeLimitSeconds,
      passingScore: exam.passingScore, published: exam.published,
      questionCount: questionsByExam[exam.id]?.length ?? 0,
      questions: (questionsByExam[exam.id] ?? []).map((question) => ({
        id: question.id, position: question.position, prompt: question.prompt,
        options: question.options, correctOption: question.correctOption,
        explanation: question.explanation, skillTags: question.skillTags,
      })),
    })),
  };
}

function lessonDetail(
  lesson: typeof academyLessonsTable.$inferSelect,
  subjectTitle: string,
  files: (typeof academyCourseFilesTable.$inferSelect)[],
) {
  return {
    id: lesson.id, subjectId: lesson.subjectId, title: lesson.title,
    summary: lesson.summary, position: lesson.position, estimatedMinutes: lesson.estimatedMinutes,
    completed: false, subjectTitle, body: lesson.body, published: lesson.published,
    files: files.filter((file) => file.status === "ready").map(courseFilePublic),
  };
}

function courseFilePublic(file: typeof academyCourseFilesTable.$inferSelect) {
  return {
    id: file.id, lessonId: file.lessonId, title: file.title,
    originalName: file.originalName, mime: file.mime, size: file.size,
    downloadUrl: `/api/academy/course-files/${file.id}/download`,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const group = key(item);
    (groups[group] ??= []).push(item);
    return groups;
  }, {});
}

function cleanTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 30);
}

function safeFileName(name: string) {
  return name.replace(/[\\/\r\n\0]/g, "_").trim().slice(0, 180);
}

function noStore(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie, Authorization");
}

export default router;
