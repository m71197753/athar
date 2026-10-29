export type ParsedLanguageImportItem = {
  sourceId?: string;
  languageCode: "en" | "fr" | "es" | "de" | "tr";
  level: "A1" | "A2" | "B1" | "B2";
  kind: "word" | "sentence";
  category: string;
  partOfSpeech?: string;
  english: string;
  arabic: string;
  pronunciationArabic?: string;
  exampleEnglish?: string;
  exampleArabic?: string;
  grammarNote?: string;
  difficulty: number;
  relatedWordIds: string[];
};

export type LanguageImportIssue = { row: number; message: string };
export type LanguageImportParseResult = {
  items: ParsedLanguageImportItem[];
  errors: LanguageImportIssue[];
};

export type ExistingLanguageImportItem = {
  id: string;
  languageCode: string;
  level: string;
  kind: string;
  english: string;
};

const languageCodes = new Set(["en", "fr", "es", "de", "tr"]);
const levels = new Set(["A1", "A2", "B1", "B2"]);
const kinds = new Set(["word", "sentence"]);
const maxImportBytes = 400 * 1024;
const allowedFields = new Set([
  "id", "sourceId", "languageCode", "level", "kind", "category", "partOfSpeech",
  "english", "arabic", "pronunciationArabic", "exampleEnglish", "exampleArabic",
  "grammarNote", "difficulty", "relatedWordIds", "active", "updatedAt",
]);
const requiredCsvHeaders = [
  "languageCode", "level", "kind", "category", "english", "arabic", "difficulty",
];

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function contentKey(item: Pick<ParsedLanguageImportItem, "languageCode" | "level" | "kind" | "english">): string {
  return `${item.languageCode}:${item.level}:${item.kind}:${normalizeText(item.english)}`;
}

function parseCsv(source: string): { rows?: string[][]; error?: string } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  source = source.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === '"') {
      return { error: "علامة اقتباس في موضع غير صالح داخل CSV." };
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (quoted) return { error: "يوجد اقتباس غير مكتمل في ملف CSV." };
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return { rows };
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return stringValue(value);
}

function relatedIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === "") return [];
  let values: unknown = value;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    if (text.startsWith("[")) {
      try {
        values = JSON.parse(text);
      } catch {
        return undefined;
      }
    } else {
      values = text.split("|");
    }
  }
  if (!Array.isArray(values) || values.some(entry => typeof entry !== "string")) return undefined;
  const ids = values.map(entry => entry.trim()).filter(Boolean);
  return ids.length <= 30 ? ids : undefined;
}

function parseItem(
  value: unknown,
  row: number,
): { item?: ParsedLanguageImportItem; errors: LanguageImportIssue[] } {
  const errors: LanguageImportIssue[] = [];
  const fail = (message: string) => errors.push({ row, message });
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("يجب أن يكون الصف كائن محتوى.");
    return { errors };
  }
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!allowedFields.has(key)) fail(`الحقل ${key} غير مدعوم.`);
  }

  const id = stringValue(raw.id);
  const sourceId = stringValue(raw.sourceId);
  if (id && sourceId && id !== sourceId) fail("لا يمكن استخدام id وsourceId بقيمتين مختلفتين.");
  const languageCode = stringValue(raw.languageCode);
  const level = stringValue(raw.level);
  const kind = stringValue(raw.kind);
  const category = stringValue(raw.category);
  const english = stringValue(raw.english);
  const arabic = stringValue(raw.arabic);
  const difficultyText = raw.difficulty;
  const difficulty = typeof difficultyText === "number" ? difficultyText :
    typeof difficultyText === "string" && difficultyText.trim() ? Number(difficultyText) : Number.NaN;
  const relations = relatedIds(raw.relatedWordIds);

  if (!languageCodes.has(languageCode ?? "")) fail("رمز اللغة غير مدعوم.");
  if (!levels.has(level ?? "")) fail("المستوى يجب أن يكون A1 أو A2 أو B1 أو B2.");
  if (!kinds.has(kind ?? "")) fail("نوع المحتوى يجب أن يكون كلمة أو جملة.");
  if (!category || category.length > 80) fail("أضف تصنيفًا لا يتجاوز 80 حرفًا.");
  if (!english || english.length > 300) fail("أضف المحتوى الإنجليزي بحد أقصى 300 حرف.");
  if (!arabic || arabic.length > 300) fail("أضف المعنى العربي بحد أقصى 300 حرف.");
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 10) fail("الصعوبة يجب أن تكون عددًا من 1 إلى 10.");
  if (relations === undefined) fail("المراجع يجب أن تكون قائمة IDs أو نصًا مفصولًا بعلامة |.");
  if (relations?.some(reference => reference.length > 120)) fail("معرّف الكلمة المرتبطة لا يتجاوز 120 حرفًا.");
  if ((id || sourceId) && (id || sourceId)!.length > 120) fail("معرّف المصدر لا يتجاوز 120 حرفًا.");

  const partOfSpeech = optionalString(raw.partOfSpeech);
  const pronunciationArabic = optionalString(raw.pronunciationArabic);
  const exampleEnglish = optionalString(raw.exampleEnglish);
  const exampleArabic = optionalString(raw.exampleArabic);
  const grammarNote = optionalString(raw.grammarNote);
  if (kind === "word") {
    if (!partOfSpeech || partOfSpeech.length > 40) fail("الكلمة تحتاج نوعًا نحويًا لا يتجاوز 40 حرفًا.");
    if (!pronunciationArabic || pronunciationArabic.length > 200) fail("الكلمة تحتاج نطقًا عربيًا تقريبيًا لا يتجاوز 200 حرف.");
    if (!exampleEnglish || exampleEnglish.length > 500) fail("الكلمة تحتاج مثالًا إنجليزيًا لا يتجاوز 500 حرف.");
    if (!exampleArabic || exampleArabic.length > 500) fail("الكلمة تحتاج ترجمة للمثال لا تتجاوز 500 حرف.");
  }
  if (partOfSpeech && partOfSpeech.length > 40) fail("النوع النحوي لا يتجاوز 40 حرفًا.");
  if (pronunciationArabic && pronunciationArabic.length > 200) fail("النطق لا يتجاوز 200 حرف.");
  if (exampleEnglish && exampleEnglish.length > 500) fail("المثال الإنجليزي لا يتجاوز 500 حرف.");
  if (exampleArabic && exampleArabic.length > 500) fail("ترجمة المثال لا تتجاوز 500 حرف.");
  if (grammarNote && grammarNote.length > 600) fail("الملاحظة لا تتجاوز 600 حرف.");

  if (errors.length || !languageCode || !level || !kind || !category || !english || !arabic || relations === undefined) {
    return { errors };
  }
  return {
    item: {
      sourceId: sourceId ?? id,
      languageCode: languageCode as ParsedLanguageImportItem["languageCode"],
      level: level as ParsedLanguageImportItem["level"],
      kind: kind as ParsedLanguageImportItem["kind"],
      category,
      partOfSpeech,
      english,
      arabic,
      pronunciationArabic,
      exampleEnglish,
      exampleArabic,
      grammarNote,
      difficulty,
      relatedWordIds: relations,
    },
    errors,
  };
}

export function validateLanguageContentImportItems(
  items: ParsedLanguageImportItem[],
  existingItems?: ExistingLanguageImportItem[],
): LanguageImportIssue[] {
  const issues: LanguageImportIssue[] = [];
  const seenContent = new Map<string, number>();
  const seenSourceIds = new Map<string, number>();
  const existingContent = new Set((existingItems ?? []).map(item => contentKey({
    languageCode: item.languageCode as ParsedLanguageImportItem["languageCode"],
    level: item.level as ParsedLanguageImportItem["level"],
    kind: item.kind as ParsedLanguageImportItem["kind"],
    english: item.english,
  })));
  const existingById = new Map((existingItems ?? []).map(item => [item.id, item]));
  const sources = new Map<string, ParsedLanguageImportItem>();

  items.forEach((item, index) => {
    const row = index + 1;
    if (item.kind === "word") {
      if (!item.partOfSpeech) issues.push({ row, message: "الكلمة تحتاج نوعًا نحويًا." });
      if (!item.pronunciationArabic) issues.push({ row, message: "الكلمة تحتاج نطقًا عربيًا تقريبيًا." });
      if (!item.exampleEnglish) issues.push({ row, message: "الكلمة تحتاج مثالًا إنجليزيًا." });
      if (!item.exampleArabic) issues.push({ row, message: "الكلمة تحتاج ترجمة للمثال." });
    }
    const key = contentKey(item);
    const previousRow = seenContent.get(key);
    if (previousRow) issues.push({ row, message: `المحتوى مكرر داخل الملف (الصف ${previousRow}).` });
    else seenContent.set(key, row);
    if (existingContent.has(key)) issues.push({ row, message: "هذا المحتوى موجود بالفعل في المكتبة." });

    if (item.sourceId) {
      const previousSourceRow = seenSourceIds.get(item.sourceId);
      if (previousSourceRow) issues.push({ row, message: `معرّف المصدر مكرر (الصف ${previousSourceRow}).` });
      else {
        seenSourceIds.set(item.sourceId, row);
        sources.set(item.sourceId, item);
        if (existingById.has(item.sourceId)) {
          issues.push({ row, message: "معرّف المصدر يطابق عنصرًا موجودًا؛ غيّره قبل الاستيراد." });
        }
      }
    }
  });

  items.forEach((item, index) => {
    for (const reference of item.relatedWordIds) {
      const localTarget = sources.get(reference);
      if (localTarget) {
        if (localTarget.kind !== "word" || localTarget.languageCode !== item.languageCode) {
          issues.push({ row: index + 1, message: `المعرف ${reference} يجب أن يشير إلى كلمة في اللغة نفسها.` });
        }
        continue;
      }
      if (existingItems !== undefined) {
        const existingTarget = existingById.get(reference);
        if (!existingTarget || existingTarget.kind !== "word" || existingTarget.languageCode !== item.languageCode) {
          issues.push({ row: index + 1, message: `مرجع الكلمة ${reference} غير موجود أو لا يطابق اللغة.` });
        }
      }
    }
  });
  return issues;
}

export function parseLanguageContentImportFile(
  source: string,
  format: "csv" | "json",
): LanguageImportParseResult {
  if (source.length > maxImportBytes) {
    return { items: [], errors: [{ row: 1, message: "حجم الملف يتجاوز 400 كيلوبايت." }] };
  }

  let values: unknown[];
  let csvRowNumbers: number[] | undefined;
  if (format === "json") {
    try {
      const parsed: unknown = JSON.parse(source.replace(/^\uFEFF/, ""));
      const data = Array.isArray(parsed) ? parsed :
        parsed && typeof parsed === "object" && "items" in parsed ? (parsed as { items?: unknown }).items : undefined;
      if (!Array.isArray(data)) {
        return { items: [], errors: [{ row: 1, message: "يجب أن يحتوي JSON على قائمة عناصر أو على items." }] };
      }
      values = data;
    } catch {
      return { items: [], errors: [{ row: 1, message: "ملف JSON غير صالح." }] };
    }
  } else {
    const parsed = parseCsv(source);
    if (!parsed.rows) {
      return { items: [], errors: [{ row: 1, message: parsed.error ?? "تعذّر قراءة CSV." }] };
    }
    const rows = parsed.rows
      .map((cells, index) => ({ cells, row: index + 1 }))
      .filter(entry => entry.cells.some(cell => cell.trim().length));
    if (!rows.length) return { items: [], errors: [{ row: 1, message: "ملف CSV فارغ." }] };
    const headers = rows[0].cells.map(header => header.trim());
    if (new Set(headers).size !== headers.length) {
      return { items: [], errors: [{ row: 1, message: "توجد أعمدة مكررة في رأس CSV." }] };
    }
    const missing = requiredCsvHeaders.filter(header => !headers.includes(header));
    if (missing.length) {
      return { items: [], errors: [{ row: 1, message: `الأعمدة المطلوبة ناقصة: ${missing.join(", ")}.` }] };
    }
    const unknown = headers.filter(header => !allowedFields.has(header));
    if (unknown.length) {
      return { items: [], errors: [{ row: 1, message: `أعمدة غير مدعومة: ${unknown.join(", ")}.` }] };
    }
    const dataRows = rows.slice(1);
    const widthErrors = dataRows.flatMap((entry, index) => entry.cells.length === headers.length ? [] : [
      { row: dataRows[index].row, message: "عدد الخلايا لا يطابق عدد الأعمدة." },
    ]);
    if (widthErrors.length) return { items: [], errors: widthErrors };
    csvRowNumbers = dataRows.map(entry => entry.row);
    values = dataRows.map(({ cells }) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
    if (values.length > 250) {
      return { items: [], errors: [{ row: 1, message: "الحد الأقصى للاستيراد 250 عنصرًا في المرة الواحدة." }] };
    }
  }

  if (!values.length) return { items: [], errors: [{ row: 1, message: "لا توجد عناصر للاستيراد." }] };
  if (values.length > 250) {
    return { items: [], errors: [{ row: 1, message: "الحد الأقصى للاستيراد 250 عنصرًا في المرة الواحدة." }] };
  }

  const items: ParsedLanguageImportItem[] = [];
  const errors: LanguageImportIssue[] = [];
  const rowNumbers: number[] = [];
  values.forEach((value, index) => {
    const row = csvRowNumbers?.[index] ?? index + 1;
    const result = parseItem(value, row);
    errors.push(...result.errors);
    if (result.item) {
      items.push(result.item);
      rowNumbers.push(row);
    }
  });

  const structuralIssues = validateLanguageContentImportItems(items);
  for (const issue of structuralIssues) {
    errors.push({ ...issue, row: rowNumbers[issue.row - 1] ?? issue.row });
  }
  return { items, errors };
}
