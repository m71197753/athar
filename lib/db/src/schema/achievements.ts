import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const achievementsTable = pgTable(
  "achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    context: text("context").notNull(),
    challenge: text("challenge"),
    action: text("action").notNull(),
    result: text("result").notNull(),
    achievedOn: date("achieved_on", { mode: "string" }).notNull(),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    resumeBullet: text("resume_bullet"),
    interviewStory: text("interview_story"),
    serviceOffer: text("service_offer"),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("achievements_user_date_idx").on(table.userId, table.achievedOn)],
);

export const insertAchievementSchema = createInsertSchema(
  achievementsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievementsTable.$inferSelect;
