import type { LanguageContentItem, LanguageQuestionMode } from "./sample-a1.ts";

export type LanguageAnswerGrade = {
  isCorrect: boolean;
  pronunciationScore: number | null;
};

export function normalizeEnglishAnswer(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.,!?;:()[\]{}"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreSpokenText(expected: string, recognized: string): number {
  const tokenize = (value: string) => value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const target = tokenize(expected);
  const spoken = tokenize(recognized);
  if (!target.length || !spoken.length) return 0;

  let previous = Array.from({ length: spoken.length + 1 }, (_, index) => index);
  for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
    const current = new Array<number>(spoken.length + 1);
    current[0] = targetIndex;
    for (let spokenIndex = 1; spokenIndex <= spoken.length; spokenIndex += 1) {
      const substitutionCost = target[targetIndex - 1] === spoken[spokenIndex - 1] ? 0 : 1;
      current[spokenIndex] = Math.min(
        current[spokenIndex - 1] + 1,
        previous[spokenIndex] + 1,
        previous[spokenIndex - 1] + substitutionCost,
      );
    }
    previous = current;
  }

  const distance = previous[spoken.length];
  return Math.max(0, Math.round((1 - distance / Math.max(target.length, spoken.length)) * 100));
}

export function gradeLanguageAnswer(
  item: LanguageContentItem,
  mode: LanguageQuestionMode,
  submittedAnswer: string,
): LanguageAnswerGrade | null {
  if (mode === "listening") {
    const normalizedAnswer = submittedAnswer.normalize("NFKC").replace(/\s+/g, " ").trim();
    const normalizedTarget = item.arabic.normalize("NFKC").replace(/\s+/g, " ").trim();
    return { isCorrect: normalizedAnswer === normalizedTarget, pronunciationScore: null };
  }
  const normalizedAnswer = normalizeEnglishAnswer(submittedAnswer);
  const normalizedTarget = normalizeEnglishAnswer(item.english);

  if (mode === "choice") {
    return { isCorrect: normalizedAnswer === normalizedTarget, pronunciationScore: null };
  }
  if (mode === "order") {
    if (item.kind !== "sentence") return null;
    return { isCorrect: normalizedAnswer === normalizedTarget, pronunciationScore: null };
  }
  if (mode === "recall") {
    if (item.kind !== "word") return null;
    return { isCorrect: normalizedAnswer === normalizedTarget, pronunciationScore: null };
  }
  const pronunciationScore = scoreSpokenText(item.english, submittedAnswer);
  return { isCorrect: pronunciationScore >= 80, pronunciationScore };
}
