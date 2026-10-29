import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Published opportunities and guidance are admin-authored. Community entries
 * are member-authored and remain pending until an administrator reviews them.
 */
export const graduateItemsTable = pgTable(
  "graduate_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull(),
    actionLabel: text("action_label"),
    actionUrl: text("action_url"),
    ownerId: text("owner_id").notNull(),
    status: text("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    check("graduate_items_kind_check", sql`${t.kind} IN ('opportunity', 'guidance', 'community')`),
    check("graduate_items_status_check", sql`${t.status} IN ('pending', 'published', 'rejected')`),
    index("graduate_items_public_feed_idx").on(t.status, t.kind, t.createdAt),
    index("graduate_items_owner_idx").on(t.ownerId, t.createdAt),
  ],
);

export type GraduateItem = typeof graduateItemsTable.$inferSelect;
