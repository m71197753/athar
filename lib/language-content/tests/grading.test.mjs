import assert from "node:assert/strict";
import test from "node:test";
import {
  allLanguageContent,
  generatedEnglishBatches,
  gradeLanguageAnswer,
  languageCatalogs,
  sampleA1Content,
  scoreSpokenText,
  supportedLanguages,
} from "../src/index.ts";

test("grades choices and typed answers against shared course content", () => {
  const word = sampleA1Content.find(item => item.id === "en-a1-word-study-001");
  assert.ok(word);
  assert.equal(gradeLanguageAnswer(word, "choice", "STUDY!")?.isCorrect, true);
  assert.equal(gradeLanguageAnswer(word, "recall", "learn")?.isCorrect, false);
});

test("grades listening choices against the Arabic meaning on the server", () => {
  const word = sampleA1Content.find(item => item.id === "en-a1-word-skill-002");
  assert.ok(word);
  assert.equal(gradeLanguageAnswer(word, "listening", word.arabic)?.isCorrect, true);
  assert.equal(gradeLanguageAnswer(word, "listening", "مهارة مختلفة")?.isCorrect, false);
});

test("rejects question modes that do not match the item type", () => {
  const word = sampleA1Content.find(item => item.id === "en-a1-word-study-001");
  assert.ok(word);
  assert.equal(gradeLanguageAnswer(word, "order", "study") , null);
  assert.equal(gradeLanguageAnswer(word, "pronunciation", "study")?.pronunciationScore, 100);
});

test("scores pronunciation approximately without keeping the transcript", () => {
  const sentence = sampleA1Content.find(item => item.id === "en-a1-sentence-meeting-006");
  assert.ok(sentence);
  const exact = gradeLanguageAnswer(sentence, "pronunciation", sentence.english);
  assert.equal(exact?.pronunciationScore, 100);
  assert.equal(exact?.isCorrect, true);
  assert.equal(scoreSpokenText(sentence.english, "The meeting starts"), 60);
  assert.equal(scoreSpokenText("école", "école"), 100);
  const frenchWord = languageCatalogs.fr.find(item => item.kind === "word");
  assert.ok(frenchWord);
  assert.equal(gradeLanguageAnswer(frenchWord, "pronunciation", frenchWord.english)?.pronunciationScore, 100);
});

test("shared starter content contains unique ids", () => {
  const ids = allLanguageContent.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(supportedLanguages.map(language => language.code), ["en", "fr", "es", "de", "tr"]);
  assert.equal(languageCatalogs.en.length, sampleA1Content.length + generatedEnglishBatches.length);
  assert.ok(generatedEnglishBatches.length > 0);
  assert.ok(generatedEnglishBatches.some(item => item.kind === "word"));
  assert.ok(generatedEnglishBatches.some(item => item.kind === "sentence"));
  assert.ok(generatedEnglishBatches.every(item => item.languageCode === "en" && item.level === "A1"));
  for (const [code, catalog] of Object.entries(languageCatalogs)) {
    assert.ok(catalog.some(item => item.kind === "word"), `${code} must contain vocabulary`);
    assert.ok(catalog.some(item => item.kind === "sentence"), `${code} must contain sentences`);
  }
});
