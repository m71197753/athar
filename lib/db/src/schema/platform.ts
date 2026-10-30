import { pgTable, text, timestamp, uuid, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { PlatformSectionBlock } from "./platform-sections";

export const membershipsTable = pgTable("platform_memberships", {
  userId: text("user_id").primaryKey(),
  role: text("role").notNull().default("student"),
  status: text("status").notNull().default("active"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
export const adminNotificationsTable = pgTable(
  "platform_admin_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: text("recipient_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("platform_admin_notifications_recipient_created_idx").on(table.recipientId, table.createdAt),
    index("platform_admin_notifications_recipient_read_idx").on(table.recipientId, table.readAt),
    uniqueIndex("platform_admin_notifications_once_idx").on(table.recipientId, table.type, table.targetId),
  ],
);
export const bootstrapGrantsTable = pgTable("platform_bootstrap_grants", {
  email: text("email").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const platformContentTable = pgTable("platform_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  url: text("url").notNull().default(""),
  published: boolean("published").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
export const platformSettingsTable = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  enabledModules: jsonb("enabled_modules").$type<string[]>().notNull(),
  // Nullable so existing settings rows can be upgraded without resetting their access choices.
  moduleSettings: jsonb("module_settings").$type<{
    key: string; title: string; description: string; enabled: boolean; sortOrder: number;
    iconKey?: string; accentKey?: string; cardStyle?: string;
    blocks?: PlatformSectionBlock[];
  }[]>(),
  appearance: jsonb("appearance").$type<{
    primaryColor: string;
    accentColor: string;
    canvasColor: string;
    surfaceColor: string;
    fontFamily?: "IBM Plex Sans Arabic" | "Cairo" | "Tahoma" | "Arial";
    textColor?: string;
    headingColor?: string;
    welcomeTitle: string;
    welcomeDescription: string;
  }>().notNull().default({
    primaryColor: "#4338CA",
    accentColor: "#6366F1",
    canvasColor: "#F8FAFC",
    surfaceColor: "#FFFFFF",
    welcomeTitle: "ابدأ من هنا واختر مساحتك",
    welcomeDescription: "تعلّم، وثّق ما أنجزته، وخطّط لخطوتك المهنية القادمة من المكان نفسه.",
  }),
});
export const adminAuditTable = pgTable("platform_admin_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("platform_audit_created_idx").on(table.createdAt)]);

export const insertMembershipSchema = createInsertSchema(membershipsTable);
export const insertPlatformContentSchema = createInsertSchema(platformContentTable);
export type Membership = typeof membershipsTable.$inferSelect;
