import type { ModuleSetting } from "./generated/types/moduleSetting";

export const DEFAULT_MODULE_SETTINGS: ModuleSetting[] = [
  { key: "achievements", title: "إنجازاتي", description: "تابع تقدمك واستعرض إنجازاتك المهنية.", enabled: true, sortOrder: 10, iconKey: "award", accentKey: "amber", cardStyle: "soft", blocks: [] },
  { key: "learning", title: "تعلّمي", description: "تابع مسارك التعليمي واكتساب المعرفة.", enabled: true, sortOrder: 20, iconKey: "book", accentKey: "indigo", cardStyle: "soft", blocks: [] },
  { key: "academy", title: "المذاكرة", description: "نظّم جلسات مذاكرتك وراجع دروسك.", enabled: true, sortOrder: 30, iconKey: "graduation", accentKey: "violet", cardStyle: "soft", blocks: [] },
  { key: "languages", title: "تعلّم اللغات", description: "طوّر مهاراتك اللغوية بخطوات قصيرة.", enabled: true, sortOrder: 40, iconKey: "languages", accentKey: "teal", cardStyle: "soft", blocks: [] },
  { key: "graduates", title: "مساحة الخريجين", description: "تابع الفرص المهنية وتواصل مع مجتمع الخريجين.", enabled: true, sortOrder: 45, iconKey: "briefcase", accentKey: "green", cardStyle: "soft", blocks: [] },
  { key: "roadmap", title: "خطتي المهنية", description: "حدّد أهدافك وخطّط لخطوتك القادمة.", enabled: true, sortOrder: 50, iconKey: "route", accentKey: "blue", cardStyle: "soft", blocks: [] },
  { key: "resume", title: "سيرتي المهنية", description: "نظّم خبراتك ومهاراتك في سيرتك.", enabled: true, sortOrder: 60, iconKey: "file", accentKey: "green", cardStyle: "soft", blocks: [] },
  { key: "assistant", title: "المساعد الذكي", description: "احصل على المساعدة في التعلّم والتخطيط.", enabled: true, sortOrder: 70, iconKey: "sparkles", accentKey: "violet", cardStyle: "soft", blocks: [] },
];

export const ALL_MODULES = DEFAULT_MODULE_SETTINGS.map(module => module.key);
