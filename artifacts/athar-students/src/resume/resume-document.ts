import type {
  Achievement,
  LearningItem,
  StudentProfile,
  StudentResumeContent,
} from "@workspace/api-client-react";
import { analyzeAtsMatch, type AtsMatch, type ResumeData } from "./resume-ats.ts";

const emptyEntry = () => ({
  title: "",
  organization: "",
  location: "",
  period: "",
  description: "",
  link: "",
});

export function createStudentResumeContent(
  profile: StudentProfile | null,
  achievements: Achievement[],
  courses: LearningItem[],
): StudentResumeContent {
  const asEntry = (item: Achievement) => ({
    title: item.title,
    organization: item.context || "",
    location: "",
    period: item.achievedOn || "",
    description: item.resumeBullet?.trim() || [item.action, item.result].filter(Boolean).join(" — "),
    link: "",
  });
  const profileEducation = profile?.university || profile?.major
    ? [{
        ...emptyEntry(),
        title: profile.major || "التعليم الجامعي",
        organization: profile.university || "",
        period: profile.yearOfStudy ? `السنة ${profile.yearOfStudy}` : "",
      }]
    : [];

  return {
    fullName: profile?.fullName ?? "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    website: "",
    headline: profile?.headline ?? "",
    summary: "",
    education: profileEducation,
    experience: achievements
      .filter(item => item.category !== "project" && item.category !== "course")
      .map(asEntry),
    projects: achievements.filter(item => item.category === "project").map(asEntry),
    courses: courses
      .filter(item => item.kind === "course" && item.status === "completed")
      .map(item => ({
        ...emptyEntry(),
        title: item.title,
        organization: item.source ?? "",
        location: item.subject ?? "",
        description: (item.skills ?? []).join("، "),
      })),
    skills: [...new Set([
      ...(profile?.skills ?? []),
      ...achievements.flatMap(item => item.skills ?? []),
      ...courses.flatMap(item => item.skills ?? []),
    ].map(skill => skill.trim()).filter(Boolean))],
    certifications: [],
    languages: [],
  };
}

export type ResumeReadiness = {
  score: number;
  completed: number;
  total: number;
  suggestions: string[];
};

export function scoreStudentResume(content: StudentResumeContent): ResumeReadiness {
  const hasEvidence = (entries: StudentResumeContent["experience"]) =>
    entries.some(entry => [entry.title, entry.organization, entry.description].some(value => value.trim()));
  const hasProfessionalExtras = [
    ...content.courses.map(entry => [entry.title, entry.organization, entry.description].some(value => value.trim())),
    ...content.certifications.map(value => Boolean(value.trim())),
    ...content.languages.map(value => Boolean(value.trim())),
  ].some(Boolean);
  const checks = [
    { done: Boolean(content.fullName.trim()), weight: 10, suggestion: "أضف اسمك كما تريد ظهوره في السيرة." },
    { done: Boolean(content.headline.trim()), weight: 10, suggestion: "حدّد المسمى أو المجال الوظيفي المستهدف." },
    { done: Boolean(content.summary.trim()), weight: 15, suggestion: "اكتب ملخصًا مهنيًا قصيرًا عن خبرتك واتجاهك." },
    { done: Boolean(content.email.trim() || content.phone.trim()), weight: 10, suggestion: "أضف وسيلة تواصل مهنية واحدة على الأقل." },
    { done: content.education.some(item => item.title.trim() || item.organization.trim()), weight: 15, suggestion: "أضف مؤهلك أو تعليمك." },
    { done: hasEvidence(content.experience) || hasEvidence(content.projects), weight: 20, suggestion: "أضف خبرة أو مشروعًا حقيقيًا يوضح ما أنجزته." },
    { done: content.skills.filter(skill => skill.trim()).length >= 3, weight: 12, suggestion: "أضف ثلاث مهارات فعلية على الأقل." },
    { done: hasProfessionalExtras, weight: 8, suggestion: "أضف دورات أو شهادات أو لغات تعرفها." },
  ];
  const score = checks.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);
  return {
    score,
    completed: checks.filter(item => item.done).length,
    total: checks.length,
    suggestions: checks.filter(item => !item.done).map(item => item.suggestion),
  };
}

export function buildStudentResumeText(content: StudentResumeContent): string {
  const sections = [
    content.fullName,
    content.headline,
    content.summary,
    content.email,
    content.phone,
    content.location,
    content.linkedin,
    content.website,
    ...content.education.flatMap(entry => [entry.title, entry.organization, entry.location, entry.period, entry.description]),
    ...content.experience.flatMap(entry => [entry.title, entry.organization, entry.location, entry.period, entry.description]),
    ...content.projects.flatMap(entry => [entry.title, entry.organization, entry.location, entry.period, entry.description, entry.link]),
    ...content.courses.flatMap(entry => [entry.title, entry.organization, entry.location, entry.period, entry.description]),
    ...content.skills,
    ...content.certifications,
    ...content.languages,
  ];
  return sections.filter(value => Boolean(value?.trim())).join(" ");
}

function toAtsResumeData(content: StudentResumeContent): ResumeData {
  const asAchievement = (entry: StudentResumeContent["experience"][number]) => ({
    title: entry.title,
    context: entry.organization,
    result: entry.description,
    resumeBullet: entry.description,
    skills: [] as string[],
    achievedOn: entry.period,
  });
  return {
    profile: {
      fullName: content.fullName,
      headline: content.headline,
      university: content.education.map(item => item.organization).filter(Boolean).join(" "),
      major: content.education.map(item => item.title).filter(Boolean).join(" "),
      skills: content.skills,
    },
    achievements: [...content.experience, ...content.projects].map(asAchievement),
    courses: content.courses.map(item => ({
      title: item.title,
      subject: item.location,
      source: item.organization,
      skills: item.description ? item.description.split(/[،,]/).map(skill => skill.trim()).filter(Boolean) : [],
    })),
  };
}

export function analyzeStudentResumeAts(content: StudentResumeContent, jobDescription: string): AtsMatch {
  return analyzeAtsMatch(toAtsResumeData(content), jobDescription);
}
