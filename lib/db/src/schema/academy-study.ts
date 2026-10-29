import { createInsertSchema } from "drizzle-zod";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { academyStudentFilesTable } from "./academy";

export type AcademyStudyGuideData = {
  title: string;
  overview: string;
  keyPoints: { heading: string; detail: string }[];
  terms: { term: string; meaning: string }[];
  reviewQuestions: { question: string; answer: string }[];
};

export type AcademyStoredQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
};

export type AcademyStoredQuizAnswer = {
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
};

export type AcademyQuizTopicResult = {
  topic: string;
  correctCount: number;
  questionCount: number;
  score: number;
};

/** One private saved study guide per student-owned source file. */
export const academyStudentStudyGuidesTable = pgTable(
  "academy_student_study_guides",
  {
    fileId: uuid("file_id").primaryKey().references(() => academyStudentFilesTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    guide: jsonb("guide").$type<AcademyStudyGuideData>().notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("academy_student_study_guides_owner_idx").on(t.userId, t.generatedAt)],
);

export const insertAcademyStudentStudyGuideSchema = createInsertSchema(academyStudentStudyGuidesTable).omit({
  generatedAt: true,
});
export type InsertAcademyStudentStudyGuide = z.infer<typeof insertAcademyStudentStudyGuideSchema>;

/** AI-created private quizzes keep answer keys server-side for trusted practice scoring. */
export const academyStudentFileQuizzesTable = pgTable(
  "academy_student_file_quizzes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    fileId: uuid("file_id").notNull().references(() => academyStudentFilesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    questions: jsonb("questions").$type<AcademyStoredQuizQuestion[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("academy_student_file_quizzes_owner_file_idx").on(t.userId, t.fileId, t.createdAt),
    index("academy_student_file_quizzes_file_idx").on(t.fileId),
  ],
);

export const insertAcademyStudentFileQuizSchema = createInsertSchema(academyStudentFileQuizzesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAcademyStudentFileQuiz = z.infer<typeof insertAcademyStudentFileQuizSchema>;

/** Practice scores are private, server-graded, and never create professional achievements. */
export const academyStudentFileQuizAttemptsTable = pgTable(
  "academy_student_file_quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    quizId: uuid("quiz_id").notNull().references(() => academyStudentFileQuizzesTable.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    correctCount: integer("correct_count").notNull(),
    questionCount: integer("question_count").notNull(),
    level: text("level").notNull(),
    answers: jsonb("answers").$type<AcademyStoredQuizAnswer[]>().notNull(),
    topicResults: jsonb("topic_results").$type<AcademyQuizTopicResult[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("academy_student_file_quiz_attempts_owner_created_idx").on(t.userId, t.createdAt),
    index("academy_student_file_quiz_attempts_quiz_created_idx").on(t.quizId, t.createdAt),
  ],
);

export const insertAcademyStudentFileQuizAttemptSchema = createInsertSchema(academyStudentFileQuizAttemptsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAcademyStudentFileQuizAttempt = z.infer<typeof insertAcademyStudentFileQuizAttemptSchema>;
