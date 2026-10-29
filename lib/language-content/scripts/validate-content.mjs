import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { allLanguageContent, languageLabels, supportedLanguages } from '../src/index.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const batchDirectory = path.join(root, 'src', 'batches');
const requirements = [
  { level: 'A1', words: 1500, sentences: 1500 },
  { level: 'A2', words: 1500, sentences: 1500 },
  { level: 'B1', words: 1200, sentences: 1200 },
  { level: 'B2', words: 800, sentences: 800 },
];

const errors = [];
let batches = [];
let batchFileCount = 0;
try {
  const files = (await readdir(batchDirectory)).filter(file => file.endsWith('.json')).sort();
  batchFileCount = files.length;
  for (const file of files) {
    const content = JSON.parse(await readFile(path.join(batchDirectory, file), 'utf8'));
    if (!Array.isArray(content)) throw new Error(`${file}: يجب أن يحتوي الملف على مصفوفة عناصر.`);
    if (content.length === 0 || content.length > 250) {
      errors.push(`${file}: يجب أن تحتوي الدفعة على 1 إلى 250 عنصرًا، والموجود ${content.length}.`);
    }
    batches = batches.concat(content);
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const items = allLanguageContent;
const englishItems = items.filter(item => item.languageCode === 'en');
const ids = new Set();
const englishKeys = new Set();
const byId = new Map(items.map(item => [item.id, item]));
const supportedCodes = new Set(supportedLanguages.map(language => language.code));
const englishCategories = new Map();
const placeholderText = /\b(?:todo|tbd|lorem ipsum|your text here|example text)\b|(?:ضع النص هنا|أضف النص هنا|اكتب هنا)/iu;
const commonEnglishMisspellings = new Map([
  ['teh', 'the'],
  ['recieve', 'receive'],
  ['acheive', 'achieve'],
  ['seperate', 'separate'],
  ['definately', 'definitely'],
  ['occured', 'occurred'],
  ['untill', 'until'],
  ['thier', 'their'],
  ['becuase', 'because'],
  ['freind', 'friend'],
  ['langauge', 'language'],
  ['tommorow', 'tomorrow'],
  ['alot', 'a lot'],
]);
const commonArabicMisspellings = new Map([
  ['هاذا', 'هذا'],
  ['هاذه', 'هذه'],
  ['لاكن', 'لكن'],
  ['انشالله', 'إن شاء الله'],
  ['انشاءالله', 'إن شاء الله'],
]);
const runtimeIds = new Set(items.map(item => item.id));
for (const batchItem of batches) {
  if (batchItem?.id && !runtimeIds.has(batchItem.id)) {
    errors.push(`${batchItem.id}: الدفعة غير موصولة بكتالوج التشغيل؛ شغّل sync:batches.`);
  }
}

for (const [index, item] of items.entries()) {
  const label = item?.id || `عنصر ${index + 1}`;
  for (const field of ['id', 'languageCode', 'level', 'kind', 'category', 'english', 'arabic']) {
    if (typeof item?.[field] !== 'string' || !item[field].trim()) errors.push(`${label}: الحقل ${field} ناقص.`);
  }
  if (!Number.isInteger(item?.difficulty) || item.difficulty < 1 || item.difficulty > 10) {
    errors.push(`${label}: difficulty يجب أن يكون عددًا من 1 إلى 10.`);
  }
  if (!Array.isArray(item?.relatedWordIds)) errors.push(`${label}: relatedWordIds يجب أن يكون مصفوفة.`);
  if (item?.languageCode && !supportedCodes.has(item.languageCode)) {
    errors.push(`${label}: رمز اللغة ${item.languageCode} غير مسجل في كتالوج اللغات الحالي.`);
  }
  if (item?.languageCode === 'en' && item?.category) {
    englishCategories.set(item.category, (englishCategories.get(item.category) ?? 0) + 1);
  }
  for (const field of ['english', 'arabic', 'exampleEnglish', 'exampleArabic', 'grammarNote']) {
    if (typeof item?.[field] === 'string' && placeholderText.test(item[field])) {
      errors.push(`${label}: يحتوي الحقل ${field} على نص تجريبي غير صالح للنشر.`);
    }
  }
  const englishWords = [item?.english, item?.exampleEnglish]
    .filter(value => typeof value === 'string')
    .join(' ')
    .toLowerCase()
    .match(/\p{L}+/gu) ?? [];
  for (const [misspelling, correction] of commonEnglishMisspellings) {
    if (englishWords.includes(misspelling)) {
      errors.push(`${label}: تهجئة إنجليزية محتملة "${misspelling}"؛ راجعها إلى "${correction}".`);
    }
  }
  const arabicText = [item?.arabic, item?.exampleArabic, item?.grammarNote]
    .filter(value => typeof value === 'string')
    .join(' ')
    .replace(/\p{M}/gu, '');
  for (const [misspelling, correction] of commonArabicMisspellings) {
    if (arabicText.includes(misspelling)) {
      errors.push(`${label}: تهجئة عربية محتملة "${misspelling}"؛ راجعها إلى "${correction}".`);
    }
  }
  if (item?.kind === 'word') {
    for (const field of ['partOfSpeech', 'pronunciationArabic', 'exampleEnglish', 'exampleArabic']) {
      if (typeof item?.[field] !== 'string' || !item[field].trim()) errors.push(`${label}: بيانات الكلمة ناقصة (${field}).`);
    }
  } else if (item?.kind !== 'sentence') {
    errors.push(`${label}: kind يجب أن يكون word أو sentence.`);
  }
  if (item?.level && !requirements.some(target => target.level === item.level)) {
    errors.push(`${label}: مستوى غير مدعوم.`);
  }
  if (item?.id && ids.has(item.id)) errors.push(`معرّف مكرر: ${item.id}.`);
  ids.add(item?.id);
  const englishKey = `${item?.languageCode}:${item?.level}:${item?.kind}:${item?.english?.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()}`;
  if (englishKeys.has(englishKey)) errors.push(`محتوى إنجليزي مكرر: ${label}.`);
  englishKeys.add(englishKey);
  for (const relatedId of item?.relatedWordIds ?? []) {
    const relatedItem = byId.get(relatedId);
    if (!relatedItem) {
      errors.push(`${label}: المرجع ${relatedId} غير موجود.`);
    } else if (relatedItem.kind !== 'word' || relatedItem.languageCode !== item.languageCode) {
      errors.push(`${label}: المرجع ${relatedId} يجب أن يكون كلمة في اللغة نفسها.`);
    }
  }
}

let complete = errors.length === 0;
let expectedTotal = 0;
let actualTotal = 0;
console.log('تقرير مكتبة اللغة الإنجليزية (المطلوب 10,000 عنصر)');
console.log('| المستوى | كلمات مطلوبة | كلمات موجودة | جمل مطلوبة | جمل موجودة |');
console.log('|---|---:|---:|---:|---:|');
for (const target of requirements) {
  const words = englishItems.filter(item => item.level === target.level && item.kind === 'word').length;
  const sentences = englishItems.filter(item => item.level === target.level && item.kind === 'sentence').length;
  expectedTotal += target.words + target.sentences;
  actualTotal += words + sentences;
  console.log(`| ${target.level} | ${target.words} | ${words} | ${target.sentences} | ${sentences} |`);
  if (words !== target.words || sentences !== target.sentences) complete = false;
}
console.log(`الإجمالي: ${actualTotal} من ${expectedTotal}.`);
console.log(`ملفات دفعات JSON: ${batchFileCount}؛ الحد الأقصى لكل ملف 250 عنصرًا.`);
console.log('توزيع التصنيفات في المحتوى الحالي:');
for (const [category, count] of [...englishCategories].sort(([a], [b]) => a.localeCompare(b, 'ar'))) {
  console.log(`- ${category}: ${count}`);
}
console.log('عينات اللغات الإضافية:');
for (const { code, label } of supportedLanguages.filter(language => language.code !== 'en')) {
  const sample = allLanguageContent.filter(item => item.languageCode === code);
  console.log(`- ${label || languageLabels[code]}: ${sample.filter(item => item.kind === 'word').length} كلمات و${sample.filter(item => item.kind === 'sentence').length} جمل.`);
}
if (errors.length) {
  complete = false;
  console.error(`أخطاء جودة البيانات: ${errors.length}`);
  for (const error of errors.slice(0, 30)) console.error(`- ${error}`);
}
console.log(complete ? 'الحالة: مكتملة واجتازت التحقق.' : 'الحالة: غير مكتملة أو بها أخطاء؛ لا تُعرض كمكتبة مكتملة.');

if (!complete && !process.argv.includes('--report-only')) process.exitCode = 1;
