import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const learningItemsTable = pgTable(
  "learning_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    source: text("source"),
    /** Non-null only for an automatically imported Academy lesson; prevents duplicate history items. */
    academyLessonId: uuid("academy_lesson_id"),
    /** Non-null for completion records created from an administrator-published platform course. */
    sectionCourseId: uuid("section_course_id"),
    subject: text("subject"),
    url: text("url"),
    notes: text("notes").notNull().default(""),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    status: text("status").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("learning_items_user_academy_lesson_idx").on(table.userId, table.academyLessonId),
    uniqueIndex("learning_items_user_section_course_idx").on(table.userId, table.sectionCourseId),
    index("learning_items_user_kind_created_idx").on(
      table.userId,
      table.kind,
      table.createdAt,
    ),
  ],
);

export const academyProgressTable = pgTable(
  "academy_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    completed: boolean("completed").notNull().default(false),
    quizScore: integer("quiz_score"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("academy_progress_user_lesson_idx").on(
      table.userId,
      table.lessonId,
    ),
  ],
);

export const insertLearningItemSchema = createInsertSchema(
  learningItemsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAcademyProgressSchema = createInsertSchema(
  academyProgressTable,
).omit({ id: true, updatedAt: true });
export type InsertLearningItem = z.infer<typeof insertLearningItemSchema>;
export type LearningItem = typeof learningItemsTable.$inferSelect;
export type InsertAcademyProgress = z.infer<typeof insertAcademyProgressSchema>;
export type AcademyProgress = typeof academyProgressTable.$inferSelect;
