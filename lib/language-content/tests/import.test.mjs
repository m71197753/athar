import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseLanguageContentImportFile,
  validateLanguageContentImportItems,
} from "../src/import.ts";

const csvHeaders = [
  "id", "languageCode", "level", "kind", "category", "partOfSpeech", "english",
  "arabic", "pronunciationArabic", "exampleEnglish", "exampleArabic", "grammarNote",
  "difficulty", "relatedWordIds",
].join(",");

test("parses UTF-8 CSV, quoted commas, and JSON related IDs", () => {
  const csv = [
    `\uFEFF${csvHeaders}`,
    'en-demo-book,en,A1,word,"الدراسة, الجامعة",اسم,book,كتاب,بُك,"This is my book.","هذا كتابي.","اسم لشيء نقرأه.",1,[]',
    'en-demo-sentence,en,A1,sentence,الدراسة,,The student reads a book.,يقرأ الطالب كتابًا.,,,,"مع المفرد الغائب نضيف s.",2,"[""en-demo-book""]"',
  ].join("\r\n");

  const result = parseLanguageContentImportFile(csv, "csv");
  assert.equal(result.errors.length, 0);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].category, "الدراسة, الجامعة");
  assert.equal(result.items[0].sourceId, "en-demo-book");
  assert.deepEqual(result.items[1].relatedWordIds, ["en-demo-book"]);
});

test("parses JSON batches and ignores server-owned fields", () => {
  const result = parseLanguageContentImportFile(JSON.stringify({
    items: [{
      id: "en-demo-water",
      languageCode: "en",
      level: "A1",
      kind: "word",
      category: "الحياة اليومية",
      partOfSpeech: "اسم",
      english: "water",
      arabic: "ماء",
      pronunciationArabic: "ووتر",
      exampleEnglish: "I drink water.",
      exampleArabic: "أشرب الماء.",
      grammarNote: "اسم للماء الذي نشربه.",
      difficulty: 1,
      relatedWordIds: [],
      active: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
    }],
  }), "json");

  assert.equal(result.errors.length, 0);
  assert.equal(result.items[0].sourceId, "en-demo-water");
  assert.equal("active" in result.items[0], false);
  assert.equal("updatedAt" in result.items[0], false);
});

test("reports duplicate entries and invalid local word references", () => {
  const first = {
    sourceId: "word-1", languageCode: "en", level: "A1", kind: "word",
    category: "الدراسة", partOfSpeech: "اسم", english: "book", arabic: "كتاب",
    pronunciationArabic: "بُك", exampleEnglish: "This is my book.",
    exampleArabic: "هذا كتابي.", difficulty: 1, relatedWordIds: [],
  };
  const duplicate = { ...first, sourceId: "word-2", english: "BOOK!" };
  const sentence = {
    languageCode: "fr", level: "A1", kind: "sentence", category: "التعلّم",
    english: "Le livre est ici.", arabic: "الكتاب هنا.", difficulty: 2,
    relatedWordIds: ["word-1"],
  };
  const result = parseLanguageContentImportFile(JSON.stringify([first, duplicate, sentence]), "json");

  assert.equal(result.items.length, 3);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0].message, /مكرر/);
  assert.match(result.errors[1].message, /اللغة نفسها/);
});

test("server validation detects existing catalog duplicates and missing references", () => {
  const item = {
    sourceId: "new-word", languageCode: "en", level: "A1", kind: "word",
    category: "الدراسة", partOfSpeech: "اسم", english: "book", arabic: "كتاب",
    pronunciationArabic: "بُك", exampleEnglish: "This is my book.",
    exampleArabic: "هذا كتابي.", difficulty: 1, relatedWordIds: ["missing-word"],
  };
  const issues = validateLanguageContentImportItems([item], [{
    id: "existing-book", languageCode: "en", level: "A1", kind: "word", english: "Book",
  }]);
  assert.equal(issues.length, 2);
  assert.match(issues[0].message, /موجود بالفعل/);
  assert.match(issues[1].message, /غير موجود/);
});

test("rejects malformed CSV, invalid JSON, and batches over 250 rows", () => {
  assert.match(parseLanguageContentImportFile(`${csvHeaders}\n"broken,en`, "csv").errors[0].message, /اقتباس/);
  assert.match(parseLanguageContentImportFile("{bad json", "json").errors[0].message, /JSON غير صالح/);
  const tooMany = Array.from({ length: 251 }, () => ({}));
  assert.match(parseLanguageContentImportFile(JSON.stringify(tooMany), "json").errors[0].message, /250/);
});
