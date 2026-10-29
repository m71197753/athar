export type ResumeData = {
  profile: {
    fullName?: string | null;
    headline?: string | null;
    university?: string | null;
    major?: string | null;
    yearOfStudy?: number | null;
    skills?: string[];
  } | null;
  achievements: Array<{
    title: string;
    context?: string | null;
    result?: string | null;
    resumeBullet?: string | null;
    skills?: string[];
    achievedOn?: string;
  }>;
  courses: Array<{
    title: string;
    subject?: string | null;
    source?: string | null;
    skills?: string[];
  }>;
};

export type AtsMatch = {
  score: number;
  totalTerms: number;
  matchedTermCount: number;
  missingTermCount: number;
  matchedTerms: string[];
  missingTerms: string[];
  suggestions: string[];
};

const stopWords = new Set(
  [
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is",
    "it", "its", "of", "on", "or", "our", "that", "the", "this", "to", "with", "will", "you",
    "عن", "على", "إلى", "الى", "أن", "إن", "او", "أو", "بها", "به", "بعد", "بعض", "تم", "في",
    "كان", "كل", "كما", "لا", "لدى", "ما", "مع", "من", "هذا", "هذه", "هو", "هي", "و", "وذلك",
  ].map(normalizeText),
);

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[ـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .toLocaleLowerCase()
    .trim();
}

function words(value: string) {
  return normalizeText(value)
    .match(/[\p{L}\p{N}+#.-]+/gu)
    ?.map(word => word.replace(/^[.-]+|[.-]+$/g, ""))
    .filter(word => {
      const minimumLength = /^[a-z0-9]/i.test(word) ? 3 : 2;
      return word.length >= minimumLength && !stopWords.has(word) && !/^\d+$/.test(word);
    }) ?? [];
}

export function buildResumeText(data: ResumeData) {
  const profile = data.profile;
  const experienceText = data.achievements.flatMap(item => [
    item.title,
    item.context,
    item.resumeBullet || item.result,
    ...(item.skills ?? []),
  ]);
  const courseText = data.courses.flatMap(item => [item.title, item.subject, item.source, ...(item.skills ?? [])]);
  return [
    profile?.headline,
    profile?.major,
    ...(profile?.skills ?? []),
    ...experienceText,
    ...courseText,
  ].filter((value): value is string => Boolean(value?.trim())).join(" ");
}

export function analyzeAtsMatch(data: ResumeData, jobDescription: string): AtsMatch {
  const targetTerms = [...new Set(words(jobDescription))];
  const resumeTerms = new Set(words(buildResumeText(data)));
  const matchedTerms = targetTerms.filter(term => resumeTerms.has(term));
  const missingTerms = targetTerms.filter(term => !resumeTerms.has(term));
  const suggestions: string[] = [];

  if (!data.profile?.headline?.trim()) {
    suggestions.push("أضف نبذة مهنية قصيرة توضّح المجال الذي تستهدفه.");
  }
  if (
    !data.profile?.skills?.length &&
    !data.achievements.some(item => item.skills?.length) &&
    !data.courses.some(item => item.skills?.length)
  ) {
    suggestions.push("أضف مهاراتك الفعلية إلى ملفك أو إلى إنجازاتك.");
  }
  if (data.achievements.length === 0) {
    suggestions.push("وثّق مشروعًا أو تدريبًا أو تجربة عملية لإظهار خبرتك.");
  } else if (data.achievements.some(item => !item.resumeBullet?.trim())) {
    suggestions.push("اكتب وصفًا موجزًا لكل تجربة يوضح ما فعلته والنتيجة التي حققتها.");
  }
  if (missingTerms.length) {
    suggestions.push(`راجع متطلبات الوظيفة وأضف ما ينطبق فعلًا من هذه الكلمات: ${missingTerms.slice(0, 5).join("، ")}.`);
  }
  if (targetTerms.length === 0) {
    suggestions.push("أدخل وصف الوظيفة لتظهر مقارنة الكلمات المطلوبة.");
  }

  return {
    score: targetTerms.length ? Math.round((matchedTerms.length / targetTerms.length) * 100) : 0,
    totalTerms: targetTerms.length,
    matchedTermCount: matchedTerms.length,
    missingTermCount: missingTerms.length,
    matchedTerms: matchedTerms.slice(0, 20),
    missingTerms: missingTerms.slice(0, 20),
    suggestions,
  };
}
