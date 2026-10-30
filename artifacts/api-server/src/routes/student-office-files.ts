import { and, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateStudentOfficeFileBody,
  CreateStudentOfficeFileResponse,
  DeleteStudentOfficeFileParams,
  ListStudentOfficeFilesResponse,
  UpdateStudentOfficeFileBody,
  UpdateStudentOfficeFileParams,
  UpdateStudentOfficeFileResponse,
} from "@workspace/api-zod";
import { db, studentOfficeFilesTable, type StudentOfficeFileKind } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const MAX_OFFICE_FILES_PER_STUDENT = 100;
const MAX_SHEETS_PER_FILE = 20;
const MAX_ROWS_PER_SHEET = 100;
const MAX_COLUMNS_PER_SHEET = 26;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidContent(kind: StudentOfficeFileKind, serialized: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return false;
  }
  if (!isRecord(parsed)) return false;
  if (kind === "document") {
    return parsed.type === "doc" && Array.isArray(parsed.content);
  }
  if (parsed.version !== 1 || !Array.isArray(parsed.sheets) || parsed.sheets.length < 1 || parsed.sheets.length > MAX_SHEETS_PER_FILE) {
    return false;
  }
  return parsed.sheets.every((sheet) => isRecord(sheet)
    && typeof sheet.id === "string"
    && typeof sheet.name === "string"
    && sheet.name.length <= 80
    && Number.isInteger(sheet.rows)
    && Number(sheet.rows) >= 1
    && Number(sheet.rows) <= MAX_ROWS_PER_SHEET
    && Number.isInteger(sheet.columns)
    && Number(sheet.columns) >= 1
    && Number(sheet.columns) <= MAX_COLUMNS_PER_SHEET
    && isRecord(sheet.cells)
    && Object.keys(sheet.cells).length <= MAX_ROWS_PER_SHEET * MAX_COLUMNS_PER_SHEET);
}

function toOfficeFile(row: typeof studentOfficeFilesTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/student/office-files", requireAuth, async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(studentOfficeFilesTable)
    .where(eq(studentOfficeFilesTable.userId, userId))
    .orderBy(desc(studentOfficeFilesTable.updatedAt), desc(studentOfficeFilesTable.createdAt))
    .limit(MAX_OFFICE_FILES_PER_STUDENT);
  res.json(ListStudentOfficeFilesResponse.parse(rows.map(toOfficeFile)));
});

router.post("/student/office-files", requireAuth, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const parsed = CreateStudentOfficeFileBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.title.trim()) {
    res.status(400).json({ error: parsed.success ? "File title is required" : parsed.error.message });
    return;
  }
  if (!isValidContent(parsed.data.kind, parsed.data.content)) {
    res.status(400).json({ error: "محتوى المستند أو الجدول غير صالح." });
    return;
  }

  const userId = res.locals.userId as string;
  const [existing] = await db
    .select({ total: count() })
    .from(studentOfficeFilesTable)
    .where(eq(studentOfficeFilesTable.userId, userId));
  if ((existing?.total ?? 0) >= MAX_OFFICE_FILES_PER_STUDENT) {
    res.status(429).json({ error: "وصلت للحد الأقصى لعدد المستندات والجداول المحفوظة." });
    return;
  }

  const [row] = await db
    .insert(studentOfficeFilesTable)
    .values({
      userId,
      title: parsed.data.title.trim(),
      kind: parsed.data.kind,
      content: parsed.data.content,
    })
    .returning();
  res.status(201).json(CreateStudentOfficeFileResponse.parse(toOfficeFile(row)));
});

router.put("/student/office-files/:id", requireAuth, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const params = UpdateStudentOfficeFileParams.safeParse(req.params);
  const parsed = UpdateStudentOfficeFileBody.safeParse(req.body);
  if (!params.success || !parsed.success || !parsed.data.title.trim()) {
    res.status(400).json({ error: !params.success ? params.error.message : !parsed.success ? parsed.error.message : "File title is required" });
    return;
  }

  const userId = res.locals.userId as string;
  const [existing] = await db
    .select({ kind: studentOfficeFilesTable.kind })
    .from(studentOfficeFilesTable)
    .where(and(eq(studentOfficeFilesTable.id, params.data.id), eq(studentOfficeFilesTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Office file not found" });
    return;
  }
  if (!isValidContent(existing.kind, parsed.data.content)) {
    res.status(400).json({ error: "محتوى المستند أو الجدول غير صالح." });
    return;
  }
  const [row] = await db
    .update(studentOfficeFilesTable)
    .set({ title: parsed.data.title.trim(), content: parsed.data.content, updatedAt: new Date() })
    .where(and(eq(studentOfficeFilesTable.id, params.data.id), eq(studentOfficeFilesTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Office file not found" });
    return;
  }
  res.json(UpdateStudentOfficeFileResponse.parse(toOfficeFile(row)));
});

router.delete("/student/office-files/:id", requireAuth, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const params = DeleteStudentOfficeFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  const [deleted] = await db
    .delete(studentOfficeFilesTable)
    .where(and(eq(studentOfficeFilesTable.id, params.data.id), eq(studentOfficeFilesTable.userId, userId)))
    .returning({ id: studentOfficeFilesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Office file not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
