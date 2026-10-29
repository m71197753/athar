import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  index,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const careerPlansTable = pgTable(
  "career_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    targetRole: text("target_role").notNull(),
    timeframeDays: integer("timeframe_days").notNull(),
    overview: text("overview").notNull(),
    focusSkills: text("focus_skills").array().notNull().default(sql`'{}'::text[]`),
    weeklyReminderEnabled: boolean("weekly_reminder_enabled").notNull().default(false),
    reminderTaskId: uuid("reminder_task_id"),
    nextReminderAt: timestamp("next_reminder_at", { withTimezone: true }),
    reminderChannel: text("reminder_channel").notNull().default("in_app"),
    pushConsentAt: timestamp("push_consent_at", { withTimezone: true }),
    pushSubscription: jsonb("push_subscription").$type<{
      endpoint: string;
      keys: { p256dh: string; auth: string };
      roadmapPath: string;
      origin: string;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("career_plans_user_id_idx").on(table.userId)],
);

export const careerTasksTable = pgTable(
  "career_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    stage: integer("stage").notNull().default(1),
    status: text("status").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("career_tasks_user_stage_idx").on(table.userId, table.stage)],
);

export const insertCareerPlanSchema = createInsertSchema(careerPlansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCareerTaskSchema = createInsertSchema(careerTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCareerPlan = z.infer<typeof insertCareerPlanSchema>;
export type CareerPlan = typeof careerPlansTable.$inferSelect;
export type InsertCareerTask = z.infer<typeof insertCareerTaskSchema>;
export type CareerTask = typeof careerTasksTable.$inferSelect;
