import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const batchDirectory = path.join(root, 'src', 'batches');
const indexPath = path.join(batchDirectory, 'index.ts');
const files = (await readdir(batchDirectory))
  .filter(file => file.endsWith('.json'))
  .sort();

for (const file of files) {
  const content = JSON.parse(await readFile(path.join(batchDirectory, file), 'utf8'));
  if (!Array.isArray(content) || content.length === 0 || content.length > 250) {
    throw new Error(`${file}: كل دفعة يجب أن تكون مصفوفة من 1 إلى 250 عنصرًا.`);
  }
  if (content.some(item => item?.languageCode !== 'en')) {
    throw new Error(`${file}: دفعات مكتبة الإنجليزية تقبل عناصر اللغة en فقط.`);
  }
}

const imports = files.map((file, index) =>
  `import batch${index + 1} from ${JSON.stringify(`./${file}`)} with { type: "json" };`,
);
const items = files.map((_, index) =>
  `  ...(batch${index + 1} as unknown as LanguageContentItem[]),`,
);

const source = [
  'import type { LanguageContentItem } from "../sample-a1.ts";',
  ...imports,
  '',
  'export const generatedEnglishBatches: LanguageContentItem[] = [',
  ...items,
  '];',
  '',
].join('\n');

await writeFile(indexPath, source);
console.log(`تم ربط ${files.length} دفعة JSON بكتالوج التشغيل.`);
