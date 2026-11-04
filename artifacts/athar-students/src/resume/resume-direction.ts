import type { StudentResumeContent } from "@workspace/api-client-react";

export type ResumeDirection = "rtl" | "ltr";

const isLetter = /\p{L}/u;
const isArabic = /\p{Script=Arabic}/u;
const isLatin = /\p{Script=Latin}/u;

export function getResumeDirectionFromText(
  values: readonly (string | null | undefined)[],
): ResumeDirection {
  let arabicLetters = 0;
  let latinLetters = 0;

  for (const value of values) {
    if (!value) continue;
    for (const character of value) {
      if (!isLetter.test(character)) continue;
      if (isArabic.test(character)) arabicLetters += 1;
      else if (isLatin.test(character)) latinLetters += 1;
    }
  }

  if (arabicLetters === 0 && latinLetters === 0) return "rtl";
  return arabicLetters >= latinLetters ? "rtl" : "ltr";
}

export function getStudentResumeDirection(content: StudentResumeContent): ResumeDirection {
  const entries = [
    ...content.education,
    ...content.experience,
    ...content.projects,
    ...content.courses,
  ];

  return getResumeDirectionFromText([
    content.fullName,
    content.headline,
    content.summary,
    ...entries.flatMap(entry => [
      entry.title,
      entry.organization,
      entry.location,
      entry.description,
    ]),
    ...content.skills,
    ...content.certifications,
    ...content.languages,
  ]);
}
