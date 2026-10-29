import { createInsertSchema } from "drizzle-zod";
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

type LanguageLevel = "A1" | "A2" | "B1" | "B2";

export type LanguagePageSettings = {
  title: string;
  subtitle: string;
  accentColor: string;
  enabledLanguages: string[];
  showConversation: boolean;
  showGamification: boolean;
  showProgress: boolean;
  showReviewList: boolean;
  showLeague: boolean;
  showFreeze: boolean;
  showPreferences: boolean;
  layoutOrder: "learning-first" | "game-first";
};

export type LanguageGameRules = {
  maxHearts: number;
  heartRegenMinutes: number;
  baseXp: number;
  accuracyBonusXp: number;
  reviewBonusXp: number;
  streakGemInterval: number;
  freezeCost: number;
  maxFreezeCredits: number;
  promotionCount: number;
  demotionCount: number;
};

export const DEFAULT_LANGUAGE_PAGE_SETTINGS: LanguagePageSettings = {
  title: "خطوة صغيرة، لغة أقوى",
  subtitle: "جلسة من ٣ إلى ٥ دقائق، فيها أسئلة تنتقل من المعنى إلى الاسترجاع والنطق.",
  accentColor: "#4338CA",
  enabledLanguages: ["en", "fr", "es", "de", "tr"],
  showConversation: true,
  showGamification: true,
  showProgress: true,
  showReviewList: true,
  showLeague: true,
  showFreeze: true,
  showPreferences: true,
  layoutOrder: "learning-first",
};

export const DEFAULT_LANGUAGE_GAME_RULES: LanguageGameRules = {
  maxHearts: 5,
  heartRegenMinutes: 240,
  baseXp: 10,
  accuracyBonusXp: 5,
  reviewBonusXp: 5,
  streakGemInterval: 7,
  freezeCost: 5,
  maxFreezeCredits: 3,
  promotionCount: 6,
  demotionCount: 6,
};

export const languageAdminSettingsTable = pgTable("language_admin_settings", {
  key: text("key").primaryKey().default("main"),
  page: jsonb("page").$type<LanguagePageSettings>().notNull().default(DEFAULT_LANGUAGE_PAGE_SETTINGS),
  game: jsonb("game").$type<LanguageGameRules>().notNull().default(DEFAULT_LANGUAGE_GAME_RULES),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: text("updated_by"),
});

export const languageContentItemsTable = pgTable("language_content_items", {
  id: text("id").primaryKey(),
  languageCode: text("language_code").notNull(),
  level: text("level").$type<LanguageLevel>().notNull(),
  kind: text("kind").notNull(),
  category: text("category").notNull(),
  partOfSpeech: text("part_of_speech"),
  english: text("english").notNull(),
  arabic: text("arabic").notNull(),
  pronunciationArabic: text("pronunciation_arabic"),
  exampleEnglish: text("example_english"),
  exampleArabic: text("example_arabic"),
  grammarNote: text("grammar_note"),
  difficulty: integer("difficulty").notNull().default(1),
  relatedWordIds: jsonb("related_word_ids").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  index("language_content_catalog_idx").on(table.languageCode, table.level, table.active),
]);

export const insertLanguageContentItemSchema = createInsertSchema(languageContentItemsTable).omit({
  updatedAt: true,
});

export type LanguageContentItemRow = typeof languageContentItemsTable.$inferSelect;
export type InsertLanguageContentItem = z.infer<typeof insertLanguageContentItemSchema>;
