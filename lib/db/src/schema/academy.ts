import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { achievementsTable } from "./achievements";
import { learningItemsTable } from "./learning";

/** Admin-authored, published course catalogue. */
export const academySubjectsTable = pgTable(
  "academy_subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    level: text("level").notNull().default("beginner"),
    skillTags: text("skill_tags").array().notNull().default(sql`'{}'::text[]`),
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("academy_subjects_published_position_idx").on(t.published, t.position)],
);

export const academyLessonsTable = pgTable(
  "academy_lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectId: uuid("subject_id").notNull().references(() => academySubjectsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull(),
    position: integer("position").notNull().default(0),
    estimatedMinutes: integer("estimated_minutes").notNull().default(10),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("academy_lessons_subject_published_position_idx").on(t.subjectId, t.published, t.position),
  ],
);

/** Public course attachments are only downloadable through a published lesson. */
export const academyCourseFilesTable = pgTable(
  "academy_course_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lessonId: uuid("lesson_id").notNull().references(() => academyLessonsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    originalName: text("original_name").notNull(),
    objectPath: text("object_path").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("academy_course_files_lesson_idx").on(t.lessonId)],
);

/** One timed or untimed exam belongs to a published subject; lessonId makes it an optional checkpoint. */
export const academyExamsTable = pgTable(
  "academy_exams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectId: uuid("subject_id").notNull().references(() => academySubjectsTable.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").references(() => academyLessonsTable.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    timeLimitSeconds: integer("time_limit_seconds"),
    passingScore: integer("passing_score").notNull().default(70),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("academy_exams_subject_published_idx").on(t.subjectId, t.published)],
);

export const academyQuestionsTable = pgTable(
  "academy_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examId: uuid("exam_id").notNull().references(() => academyExamsTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctOption: integer("correct_option").notNull(),
    explanation: text("explanation").notNull(),
    skillTags: text("skill_tags").array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [
    index("academy_questions_exam_position_idx").on(t.examId, t.position),
  ],
);

export const academyEnrollmentsTable = pgTable(
  "academy_enrollments",
  {
    userId: text("user_id").notNull(),
    subjectId: uuid("subject_id").notNull().references(() => academySubjectsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.subjectId] }),
    index("academy_enrollments_user_created_idx").on(t.userId, t.createdAt),
  ],
);

/** Student-owned uploads remain private behind owner-checked download routes. */
export const academyStudentFilesTable = pgTable(
  "academy_student_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    originalName: text("original_name").notNull(),
    objectPath: text("object_path").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("academy_student_files_owner_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("academy_student_files_object_path_idx").on(t.objectPath),
  ],
);

/** Searchable excerpts are namespaced by owner: null means published curriculum, never a student file. */
export const academySourceChunksTable = pgTable(
  "academy_source_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    ownerId: text("owner_id"),
    subjectId: uuid("subject_id"),
    title: text("title").notNull(),
    href: text("href").notNull(),
    position: integer("position").notNull(),
    content: text("content").notNull(),
    normalizedContent: text("normalized_content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("academy_source_chunks_scope_check", sql`(
      (${t.sourceType} = 'student_file' AND ${t.ownerId} IS NOT NULL AND ${t.subjectId} IS NULL)
      OR (${t.sourceType} IN ('lesson', 'course_file') AND ${t.ownerId} IS NULL AND ${t.subjectId} IS NOT NULL)
    )`),
    uniqueIndex("academy_source_chunks_source_position_idx").on(t.sourceType, t.sourceId, t.position),
    index("academy_source_chunks_owner_subject_idx").on(t.ownerId, t.subjectId, t.sourceType),
  ],
);

/** Attempt question snapshots preserve the exact exam and explanations seen by each student. */
export const academyAttemptsTable = pgTable(
  "academy_exam_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    examId: uuid("exam_id").notNull().references(() => academyExamsTable.id, { onDelete: "restrict" }),
    examTitle: text("exam_title").notNull(),
    timeLimitSeconds: integer("time_limit_seconds"),
    passingScore: integer("passing_score").notNull().default(70),
    questionCount: integer("question_count").notNull(),
    score: integer("score"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    achievementId: uuid("achievement_id").references(() => achievementsTable.id, { onDelete: "set null" }),
  },
  (t) => [
    index("academy_exam_attempts_owner_exam_started_idx").on(t.userId, t.examId, t.startedAt),
    uniqueIndex("academy_exam_attempts_open_idx").on(t.userId, t.examId).where(sql`${t.submittedAt} IS NULL`),
  ],
);

export const academyAttemptAnswersTable = pgTable(
  "academy_attempt_answers",
  {
    attemptId: uuid("attempt_id").notNull().references(() => academyAttemptsTable.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").notNull(),
    position: integer("position").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctOption: integer("correct_option").notNull(),
    explanation: text("explanation").notNull(),
    selectedOption: integer("selected_option"),
    isCorrect: boolean("is_correct").notNull().default(false),
    skillTags: text("skill_tags").array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [
    primaryKey({ columns: [t.attemptId, t.questionId] }),
    index("academy_attempt_answers_position_idx").on(t.attemptId, t.position),
  ],
);

/** Improvements are created only after the earlier attempt was explicitly reviewed. */
export const academyGrowthEvidenceTable = pgTable(
  "academy_growth_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    examId: uuid("exam_id").notNull().references(() => academyExamsTable.id, { onDelete: "cascade" }),
    fromAttemptId: uuid("from_attempt_id").notNull().references(() => academyAttemptsTable.id, { onDelete: "cascade" }),
    toAttemptId: uuid("to_attempt_id").notNull().references(() => academyAttemptsTable.id, { onDelete: "cascade" }),
    fromScore: integer("from_score").notNull(),
    toScore: integer("to_score").notNull(),
    achievementId: uuid("achievement_id").references(() => achievementsTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("academy_growth_evidence_improved_attempt_idx").on(t.toAttemptId),
    index("academy_growth_evidence_owner_created_idx").on(t.userId, t.createdAt),
  ],
);

/** Member-submitted resources remain private until reviewed by an administrator. */
export const academyCourseSubmissionsTable = pgTable(
  "academy_course_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    sourceUrl: text("source_url"),
    objectPath: text("object_path"),
    originalName: text("original_name"),
    mime: text("mime"),
    size: bigint("size", { mode: "number" }),
    status: text("status").notNull().default("uploading"),
    reviewNote: text("review_note"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    check("academy_course_submissions_status_check", sql`${t.status} IN ('uploading', 'pending', 'approved', 'rejected')`),
    check("academy_course_submissions_source_check", sql`(
      (${t.sourceUrl} IS NOT NULL AND ${t.objectPath} IS NULL AND ${t.originalName} IS NULL AND ${t.mime} IS NULL AND ${t.size} IS NULL)
      OR
      (${t.sourceUrl} IS NULL AND ${t.objectPath} IS NOT NULL AND ${t.originalName} IS NOT NULL AND ${t.mime} IS NOT NULL AND ${t.size} IS NOT NULL)
    )`),
    index("academy_course_submissions_owner_created_idx").on(t.ownerId, t.createdAt),
    index("academy_course_submissions_review_idx").on(t.status, t.createdAt),
    uniqueIndex("academy_course_submissions_object_path_idx").on(t.objectPath).where(sql`${t.objectPath} IS NOT NULL`),
  ],
);

export const insertAcademySubjectSchema = createInsertSchema(academySubjectsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type AcademySubject = typeof academySubjectsTable.$inferSelect;
export type AcademyLesson = typeof academyLessonsTable.$inferSelect;
export type AcademyCourseFile = typeof academyCourseFilesTable.$inferSelect;
export type AcademyCourseSubmission = typeof academyCourseSubmissionsTable.$inferSelect;
export type AcademyExam = typeof academyExamsTable.$inferSelect;
export type AcademyQuestion = typeof academyQuestionsTable.$inferSelect;
export type AcademyStudentFile = typeof academyStudentFilesTable.$inferSelect;
