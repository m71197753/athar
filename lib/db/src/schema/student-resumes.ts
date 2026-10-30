import { createInsertSchema } from "drizzle-zod";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type ResumeSectionEntryRecord = {
  title: string;
  organization: string;
  location: string;
  period: string;
  description: string;
  link: string;
};

export type StudentResumeOrigin = "guided" | "manual";

export type StudentResumeAppearanceRecord = {
  fontFamily: "Arial" | "Tahoma" | "Verdana" | "Georgia";
  pageColor: string;
  textColor: string;
  headingColor: string;
  accentColor: string;
};

export type StudentResumeContentRecord = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  headline: string;
  summary: string;
  education: ResumeSectionEntryRecord[];
  experience: ResumeSectionEntryRecord[];
  projects: ResumeSectionEntryRecord[];
  courses: ResumeSectionEntryRecord[];
  skills: string[];
  certifications: string[];
  languages: string[];
  appearance?: StudentResumeAppearanceRecord;
};

export const studentResumesTable = pgTable(
  "student_resumes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    origin: text("origin").$type<StudentResumeOrigin>().notNull().default("guided"),
    template: text("template").notNull().default("ats"),
    content: jsonb("content").$type<StudentResumeContentRecord>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("student_resumes_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const insertStudentResumeSchema = createInsertSchema(studentResumesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStudentResume = z.infer<typeof insertStudentResumeSchema>;
export type StudentResumeRecord = typeof studentResumesTable.$inferSelect;
