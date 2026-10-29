import type { LanguageContentItem } from "./sample-a1.ts";
import { sampleA1Content } from "./sample-a1.ts";
import { generatedEnglishBatches } from "./batches/index.ts";

export type SupportedLanguageCode = "en" | "fr" | "es" | "de" | "tr";

export const languageLabels: Record<SupportedLanguageCode, string> = {
  en: "الإنجليزية",
  fr: "الفرنسية",
  es: "الإسبانية",
  de: "الألمانية",
  tr: "التركية",
};

export const languageLocales: Record<SupportedLanguageCode, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  tr: "tr-TR",
};

function word(
  languageCode: Exclude<SupportedLanguageCode, "en">,
  slug: string,
  category: string,
  partOfSpeech: string,
  target: string,
  arabic: string,
  pronunciationArabic: string,
  exampleTarget: string,
  exampleArabic: string,
  difficulty: number,
): LanguageContentItem {
  return {
    id: `${languageCode}-a1-word-${slug}`,
    languageCode,
    level: "A1",
    kind: "word",
    category,
    partOfSpeech,
    english: target,
    arabic,
    pronunciationArabic,
    exampleEnglish: exampleTarget,
    exampleArabic,
    difficulty,
    relatedWordIds: [],
  };
}

function sentence(
  languageCode: Exclude<SupportedLanguageCode, "en">,
  slug: string,
  category: string,
  target: string,
  arabic: string,
  grammarNote: string,
  relatedWordIds: string[],
  difficulty: number,
): LanguageContentItem {
  return {
    id: `${languageCode}-a1-sentence-${slug}`,
    languageCode,
    level: "A1",
    kind: "sentence",
    category,
    english: target,
    arabic,
    grammarNote,
    difficulty,
    relatedWordIds,
  };
}

const french: LanguageContentItem[] = [
  word("fr", "bonjour-001", "التواصل", "عبارة", "Bonjour", "مرحبًا", "بونجور", "Bonjour, je m'appelle Lina.", "مرحبًا، اسمي لينا.", 1),
  word("fr", "etudier-002", "الدراسة", "فعل", "étudier", "يدرس", "إيتودييه", "J'étudie le français chaque jour.", "أدرس الفرنسية كل يوم.", 2),
  word("fr", "travail-003", "العمل", "اسم", "travail", "عمل", "ترافاي", "Je cherche un travail intéressant.", "أبحث عن عمل ممتع.", 2),
  word("fr", "apprendre-004", "التعلّم", "فعل", "apprendre", "يتعلّم", "أپرَندْر", "J'apprends avec de petits exercices.", "أتعلّم بتمارين قصيرة.", 3),
  word("fr", "parler-005", "التواصل", "فعل", "parler", "يتحدث", "پارليه", "Je parle avec mon équipe.", "أتحدث مع فريقي.", 3),
  word("fr", "projet-006", "العمل", "اسم", "projet", "مشروع", "پروجيه", "Mon projet aide les étudiants.", "مشروعي يساعد الطلاب.", 3),
  sentence("fr", "name-007", "التواصل", "Je m'appelle Lina.", "اسمي لينا.", "نستخدم Je m'appelle للتعريف بالاسم.", ["fr-a1-word-bonjour-001"], 1),
  sentence("fr", "course-008", "الدراسة", "Le cours commence à neuf heures.", "تبدأ المحاضرة في التاسعة.", "تأتي à قبل وقت محدد.", ["fr-a1-word-etudier-002"], 2),
  sentence("fr", "team-009", "العمل", "Nous travaillons ensemble.", "نعمل معًا.", "تعني Nous ضمير نحن، ويأتي الفعل بصيغة الجمع.", ["fr-a1-word-travail-003"], 2),
  sentence("fr", "interview-010", "العمل", "Je prépare un entretien.", "أستعد لمقابلة.", "تأتي أداة un قبل الاسم المذكر المفرد.", ["fr-a1-word-apprendre-004"], 3),
  sentence("fr", "project-011", "العمل", "Je peux présenter mon projet.", "أستطيع تقديم مشروعي.", "يأتي الفعل بصيغته الأساسية بعد peux.", ["fr-a1-word-projet-006"], 3),
  sentence("fr", "practice-012", "التعلّم", "Je parle français chaque jour.", "أتحدث الفرنسية كل يوم.", "تأتي اللغة بلا أداة تعريف بعد parler.", ["fr-a1-word-parler-005"], 3),
];

const spanish: LanguageContentItem[] = [
  word("es", "hola-001", "التواصل", "عبارة", "Hola", "مرحبًا", "أولا", "Hola, me llamo Lina.", "مرحبًا، اسمي لينا.", 1),
  word("es", "estudiar-002", "الدراسة", "فعل", "estudiar", "يدرس", "إستوديَار", "Estudio español cada día.", "أدرس الإسبانية كل يوم.", 2),
  word("es", "trabajo-003", "العمل", "اسم", "trabajo", "عمل", "تراباخو", "Busco un trabajo interesante.", "أبحث عن عمل ممتع.", 2),
  word("es", "aprender-004", "التعلّم", "فعل", "aprender", "يتعلّم", "أپريندير", "Aprendo con ejercicios breves.", "أتعلّم بتمارين قصيرة.", 3),
  word("es", "hablar-005", "التواصل", "فعل", "hablar", "يتحدث", "أبلار", "Hablo con mi equipo.", "أتحدث مع فريقي.", 3),
  word("es", "proyecto-006", "العمل", "اسم", "proyecto", "مشروع", "پروييكتو", "Mi proyecto ayuda a los estudiantes.", "مشروعي يساعد الطلاب.", 3),
  sentence("es", "name-007", "التواصل", "Me llamo Lina.", "اسمي لينا.", "نستخدم Me llamo للتعريف بالاسم.", ["es-a1-word-hola-001"], 1),
  sentence("es", "course-008", "الدراسة", "La clase empieza a las nueve.", "تبدأ المحاضرة في التاسعة.", "نستخدم a las قبل الوقت.", ["es-a1-word-estudiar-002"], 2),
  sentence("es", "team-009", "العمل", "Trabajamos juntos.", "نعمل معًا.", "انتهى الفعل trabajamos بما يناسب ضمير نحن.", ["es-a1-word-trabajo-003"], 2),
  sentence("es", "interview-010", "العمل", "Me preparo para una entrevista.", "أستعد لمقابلة.", "تأتي para لبيان الغرض أو الاتجاه.", ["es-a1-word-aprender-004"], 3),
  sentence("es", "project-011", "العمل", "Puedo presentar mi proyecto.", "أستطيع تقديم مشروعي.", "يأتي الفعل بصيغته الأساسية بعد puedo.", ["es-a1-word-proyecto-006"], 3),
  sentence("es", "practice-012", "التعلّم", "Hablo español cada día.", "أتحدث الإسبانية كل يوم.", "يتغير الفعل hablar إلى hablo مع ضمير المتكلم.", ["es-a1-word-hablar-005"], 3),
];

const german: LanguageContentItem[] = [
  word("de", "hallo-001", "التواصل", "عبارة", "Hallo", "مرحبًا", "هالو", "Hallo, ich heiße Lina.", "مرحبًا، اسمي لينا.", 1),
  word("de", "lernen-002", "الدراسة", "فعل", "lernen", "يتعلّم / يدرس", "ليرنن", "Ich lerne jeden Tag Deutsch.", "أتعلم الألمانية كل يوم.", 2),
  word("de", "arbeit-003", "العمل", "اسم", "Arbeit", "عمل", "آربايت", "Ich suche eine interessante Arbeit.", "أبحث عن عمل ممتع.", 2),
  word("de", "verbessern-004", "التعلّم", "فعل", "verbessern", "يحسّن", "فِربِسَرن", "Ich verbessere meine Aussprache.", "أحسّن نطقي.", 3),
  word("de", "sprechen-005", "التواصل", "فعل", "sprechen", "يتحدث", "شپريخن", "Ich spreche mit meinem Team.", "أتحدث مع فريقي.", 3),
  word("de", "projekt-006", "العمل", "اسم", "Projekt", "مشروع", "پروييكت", "Mein Projekt hilft Studierenden.", "مشروعي يساعد الطلاب.", 3),
  sentence("de", "name-007", "التواصل", "Ich heiße Lina.", "اسمي لينا.", "يُستخدم heiße للتعريف بالاسم.", ["de-a1-word-hallo-001"], 1),
  sentence("de", "course-008", "الدراسة", "Der Kurs beginnt um neun Uhr.", "تبدأ الدورة في التاسعة.", "تأتي um قبل الوقت المحدد.", ["de-a1-word-lernen-002"], 2),
  sentence("de", "team-009", "العمل", "Wir arbeiten zusammen.", "نعمل معًا.", "يأتي الفعل بصيغة الجمع مع Wir.", ["de-a1-word-arbeit-003"], 2),
  sentence("de", "interview-010", "العمل", "Ich bereite mich auf ein Gespräch vor.", "أستعد لمقابلة.", "الفعل المنفصل vor|bereiten يأتي جزءه في نهاية الجملة.", ["de-a1-word-verbessern-004"], 3),
  sentence("de", "project-011", "العمل", "Ich kann mein Projekt vorstellen.", "أستطيع عرض مشروعي.", "يأتي الفعل بصيغته الأساسية بعد kann.", ["de-a1-word-projekt-006"], 3),
  sentence("de", "practice-012", "التعلّم", "Ich spreche jeden Tag Deutsch.", "أتحدث الألمانية كل يوم.", "يأتي الفعل بصيغة المتكلم Ich spreche.", ["de-a1-word-sprechen-005"], 3),
];

const turkish: LanguageContentItem[] = [
  word("tr", "merhaba-001", "التواصل", "عبارة", "Merhaba", "مرحبًا", "ميرهابا", "Merhaba, benim adım Lina.", "مرحبًا، اسمي لينا.", 1),
  word("tr", "calismak-002", "الدراسة", "فعل", "çalışmak", "يدرس / يعمل", "تشاليشماك", "Her gün Türkçe çalışıyorum.", "أدرس التركية كل يوم.", 2),
  word("tr", "is-003", "العمل", "اسم", "iş", "عمل", "إيش", "İlginç bir iş arıyorum.", "أبحث عن عمل ممتع.", 2),
  word("tr", "ogrenmek-004", "التعلّم", "فعل", "öğrenmek", "يتعلّم", "أورينمك", "Kısa alıştırmalarla öğreniyorum.", "أتعلّم بتمارين قصيرة.", 3),
  word("tr", "konusmak-005", "التواصل", "فعل", "konuşmak", "يتحدث", "كونوشماك", "Ekibimle konuşuyorum.", "أتحدث مع فريقي.", 3),
  word("tr", "proje-006", "العمل", "اسم", "proje", "مشروع", "پروجيه", "Projem öğrencilere yardım ediyor.", "مشروعي يساعد الطلاب.", 3),
  sentence("tr", "name-007", "التواصل", "Benim adım Lina.", "اسمي لينا.", "تُستخدم Benim adım للتعريف بالاسم.", ["tr-a1-word-merhaba-001"], 1),
  sentence("tr", "course-008", "الدراسة", "Ders saat dokuzda başlıyor.", "تبدأ المحاضرة في التاسعة.", "تأتي اللاحقة -da لتحديد وقت حدوث الفعل.", ["tr-a1-word-calismak-002"], 2),
  sentence("tr", "team-009", "العمل", "Birlikte çalışıyoruz.", "نعمل معًا.", "تنتهي صيغة الفعل بـ -yoruz مع ضمير نحن.", ["tr-a1-word-is-003"], 2),
  sentence("tr", "interview-010", "العمل", "Bir görüşme için hazırlanıyorum.", "أستعد لمقابلة.", "تأتي için لبيان الغرض.", ["tr-a1-word-ogrenmek-004"], 3),
  sentence("tr", "project-011", "العمل", "Projemi sunabilirim.", "أستطيع تقديم مشروعي.", "تُستخدم اللاحقة -bil لبيان الاستطاعة.", ["tr-a1-word-proje-006"], 3),
  sentence("tr", "practice-012", "التعلّم", "Her gün Türkçe konuşuyorum.", "أتحدث التركية كل يوم.", "تُستخدم اللاحقة -yorum مع المتكلم المفرد في المضارع.", ["tr-a1-word-konusmak-005"], 3),
];

export const languageCatalogs: Record<SupportedLanguageCode, LanguageContentItem[]> = {
  en: [...sampleA1Content, ...generatedEnglishBatches],
  fr: french,
  es: spanish,
  de: german,
  tr: turkish,
};

export const allLanguageContent = Object.values(languageCatalogs).flat();

export const supportedLanguages = (Object.keys(languageCatalogs) as SupportedLanguageCode[])
  .map(code => ({ code, label: languageLabels[code], locale: languageLocales[code] }));
