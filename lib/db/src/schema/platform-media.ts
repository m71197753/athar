import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const platformMediaAssetsTable = pgTable(
  "platform_media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull(),
    originalName: text("original_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    objectPath: text("object_path").notNull(),
    status: text("status").notNull().default("uploading"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("platform_media_owner_created_idx").on(table.ownerId, table.createdAt),
    index("platform_media_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const insertPlatformMediaAssetSchema = createInsertSchema(platformMediaAssetsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPlatformMediaAsset = z.infer<typeof insertPlatformMediaAssetSchema>;
export type PlatformMediaAsset = typeof platformMediaAssetsTable.$inferSelect;
