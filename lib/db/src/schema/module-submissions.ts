import { bigint, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const moduleStudentSubmissionsTable = pgTable(
  "module_student_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull(),
    moduleKey: text("module_key").notNull(),
    title: text("title").notNull(),
    note: text("note"),
    originalName: text("original_name").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    objectPath: text("object_path").notNull(),
    status: text("status").notNull().default("uploading"),
    reviewNote: text("review_note"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("module_student_submissions_status_check", sql`${table.status} IN ('uploading', 'pending', 'approved', 'rejected')`),
    index("module_student_submissions_owner_module_created_idx").on(table.ownerId, table.moduleKey, table.createdAt),
    index("module_student_submissions_status_created_idx").on(table.status, table.createdAt),
    uniqueIndex("module_student_submissions_object_path_idx").on(table.objectPath),
  ],
);

export type ModuleStudentSubmission = typeof moduleStudentSubmissionsTable.$inferSelect;
