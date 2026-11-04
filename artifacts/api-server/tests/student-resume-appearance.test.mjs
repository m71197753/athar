import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const zodRequire = createRequire(new URL('../../../lib/api-zod/package.json', import.meta.url));
const module = { exports: {} };
const source = ts.transpileModule(readFileSync(new URL('../../../lib/api-zod/src/generated/api.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(source, { module, exports: module.exports, require: name => {
  assert.equal(name, 'zod');
  return zodRequire(name);
} });

test('guided and manual resumes accept Arabic font choices and appearance values', () => {
  for (const origin of ['guided', 'manual']) {
    for (const fontFamily of ['Cairo', 'IBM Plex Sans Arabic']) {
      const result = module.exports.UpdateStudentResumeBody.safeParse({
        title: 'مسودتي',
        origin,
        template: 'ats',
        content: {
        fullName: '', email: '', phone: '', location: '', linkedin: '', website: '',
        headline: '', summary: '', education: [], experience: [], projects: [], courses: [],
        skills: [], certifications: [], languages: [],
        appearance: {
          fontFamily, fontSize: 14, pageColor: '#FFFFFF', textColor: '#303746',
          headingColor: '#1F2937', accentColor: '#5147C8',
        },
        },
      });
      assert(result.success, JSON.stringify(result.error?.issues));
      assert.equal(result.data.content.appearance.fontFamily, fontFamily);
      assert.equal(result.data.content.appearance.fontSize, 14);
    }
  }
});
