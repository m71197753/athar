import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type StoredLanguageAnswer = {
  contentId: string;
  mode: "choice" | "listening" | "order" | "recall" | "pronunciation";
  isCorrect: boolean;
  pronunciationScore?: number | null;
  responseMs: number;
  quality: number;
  intervalMinutes: number;
};

export const languageReviewStatesTable = pgTable(
  "language_review_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    languageCode: text("language_code").notNull(),
    level: text("level").notNull(),
    contentId: text("content_id").notNull(),
    repetitions: integer("repetitions").notNull().default(0),
    intervalMinutes: integer("interval_minutes").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    lastQuality: integer("last_quality").notNull(),
    lastResponseMs: integer("last_response_ms").notNull(),
    correctCount: integer("correct_count").notNull().default(0),
    incorrectCount: integer("incorrect_count").notNull().default(0),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("language_review_user_item_idx").on(
      table.userId,
      table.languageCode,
      table.contentId,
    ),
    index("language_review_due_idx").on(
      table.userId,
      table.languageCode,
      table.dueAt,
    ),
  ],
);

export const languagePracticeSessionsTable = pgTable(
  "language_practice_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionRef: uuid("session_ref").notNull(),
    userId: text("user_id").notNull(),
    languageCode: text("language_code").notNull(),
    level: text("level").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    correctAnswers: integer("correct_answers").notNull(),
    elapsedSeconds: integer("elapsed_seconds").notNull(),
    answers: jsonb("answers").$type<StoredLanguageAnswer[]>().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("language_session_user_ref_idx").on(
      table.userId,
      table.sessionRef,
    ),
    index("language_session_user_completed_idx").on(
      table.userId,
      table.languageCode,
      table.completedAt,
    ),
  ],
);

export const languageGamificationProfilesTable = pgTable(
  "language_gamification_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    languageCode: text("language_code").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    xpTotal: integer("xp_total").notNull().default(0),
    gems: integer("gems").notNull().default(0),
    hearts: integer("hearts").notNull().default(5),
    heartsUpdatedAt: timestamp("hearts_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    currentStreak: integer("current_streak").notNull().default(0),
    bestStreak: integer("best_streak").notNull().default(0),
    lastActiveDay: text("last_active_day"),
    streakFreezeCredits: integer("streak_freeze_credits").notNull().default(0),
    soundEnabled: boolean("sound_enabled").notNull().default(true),
    vibrationEnabled: boolean("vibration_enabled").notNull().default(true),
    tier: text("tier").notNull().default("bronze"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("language_game_profile_user_lang_idx").on(
      table.userId,
      table.languageCode,
    ),
  ],
);

export const languageWeeklyLeagueMembersTable = pgTable(
  "language_weekly_league_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    languageCode: text("language_code").notNull(),
    weekStart: text("week_start").notNull(),
    tier: text("tier").notNull(),
    groupNumber: integer("group_number").notNull(),
    weeklyXp: integer("weekly_xp").notNull().default(0),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("language_league_member_user_week_idx").on(
      table.userId,
      table.languageCode,
      table.weekStart,
    ),
    index("language_league_group_members_idx").on(
      table.languageCode,
      table.weekStart,
      table.tier,
      table.groupNumber,
      table.weeklyXp,
    ),
  ],
);

export const insertLanguageReviewStateSchema = createInsertSchema(
  languageReviewStatesTable,
).omit({ id: true, updatedAt: true });
export const insertLanguagePracticeSessionSchema = createInsertSchema(
  languagePracticeSessionsTable,
).omit({ id: true, completedAt: true });

export type InsertLanguageReviewState = z.infer<typeof insertLanguageReviewStateSchema>;
export type LanguageReviewState = typeof languageReviewStatesTable.$inferSelect;
export type InsertLanguagePracticeSession = z.infer<typeof insertLanguagePracticeSessionSchema>;
export type LanguagePracticeSession = typeof languagePracticeSessionsTable.$inferSelect;
export type LanguageGamificationProfile = typeof languageGamificationProfilesTable.$inferSelect;
export type LanguageWeeklyLeagueMember = typeof languageWeeklyLeagueMembersTable.$inferSelect;
