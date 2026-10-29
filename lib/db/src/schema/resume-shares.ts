import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const resumeSharesTable = pgTable(
  "resume_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    token: text("token"),
    enabled: boolean("enabled").notNull().default(false),
    showName: boolean("show_name").notNull().default(false),
    showHeadline: boolean("show_headline").notNull().default(false),
    showUniversity: boolean("show_university").notNull().default(false),
    showMajor: boolean("show_major").notNull().default(false),
    showYearOfStudy: boolean("show_year_of_study").notNull().default(false),
    showSkills: boolean("show_skills").notNull().default(false),
    achievementIds: text("achievement_ids").array().notNull().default(sql`'{}'::text[]`),
    courseIds: text("course_ids").array().notNull().default(sql`'{}'::text[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("resume_shares_user_id_idx").on(table.userId),
    uniqueIndex("resume_shares_token_idx").on(table.token),
  ],
);

export const insertResumeShareSchema = createInsertSchema(resumeSharesTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertResumeShare = z.infer<typeof insertResumeShareSchema>;
export type ResumeShare = typeof resumeSharesTable.$inferSelect;
