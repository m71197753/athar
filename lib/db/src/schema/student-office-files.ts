import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type StudentOfficeFileKind = "document" | "spreadsheet";

export const studentOfficeFilesTable = pgTable(
  "student_office_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    kind: text("kind").$type<StudentOfficeFileKind>().notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("student_office_files_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const insertStudentOfficeFileSchema = createInsertSchema(studentOfficeFilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStudentOfficeFile = z.infer<typeof insertStudentOfficeFileSchema>;
export type StudentOfficeFileRecord = typeof studentOfficeFilesTable.$inferSelect;
