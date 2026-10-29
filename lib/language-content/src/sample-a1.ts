export type LanguageLevel = "A1" | "A2" | "B1" | "B2";
export type LanguageContentKind = "word" | "sentence";
export type LanguageQuestionMode = "choice" | "listening" | "order" | "recall" | "pronunciation";

export type LanguageContentItem = {
  id: string;
  languageCode: string;
  level: LanguageLevel;
  kind: LanguageContentKind;
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

export const sampleA1Content: LanguageContentItem[] = [
  {
    id: "en-a1-word-study-001", languageCode: "en", level: "A1", kind: "word",
    category: "الدراسة", partOfSpeech: "verb", english: "study", arabic: "يذاكر / يدرس",
    pronunciationArabic: "ستَدي", exampleEnglish: "I study for an hour every evening.",
    exampleArabic: "أذاكر لمدة ساعة كل مساء.", grammarNote: "تُستخدم للحديث عن الدراسة أو التعلّم.",
    difficulty: 1, relatedWordIds: [],
  },
  {
    id: "en-a1-word-skill-002", languageCode: "en", level: "A1", kind: "word",
    category: "العمل", partOfSpeech: "noun", english: "skill", arabic: "مهارة",
    pronunciationArabic: "سْكِل", exampleEnglish: "I want to build a new skill.",
    exampleArabic: "أريد أن أكتسب مهارة جديدة.", grammarNote: "اسم لشيء تتعلمه وتستطيع أداءه.",
    difficulty: 2, relatedWordIds: [],
  },
  {
    id: "en-a1-word-deadline-003", languageCode: "en", level: "A1", kind: "word",
    category: "العمل", partOfSpeech: "noun", english: "deadline", arabic: "موعد نهائي",
    pronunciationArabic: "دِدلاين", exampleEnglish: "The deadline is on Friday.",
    exampleArabic: "الموعد النهائي يوم الجمعة.", grammarNote: "تشير إلى آخر وقت لإنهاء مهمة.",
    difficulty: 3, relatedWordIds: [],
  },
  {
    id: "en-a1-sentence-explain-004", languageCode: "en", level: "A1", kind: "sentence",
    category: "الدراسة", english: "Could you explain this step?", arabic: "هل يمكنك شرح هذه الخطوة؟",
    grammarNote: "تبدأ الطلبات المهذبة غالبًا بـ Could you.",
    difficulty: 3, relatedWordIds: ["en-a1-word-study-001"],
  },
  {
    id: "en-a1-sentence-project-005", languageCode: "en", level: "A1", kind: "sentence",
    category: "العمل", english: "We finished the project on time.", arabic: "أنهينا المشروع في الموعد المحدد.",
    grammarNote: "يُستخدم finished للحديث عن فعل اكتمل في الماضي.",
    difficulty: 4, relatedWordIds: ["en-a1-word-deadline-003"],
  },
  {
    id: "en-a1-sentence-meeting-006", languageCode: "en", level: "A1", kind: "sentence",
    category: "العمل", english: "The meeting starts at nine.", arabic: "يبدأ الاجتماع في التاسعة.",
    grammarNote: "نستخدم at قبل وقت محدد.",
    difficulty: 4, relatedWordIds: [],
  },
  {
    id: "en-a1-word-improve-007", languageCode: "en", level: "A1", kind: "word",
    category: "التعلّم", partOfSpeech: "verb", english: "improve", arabic: "يُحسّن / يتطور",
    pronunciationArabic: "إمبروف", exampleEnglish: "I improve my English by practicing.",
    exampleArabic: "أطوّر لغتي الإنجليزية بالممارسة.", grammarNote: "تعني جعل شيء أفضل أو أن يصبح أفضل.",
    difficulty: 3, relatedWordIds: [],
  },
  {
    id: "en-a1-word-feedback-008", languageCode: "en", level: "A1", kind: "word",
    category: "العمل", partOfSpeech: "noun", english: "feedback", arabic: "ملاحظات للتطوير",
    pronunciationArabic: "فيدباك", exampleEnglish: "I use feedback to improve my work.",
    exampleArabic: "أستفيد من الملاحظات لتطوير عملي.", grammarNote: "ملاحظات تساعد على معرفة ما يمكن تحسينه.",
    difficulty: 4, relatedWordIds: ["en-a1-word-improve-007"],
  },
  {
    id: "en-a1-word-interview-009", languageCode: "en", level: "A1", kind: "word",
    category: "العمل", partOfSpeech: "noun", english: "interview", arabic: "مقابلة",
    pronunciationArabic: "إنترفيو", exampleEnglish: "I have an interview tomorrow.",
    exampleArabic: "لديّ مقابلة غدًا.", grammarNote: "لقاء لطرح الأسئلة والتعرّف إلى خبرة الشخص.",
    difficulty: 4, relatedWordIds: [],
  },
  {
    id: "en-a1-sentence-prepare-010", languageCode: "en", level: "A1", kind: "sentence",
    category: "العمل", english: "She is preparing for an interview.",
    arabic: "هي تستعد لمقابلة.",
    grammarNote: "نستخدم is مع فعل ينتهي بـ ing لوصف ما يحدث الآن.",
    difficulty: 5, relatedWordIds: ["en-a1-word-interview-009"],
  },
  {
    id: "en-a1-sentence-writing-011", languageCode: "en", level: "A1", kind: "sentence",
    category: "الدراسة", english: "I need to improve my writing.",
    arabic: "أحتاج إلى تطوير كتابتي.",
    grammarNote: "يأتي الفعل بصيغته الأساسية بعد need to.",
    difficulty: 5, relatedWordIds: ["en-a1-word-improve-007"],
  },
  {
    id: "en-a1-sentence-mistakes-012", languageCode: "en", level: "A1", kind: "sentence",
    category: "التعلّم", english: "I can learn from my mistakes.",
    arabic: "أستطيع أن أتعلم من أخطائي.",
    grammarNote: "يأتي الفعل بصيغته الأساسية بعد can.",
    difficulty: 5, relatedWordIds: ["en-a1-word-study-001"],
  },
];

export const starterQuestionModes: LanguageQuestionMode[] = [
  "choice", "choice", "listening",
  "order", "order", "listening",
  "recall", "recall", "listening",
  "pronunciation", "pronunciation", "listening",
];
