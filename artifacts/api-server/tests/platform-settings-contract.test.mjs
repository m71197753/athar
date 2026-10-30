import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const zodRequire = createRequire(new URL('../../../lib/api-zod/package.json', import.meta.url));
function load(path, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    assert(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return module.exports;
}
const api = load('../../../lib/api-zod/src/generated/api.ts', { zod: zodRequire('zod') });
const { DEFAULT_MODULE_SETTINGS } = load('../../../lib/api-zod/src/platform-modules.ts');
const { DEFAULT_APPEARANCE } = load('../../../lib/api-zod/src/platform-appearance.ts');

test('settings contract accepts every configured section and card appearance fields', () => {
  const result = api.SaveAdminSettingsBody.strict().safeParse({
    moduleSettings: DEFAULT_MODULE_SETTINGS,
    appearance: { ...DEFAULT_APPEARANCE, cardTextColor: '#334155', cardBorderColor: '#AABBCC', fontScale: 110 },
  });
  assert(result.success, JSON.stringify(result.error?.issues));
  assert.equal(result.data.moduleSettings.length, DEFAULT_MODULE_SETTINGS.length);
  assert.equal(result.data.appearance.cardBorderColor, '#AABBCC');
});

test('settings contract still rejects malformed colors and missing configuration', () => {
  assert.equal(api.SaveAdminSettingsBody.strict().safeParse({
    moduleSettings: DEFAULT_MODULE_SETTINGS, appearance: { ...DEFAULT_APPEARANCE, cardTextColor: 'invalid' },
  }).success, false);
  assert.equal(api.SaveAdminSettingsBody.strict().safeParse({
    moduleSettings: [], appearance: DEFAULT_APPEARANCE,
  }).success, false);
});
