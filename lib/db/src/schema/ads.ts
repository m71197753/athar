import { pgTable, text, timestamp, uuid, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const adCustomersTable = pgTable("ad_customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type AdPlacement = { page: string; slot: string; offsetX: number; offsetY: number; width: number; height: number };
export const adsTable = pgTable("classified_ads", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  format: text("format").notNull(),
  status: text("status").notNull().default("draft"),
  mediaUrl: text("media_url").notNull().default(""),
  code: text("code").notNull().default(""),
  destination: text("destination").notNull().default(""),
  cta: text("cta").notNull().default("اعرف المزيد"),
  customerId: uuid("customer_id").references(() => adCustomersTable.id, { onDelete: "set null" }),
  placements: jsonb("placements").$type<AdPlacement[]>().notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [index("ads_status_schedule_idx").on(table.status, table.startsAt, table.endsAt)]);
export const adEventsTable = pgTable("ad_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  adId: uuid("ad_id").notNull().references(() => adsTable.id),
  customerId: uuid("customer_id").references(() => adCustomersTable.id, { onDelete: "set null" }),
  visitor: text("visitor").notNull(),
  kind: text("kind").notNull(),
  placement: text("placement").notNull(),
  window: integer("window").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("ad_event_dedupe_idx").on(table.adId, table.visitor, table.kind, table.window),
  index("ad_event_created_idx").on(table.createdAt, table.adId),
]);
export const adLeadsTable = pgTable("ad_enquiries", {
  id: uuid("id").primaryKey().defaultRandom(),
  adId: uuid("ad_id").notNull().references(() => adsTable.id),
  customerId: uuid("customer_id").references(() => adCustomersTable.id, { onDelete: "set null" }),
  visitor: text("visitor").notNull(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("ad_leads_created_idx").on(table.createdAt, table.adId)]);
export const adAssetsTable = pgTable("ad_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectPath: text("object_path").notNull(),
  ownerId: text("owner_id").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertAdSchema = createInsertSchema(adsTable);
export const insertAdCustomerSchema = createInsertSchema(adCustomersTable);
export type Ad = typeof adsTable.$inferSelect;
