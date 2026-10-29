import {
  Award, BookOpen, BriefcaseBusiness, Code2, FileText, Globe, GraduationCap,
  Heart, Languages, Layers3, Route, Sparkles, Target, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const SECTION_ICON_OPTIONS = [
  { value: "book", label: "كتاب", icon: BookOpen },
  { value: "file", label: "ملف", icon: FileText },
  { value: "graduation", label: "قبعة تخرّج", icon: GraduationCap },
  { value: "briefcase", label: "حقيبة مهنية", icon: BriefcaseBusiness },
  { value: "target", label: "هدف", icon: Target },
  { value: "sparkles", label: "إبداع", icon: Sparkles },
  { value: "languages", label: "لغات", icon: Languages },
  { value: "award", label: "إنجاز", icon: Award },
  { value: "layers", label: "طبقات", icon: Layers3 },
  { value: "route", label: "مسار", icon: Route },
  { value: "globe", label: "عالم", icon: Globe },
  { value: "code", label: "برمجة", icon: Code2 },
  { value: "heart", label: "صحة", icon: Heart },
  { value: "users", label: "مجتمع", icon: Users },
] as const satisfies ReadonlyArray<{ value: string; label: string; icon: LucideIcon }>;

export const SECTION_ACCENT_OPTIONS = [
  { value: "teal", label: "تركواز هادئ", color: "#2E5D59", soft: "#E7F0EB" },
  { value: "green", label: "أخضر", color: "#3C7561", soft: "#E7F0EB" },
  { value: "blue", label: "أزرق", color: "#547994", soft: "#E9EFF3" },
  { value: "indigo", label: "نيلي", color: "#5D5D99", soft: "#EEEFFE" },
  { value: "violet", label: "بنفسجي", color: "#756AC8", soft: "#F0EDFD" },
  { value: "amber", label: "عنبر", color: "#987344", soft: "#F3EEE4" },
  { value: "rose", label: "وردي هادئ", color: "#A95F71", soft: "#F8EDF0" },
] as const satisfies ReadonlyArray<{ value: string; label: string; color: string; soft: string }>;

export const SECTION_CARD_STYLE_OPTIONS = [
  { value: "soft", label: "هادئ" },
  { value: "outlined", label: "محدّد بإطار" },
  { value: "gradient", label: "متدرّج" },
] as const;

export type SectionIconKey = (typeof SECTION_ICON_OPTIONS)[number]["value"];
export type SectionAccentKey = (typeof SECTION_ACCENT_OPTIONS)[number]["value"];
export type SectionCardStyle = (typeof SECTION_CARD_STYLE_OPTIONS)[number]["value"];

const iconByKey = new Map<string, LucideIcon>(SECTION_ICON_OPTIONS.map(option => [option.value, option.icon]));
const accentByKey = new Map<string, (typeof SECTION_ACCENT_OPTIONS)[number]>(
  SECTION_ACCENT_OPTIONS.map(option => [option.value, option]),
);

export function getSectionIcon(key?: string | null): LucideIcon {
  return iconByKey.get(key ?? "") ?? BookOpen;
}

export function getSectionAccent(key?: string | null) {
  return accentByKey.get(key ?? "") ?? SECTION_ACCENT_OPTIONS[0];
}
