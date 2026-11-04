import { createInsertSchema } from "drizzle-zod";
import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { achievementsTable } from "./achievements";

export const achievementAttachmentsTable = pgTable(
  "achievement_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievementsTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    url: text("url"),
    objectPath: text("object_path"),
    originalName: text("original_name"),
    mime: text("mime"),
    size: bigint("size", { mode: "number" }),
    status: text("status").notNull().default("ready"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("achievement_attachments_achievement_created_idx").on(
      table.achievementId,
      table.createdAt,
    ),
  ],
);

export const insertAchievementAttachmentSchema = createInsertSchema(
  achievementAttachmentsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertAchievementAttachment = z.infer<
  typeof insertAchievementAttachmentSchema
>;
export type AchievementAttachment = typeof achievementAttachmentsTable.$inferSelect;
