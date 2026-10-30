import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export type PlatformSectionBlock = {
  unitId?: string;
  type: "text" | "link" | "media";
  mediaType?: "image" | "audio" | "video" | "file";
  title: string;
  body: string;
  url: string;
};

export type PlatformSectionCourse = {
  id: string;
  title: string;
  description: string;
  units?: Array<{ id: string; title: string; description: string }>;
  skills?: string[];
  materials: PlatformSectionBlock[];
};

export const platformSectionsTable = pgTable("platform_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  iconKey: text("icon_key").notNull().default("book"),
  accentKey: text("accent_key").notNull().default("teal"),
  cardStyle: text("card_style").notNull().default("soft"),
  blocks: jsonb("blocks").$type<PlatformSectionBlock[]>().notNull().default([]),
  courses: jsonb("courses").$type<PlatformSectionCourse[]>().notNull().default([]),
  published: boolean("published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  uniqueIndex("platform_sections_slug_unique").on(table.slug),
  index("platform_sections_published_order_idx").on(table.published, table.sortOrder),
]);

export const insertPlatformSectionSchema = createInsertSchema(platformSectionsTable)
  .omit({ id: true, slug: true, updatedAt: true });
export type PlatformSection = typeof platformSectionsTable.$inferSelect;
