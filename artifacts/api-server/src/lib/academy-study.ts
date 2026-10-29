import type {
  AcademyStudyGuideData,
  AcademyQuizTopicResult,
  AcademyStoredQuizAnswer,
  AcademyStoredQuizQuestion,
} from "@workspace/db";

export type AcademyQuizSubmissionAnswer = { questionId: string; selectedOption: number };
export type AcademyGeneratedQuizQuestion = Omit<AcademyStoredQuizQuestion, "id">;
export type AcademyGeneratedQuizDraft = {
  title: string;
  questions: AcademyGeneratedQuizQuestion[];
};
export type AcademyStoredFileQuiz = {
  id: string;
  title: string;
  questions: AcademyStoredQuizQuestion[];
};

export function academyPublicFileQuiz(quiz: AcademyStoredFileQuiz) {
  return {
    quizId: quiz.id,
    title: quiz.title,
    questions: quiz.questions.map(({ id, question, options }) => ({ id, question, options })),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function readString(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

export function parseGeneratedFileQuizDraft(value: unknown): AcademyGeneratedQuizDraft | null {
  if (!isObject(value) || !onlyKeys(value, ["title", "questions"])) return null;
  const title = readString(value.title, 1, 160);
  if (!title || !Array.isArray(value.questions) || value.questions.length < 5 || value.questions.length > 20) return null;
  const questions: AcademyGeneratedQuizQuestion[] = [];
  for (const rawQuestion of value.questions) {
    if (!isObject(rawQuestion) || !onlyKeys(rawQuestion, ["question", "options", "correctIndex", "explanation", "topic"])) return null;
    const question = readString(rawQuestion.question, 1, 1000);
    const explanation = readString(rawQuestion.explanation, 1, 1500);
    const topic = readString(rawQuestion.topic, 1, 80);
    if (!question || !explanation || !topic || !Array.isArray(rawQuestion.options) || rawQuestion.options.length !== 4) return null;
    const options = rawQuestion.options.map((option) => readString(option, 1, 500));
    if (options.some((option) => option === null) ||
      !Number.isInteger(rawQuestion.correctIndex) ||
      (rawQuestion.correctIndex as number) < 0 || (rawQuestion.correctIndex as number) > 3) return null;
    questions.push({
      question,
      explanation,
      topic,
      options: options as string[],
      correctIndex: rawQuestion.correctIndex as number,
    });
  }
  return { title, questions };
}

export function parseGeneratedStudyGuideDraft(value: unknown): AcademyStudyGuideData | null {
  if (!isObject(value) || !onlyKeys(value, ["title", "overview", "keyPoints", "terms", "reviewQuestions"])) return null;
  const title = readString(value.title, 1, 160);
  const overview = readString(value.overview, 1, 2000);
  if (!title || !overview || !Array.isArray(value.keyPoints) || value.keyPoints.length < 3 || value.keyPoints.length > 12) return null;
  const keyPoints: AcademyStudyGuideData["keyPoints"] = [];
  for (const rawPoint of value.keyPoints) {
    if (!isObject(rawPoint) || !onlyKeys(rawPoint, ["heading", "detail"])) return null;
    const heading = readString(rawPoint.heading, 1, 120);
    const detail = readString(rawPoint.detail, 1, 500);
    if (!heading || !detail) return null;
    keyPoints.push({ heading, detail });
  }
  if (!Array.isArray(value.terms) || value.terms.length > 12) return null;
  const terms: AcademyStudyGuideData["terms"] = [];
  for (const rawTerm of value.terms) {
    if (!isObject(rawTerm) || !onlyKeys(rawTerm, ["term", "meaning"])) return null;
    const term = readString(rawTerm.term, 1, 100);
    const meaning = readString(rawTerm.meaning, 1, 300);
    if (!term || !meaning) return null;
    terms.push({ term, meaning });
  }
  if (!Array.isArray(value.reviewQuestions) || value.reviewQuestions.length < 3 || value.reviewQuestions.length > 8) return null;
  const reviewQuestions: AcademyStudyGuideData["reviewQuestions"] = [];
  for (const rawQuestion of value.reviewQuestions) {
    if (!isObject(rawQuestion) || !onlyKeys(rawQuestion, ["question", "answer"])) return null;
    const question = readString(rawQuestion.question, 1, 300);
    const answer = readString(rawQuestion.answer, 1, 500);
    if (!question || !answer) return null;
    reviewQuestions.push({ question, answer });
  }
  return { title, overview, keyPoints, terms, reviewQuestions };
}

export function academyStudyLevel(score: number): "needs_review" | "developing" | "proficient" | "strong" {
  if (score < 50) return "needs_review";
  if (score < 70) return "developing";
  if (score < 85) return "proficient";
  return "strong";
}

export function gradeAcademyFileQuiz(
  questions: AcademyStoredQuizQuestion[],
  answers: AcademyQuizSubmissionAnswer[],
) {
  const answersById = new Map(answers.map((answer) => [answer.questionId, answer.selectedOption]));
  if (answersById.size !== answers.length || answers.length !== questions.length) {
    throw new Error("Every quiz question must have exactly one answer");
  }
  if (questions.some((question) => !answersById.has(question.id)) || answers.some((answer) =>
    !questions.some((question) => question.id === answer.questionId)
  )) {
    throw new Error("Quiz answers do not match the stored questions");
  }

  const review = questions.map((question) => {
    const selectedOption = answersById.get(question.id)!;
    return {
      questionId: question.id,
      question: question.question,
      options: question.options,
      selectedOption,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      topic: question.topic,
      isCorrect: selectedOption === question.correctIndex,
    };
  });
  const correctCount = review.filter((answer) => answer.isCorrect).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const grouped = new Map<string, { correctCount: number; questionCount: number }>();
  for (const answer of review) {
    const topic = answer.topic.trim() || "مفاهيم عامة";
    const group = grouped.get(topic) ?? { correctCount: 0, questionCount: 0 };
    group.questionCount += 1;
    if (answer.isCorrect) group.correctCount += 1;
    grouped.set(topic, group);
  }
  const topicResults: AcademyQuizTopicResult[] = [...grouped].map(([topic, values]) => ({
    topic,
    ...values,
    score: Math.round((values.correctCount / values.questionCount) * 100),
  }));
  const storedAnswers: AcademyStoredQuizAnswer[] = review.map((answer) => ({
    questionId: answer.questionId,
    selectedOption: answer.selectedOption,
    isCorrect: answer.isCorrect,
  }));

  return {
    score,
    correctCount,
    questionCount: questions.length,
    level: academyStudyLevel(score),
    topicResults,
    review,
    storedAnswers,
  };
}
