import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const moduleResult = { exports: {} };
const source = ts.transpileModule(
  readFileSync(new URL("../src/lib/academy-study.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
vm.runInNewContext(source, { module: moduleResult, exports: moduleResult.exports });
const {
  academyPublicFileQuiz,
  academyStudyLevel,
  gradeAcademyFileQuiz,
  parseGeneratedFileQuizDraft,
  parseGeneratedStudyGuideDraft,
} = moduleResult.exports;

test("AI drafts are shape-checked before becoming saved study content", () => {
  const quiz = {
    title: "مراجعة",
    questions: Array.from({ length: 5 }, (_, index) => ({
      question: `سؤال ${index + 1}`,
      options: ["أ", "ب", "ج", "د"],
      correctIndex: 0,
      explanation: "من محتوى المصدر",
      topic: "مفهوم",
    })),
  };
  assert.equal(parseGeneratedFileQuizDraft(quiz).questions.length, 5);
  assert.equal(parseGeneratedFileQuizDraft({ ...quiz, externalClaim: "not allowed" }), null);
  assert.equal(parseGeneratedFileQuizDraft({ ...quiz, questions: quiz.questions.slice(0, 4) }), null);

  const guide = {
    title: "ملخص",
    overview: "نظرة عامة",
    keyPoints: Array.from({ length: 3 }, (_, index) => ({ heading: `عنوان ${index}`, detail: "نقطة من المصدر" })),
    terms: [],
    reviewQuestions: Array.from({ length: 3 }, (_, index) => ({ question: `سؤال ${index}`, answer: "إجابة" })),
  };
  assert.equal(parseGeneratedStudyGuideDraft(guide).keyPoints.length, 3);
  assert.equal(parseGeneratedStudyGuideDraft({ ...guide, untrusted: true }), null);
});

test("public quiz payload never exposes the correct option or explanation", () => {
  const result = academyPublicFileQuiz({
    id: "quiz-1",
    title: "مراجعة",
    questions: [{
      id: "q-1",
      question: "السؤال",
      options: ["أ", "ب", "ج", "د"],
      correctIndex: 2,
      explanation: "السبب",
      topic: "مفهوم",
    }],
  });
  assert.equal(JSON.stringify(result).includes("correctIndex"), false);
  assert.equal(JSON.stringify(result).includes("explanation"), false);
});

test("private practice level bands are descriptive and ordered", () => {
  assert.equal(academyStudyLevel(0), "needs_review");
  assert.equal(academyStudyLevel(50), "developing");
  assert.equal(academyStudyLevel(70), "proficient");
  assert.equal(academyStudyLevel(85), "strong");
});

test("practice scores and topic mastery are graded from the stored answer key", () => {
  const questions = [
    { id: "q1", question: "1 + 1?", options: ["1", "2", "3", "4"], correctIndex: 1, explanation: "2", topic: "الحساب" },
    { id: "q2", question: "2 + 2?", options: ["2", "3", "4", "5"], correctIndex: 2, explanation: "4", topic: "الحساب" },
    { id: "q3", question: "لون السماء؟", options: ["أزرق", "أحمر", "أخضر", "أبيض"], correctIndex: 0, explanation: "أزرق", topic: "علوم" },
    { id: "q4", question: "الماء؟", options: ["صلب", "سائل", "غاز", "معدن"], correctIndex: 1, explanation: "سائل", topic: "علوم" },
    { id: "q5", question: "النبات؟", options: ["حيوان", "كائن حي", "معدن", "غاز"], correctIndex: 1, explanation: "كائن حي", topic: "علوم" },
  ];
  const result = gradeAcademyFileQuiz(questions, [
    { questionId: "q1", selectedOption: 1 },
    { questionId: "q2", selectedOption: 2 },
    { questionId: "q3", selectedOption: 0 },
    { questionId: "q4", selectedOption: 3 },
    { questionId: "q5", selectedOption: 3 },
  ]);
  assert.equal(result.score, 60);
  assert.equal(result.correctCount, 3);
  assert.equal(result.level, "developing");
  assert.equal(JSON.stringify(result.topicResults.map(({ topic, score }) => [topic, score])), JSON.stringify([
    ["الحساب", 100],
    ["علوم", 33],
  ]));
  assert.equal(result.review[3].isCorrect, false);
  assert.equal(result.storedAnswers[0].selectedOption, 1);
});

test("grading rejects missing, duplicate, or unrelated answers", () => {
  const question = [{ id: "q1", question: "Q", options: ["a", "b", "c", "d"], correctIndex: 0, explanation: "A", topic: "x" }];
  assert.throws(() => gradeAcademyFileQuiz(question, []), /exactly one answer/);
  assert.throws(() => gradeAcademyFileQuiz(question, [
    { questionId: "q1", selectedOption: 0 },
    { questionId: "q1", selectedOption: 0 },
  ]), /exactly one answer/);
  assert.throws(() => gradeAcademyFileQuiz(question, [{ questionId: "other", selectedOption: 0 }]), /do not match/);
});
