import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(source, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(source, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, Date, Set, Map, Math,
    require: name => {
      assert(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}

const rewards = load('../src/lib/language-session-rewards.ts');
const rules = { baseXp: 10, accuracyBonusXp: 5, reviewBonusXp: 5 };
const answers = (entries) => entries.map(([contentId, isCorrect = true, mode = 'recall']) => ({
  contentId, isCorrect, mode,
}));

test('rewarded correct items cannot earn points again with a new session reference', () => {
  const result = rewards.calculateLanguageSessionRewards({
    answers: answers(Array.from({ length: 10 }, (_, index) => [`item-${index}`])),
    rewardedContentIds: new Set(Array.from({ length: 10 }, (_, index) => `item-${index}`)),
    dueContentIds: new Set(),
    sessionKind: 'lesson',
    rules,
  });
  assert.equal(result.freshQuestionCount, 0);
  assert.equal(result.xpEarned, 0);
});

test('server-graded incorrect items do not earn base points, and fresh accuracy controls the bonus', () => {
  const sessionAnswers = answers(Array.from({ length: 10 }, (_, index) => [
    `item-${index}`, index < 9,
  ]));
  const result = rewards.calculateLanguageSessionRewards({
    answers: sessionAnswers,
    rewardedContentIds: new Set(),
    dueContentIds: new Set(),
    sessionKind: 'lesson',
    rules,
  });
  assert.equal(result.xpEarned, 14);
});

test('pronunciation transcript scores remain practice feedback, not leaderboard points', () => {
  const result = rewards.calculateLanguageSessionRewards({
    answers: answers(Array.from({ length: 10 }, (_, index) => [
      `item-${index}`, true, index < 2 ? 'recall' : 'pronunciation',
    ])),
    rewardedContentIds: new Set(),
    dueContentIds: new Set(),
    sessionKind: 'lesson',
    rules,
  });
  assert.equal(result.xpEarned, 2);
});

test('review rewards and heart recovery require ten fresh, correct, due items', () => {
  const notReady = rewards.calculateLanguageSessionRewards({
    answers: answers(Array.from({ length: 10 }, (_, index) => [`due-${index}`])),
    rewardedContentIds: new Set(['due-0']),
    dueContentIds: new Set(Array.from({ length: 10 }, (_, index) => `due-${index}`)),
    sessionKind: 'review',
    rules,
  });
  assert.equal(notReady.reviewQualified, false);
  assert.equal(notReady.xpEarned, 9);

  const ready = rewards.calculateLanguageSessionRewards({
    answers: answers(Array.from({ length: 10 }, (_, index) => [`due-${index}`])),
    rewardedContentIds: new Set(),
    dueContentIds: new Set(Array.from({ length: 10 }, (_, index) => `due-${index}`)),
    sessionKind: 'review',
    rules,
  });
  assert.equal(ready.reviewQualified, true);
  assert.equal(ready.xpEarned, 20);
});

test('daily reward lookup uses UTC midnight, independent of client timezone', () => {
  const start = rewards.getUtcRewardDayStart(new Date('2026-10-29T23:59:00.000Z'));
  assert.equal(start.toISOString(), '2026-10-29T00:00:00.000Z');
});

test('already rewarded items come only from successful non-pronunciation answers', () => {
  const ids = rewards.collectRewardedContentIds([
    { answers: answers([['good'], ['wrong', false], ['spoken', true, 'pronunciation']]) },
  ]);
  assert.deepEqual([...ids], ['good']);
});

const routeSource = readFileSync(new URL('../src/routes/language-admin.ts', import.meta.url), 'utf8');
const routeAst = ts.createSourceFile(
  'language-admin.ts',
  routeSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

function collectAdminRoutes(node, routes = []) {
  if (ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && ts.isIdentifier(node.expression.expression)
    && node.expression.expression.text === 'router'
    && ['get', 'post', 'put', 'patch', 'delete'].includes(node.expression.name.text)) {
    const [path, ...handlers] = node.arguments;
    if (ts.isStringLiteral(path) && path.text.startsWith('/admin/language')) {
      routes.push({ path: path.text, handlers });
    }
  }
  ts.forEachChild(node, child => {
    collectAdminRoutes(child, routes);
  });
  return routes;
}

test('every language administration endpoint requires authentication and admin role', () => {
  const routes = collectAdminRoutes(routeAst);
  assert.ok(routes.length >= 5, 'expected all language admin endpoints to be checked');
  for (const route of routes) {
    const middleware = route.handlers.slice(0, -1).map(handler =>
      ts.isIdentifier(handler) ? handler.text : '',
    );
    assert.deepEqual(middleware.slice(0, 2), ['requireAuth', 'requireAdmin'], route.path);
  }
});

const contentSafety = load('../src/lib/language-content-safety.ts');

test('language content with review history cannot be moved to another language or level', () => {
  const current = { languageCode: 'en', level: 'A1' };
  assert.equal(contentSafety.canChangeLanguageContentLocation(
    current, { level: 'A2' }, true,
  ), false);
  assert.equal(contentSafety.canChangeLanguageContentLocation(
    current, { languageCode: 'fr' }, true,
  ), false);
  assert.equal(contentSafety.canChangeLanguageContentLocation(
    current, { level: 'A1' }, true,
  ), true);
  assert.equal(contentSafety.canChangeLanguageContentLocation(
    current, { level: 'A2' }, false,
  ), true);
});

test('content archive remains a soft update, preserving student review records', () => {
  assert.match(routeSource, /db\.update\(languageContentItemsTable\)\.set\(\{\s*\.\.\.parsed\.data/);
  assert.doesNotMatch(routeSource, /db\.delete\(languageReviewStatesTable\)/);
  assert.match(routeSource, /languageReviewStatesTable\.contentId, existing\.id/);
});

test('session points are based on the server grade, not a client-provided correctness flag', () => {
  const sessionSource = readFileSync(new URL('../src/routes/languages.ts', import.meta.url), 'utf8');
  assert.match(sessionSource, /gradeLanguageAnswer\(item as LanguageContentItem, answer\.mode, answer\.submittedAnswer\)/);
  assert.match(sessionSource, /const correctAnswers = validatedAnswers\.filter\(answer => answer\.isCorrect\)\.length/);
  assert.match(sessionSource, /calculateLanguageSessionRewards\(\s*\{\s*answers: validatedAnswers/);
});
