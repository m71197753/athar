import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(source, dependencies, environment = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(source, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, URL, Date, Set, Map,
    process: { env: environment },
    require: name => {
      assert(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}

const orm = { eq: (...args) => args, and: (...args) => args, inArray: (...args) => args, sql: (...args) => args };
const schema = {
  membershipsTable: { userId: 'user_id', status: 'status' },
  bootstrapGrantsTable: { email: 'email' }, adminAuditTable: {},
  platformSettingsTable: { key: 'key', appearance: 'appearance', enabledModules: 'enabled_modules', moduleSettings: 'module_settings' },
};
const defaultAppearance = {
  primaryColor: '#3B706B', accentColor: '#16877F', canvasColor: '#F5F7F4', surfaceColor: '#FFFEFA',
  welcomeTitle: 'ابدأ من هنا واختر مساحتك',
  welcomeDescription: 'تعلّم، وثّق ما أنجزته، وخطّط لخطوتك المهنية القادمة من المكان نفسه.',
};
const appearanceSchema = { safeParse: value => value && typeof value.primaryColor === 'string'
  ? { success: true, data: value } : { success: false } };
const defaultModuleSettings = [
  ['achievements', 'إنجازاتي'], ['learning', 'تعلّمي'], ['academy', 'المذاكرة'],
  ['languages', 'تعلّم اللغات'], ['graduates', 'مساحة الخريجين'], ['roadmap', 'خطتي المهنية'], ['resume', 'سيرتي المهنية'], ['assistant', 'المساعد الذكي'],
].map(([key, title], index) => ({ key, title, description: '', enabled: true, sortOrder: (index + 1) * 10 }));
const moduleSettingsSchema = { safeParse: value => Array.isArray(value) && value.length === 8
  ? { success: true, data: value } : { success: false } };
function response(role = 'student') {
  return { locals: { role }, statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }, setHeader(key, value) { this.headers[key] = value; } };
}

const { requireAdmin } = load('../src/middlewares/requireAdmin.ts', {
  './clerkProxyMiddleware': { getClerkProxyHost: req => req.headers.host },
});
for (const [name, role, method, origin, site, expected] of [
  ['students cannot read admin data', 'student', 'GET', undefined, undefined, 403],
  ['admins can read admin data', 'admin', 'GET', undefined, undefined, 200],
  ['same-origin admin updates allowed', 'admin', 'PUT', 'https://app.example.com', 'same-origin', 200],
  ['foreign-origin changes denied', 'admin', 'POST', 'https://evil.example', 'cross-site', 403],
  ['forged same-site origin denied', 'admin', 'DELETE', 'https://evil.example', 'same-site', 403],
  ['opaque origin denied', 'admin', 'PATCH', 'null', undefined, 403],
]) test(name, () => {
  const res = response(role); let next = false;
  requireAdmin({ method, headers: { host: 'app.example.com' },
    get: key => ({ origin, 'sec-fetch-site': site })[key] }, res, () => { next = true; });
  assert.equal(res.statusCode, expected); assert.equal(next, expected === 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

function platformFixture({ granted = false, users = [], settings = null } = {}) {
  const writes = []; let grant = granted;
  const tx = {
    execute: async () => {},
    select: () => ({ from: table => ({ where: async () => {
      if (table === schema.platformSettingsTable) return settings ? [settings] : [];
      return grant ? [{ userId: 'former-admin' }] : [];
    } }) }),
    insert: table => ({ values: value => {
      writes.push({ table, value });
      if (table === schema.bootstrapGrantsTable) grant = true;
      const done = Promise.resolve();
      done.onConflictDoUpdate = async () => {};
      return done;
    } }),
  };
  const db = {
    transaction: callback => callback(tx),
    select: tx.select,
  };
  const api = load('../src/lib/platform-access.ts', {
    '@clerk/express': { clerkClient: { users: { getUserList: async () => ({ data: users }) } } },
    'drizzle-orm': orm, '@workspace/db': { ...schema, db },
    '@workspace/api-zod': {
      GetPlatformContentResponse: { shape: { appearance: appearanceSchema, moduleSettings: moduleSettingsSchema } },
      DEFAULT_APPEARANCE: defaultAppearance, DEFAULT_MODULE_SETTINGS: defaultModuleSettings,
      ALL_MODULES: defaultModuleSettings.map(module => module.key),
    },
  }, { ADMIN_BOOTSTRAP_EMAILS: 'Owner@example.com' });
  return { api, writes };
}
const user = (email, status = 'verified') => ({
  id: 'test-owner-id', primaryEmailAddressId: 'primary',
  emailAddresses: [{ id: 'primary', emailAddress: email, verification: { status } }],
});

test('only an exact verified configured primary email can bootstrap', async () => {
  for (const candidate of [user('owner@example.com', 'unverified'), user('other@example.com'),
    { ...user('owner@example.com'), primaryEmailAddressId: 'missing' }]) {
    const { api, writes } = platformFixture();
    assert.equal(await api.bootstrapAdminUser(candidate), false);
    assert.equal(writes.length, 0);
  }
});
test('verified initial admin grant is audited and idempotent', async () => {
  const { api, writes } = platformFixture();
  assert.equal(await api.bootstrapAdminUser(user('OWNER@example.com')), true);
  assert.equal(await api.bootstrapAdminUser(user('owner@example.com')), false);
  assert.equal(writes.length, 3);
  assert.equal(writes[0].value.role, 'admin');
  assert.equal(writes[2].value.action, 'admin.bootstrap');
});
test('bootstrap ledger never restores revoked privileges', async () => {
  const { api, writes } = platformFixture({ granted: true });
  assert.equal(await api.bootstrapAdminUser(user('owner@example.com')), false);
  assert.equal(writes.length, 0);
});
test('missing initial owner is pending, not created or silently verified', async () => {
  const { api, writes } = platformFixture();
  const result = await api.seedConfiguredAdmins();
  assert.equal(result.pending, 1); assert.equal(result.granted, 0);
  assert.equal(writes.length, 0);
});
test('all eight sections are enabled by default and controlled API paths map to a module', async () => {
  const { api } = platformFixture();
  assert.equal((await api.enabledModules()).length, 8);
  assert.equal((await api.platformModuleSettings()).find(item => item.key === 'languages').enabled, true);
  for (const [path, module] of [
    ['/achievements/abc', 'achievements'], ['/ai/achievement-draft', 'achievements'],
    ['/learning-items', 'learning'], ['/languages/progress', 'languages'], ['/graduates/items', 'graduates'], ['/academy/progress/1', 'academy'],
    ['/career-plan/tasks/batch', 'roadmap'], ['/ai/career-plan-suggestions', 'roadmap'],
    ['/student/resume-share', 'resume'], ['/ai/career-assistant', 'assistant'],
  ]) assert.equal(api.requestModule(path), module);
  assert.equal(api.requestModule('/admin/users'), undefined);
});
test('legacy module settings preserve existing choices and enable newly added sections', async () => {
  const { api } = platformFixture({ settings: { enabledModules: ['learning', 'academy'], moduleSettings: null } });
  const enabled = (await api.enabledModules()).sort();
  assert.deepEqual(enabled, ['academy', 'graduates', 'languages', 'learning']);
});
test('saved text and link blocks remain attached to their built-in section', async () => {
  const blocks = [
    { type: 'text', title: 'معلومة مهمة', body: 'نص يشرح القسم.', url: '' },
    { type: 'link', title: 'مرجع إضافي', body: 'افتح الرابط للمزيد.', url: 'https://example.org/guide' },
  ];
  const moduleSettings = defaultModuleSettings.map(module => ({
    ...module, blocks: module.key === 'roadmap' ? blocks : [],
  }));
  const { api } = platformFixture({ settings: { enabledModules: defaultModuleSettings.map(item => item.key), moduleSettings } });
  assert.deepEqual((await api.platformModuleSettings()).find(item => item.key === 'roadmap').blocks, blocks);
});
test('global appearance falls back safely when no saved setting exists', async () => {
  const { api } = platformFixture();
  assert.equal((await api.platformAppearance()).primaryColor, defaultAppearance.primaryColor);
  assert.equal((await api.platformAppearance()).welcomeTitle, defaultAppearance.welcomeTitle);
});
test('legacy indigo defaults move to Athar colors while retaining welcome copy', async () => {
  const old = {
    primaryColor: '#4F46E5', accentColor: '#6366F1', canvasColor: '#F8FAFC', surfaceColor: '#FFFFFF',
    welcomeTitle: 'عنوان محفوظ', welcomeDescription: 'وصف محفوظ',
  };
  const { api } = platformFixture({ settings: { appearance: old } });
  const appearance = await api.platformAppearance();
  assert.equal(appearance.primaryColor, defaultAppearance.primaryColor);
  assert.equal(appearance.accentColor, defaultAppearance.accentColor);
  assert.equal(appearance.welcomeTitle, old.welcomeTitle);
  assert.equal(appearance.welcomeDescription, old.welcomeDescription);
});
test('custom appearance is not normalized as a legacy default', async () => {
  const custom = { ...defaultAppearance, primaryColor: '#285F80' };
  const { api } = platformFixture({ settings: { appearance: custom } });
  assert.deepEqual(await api.platformAppearance(), custom);
});

async function authFixture({ userId = 'student-id', role = 'student', status = 'active', enabled = [] } = {}) {
  const db = { select: () => ({ from: () => ({ where: async () => [{ userId, role, status }] }) }) };
  const { requireAuth } = load('../src/middlewares/requireAuth.ts', {
    '@clerk/express': { getAuth: () => ({ userId }) }, 'drizzle-orm': orm,
    '@workspace/db': { ...schema, db }, '../lib/platform-access': {
      configuredAdminEmails: () => [], enabledModules: async () => enabled,
      requestModule: path => path === '/learning-items' ? 'learning' : undefined,
    },
  });
  const res = response(); let continued = false; let failure;
  await requireAuth({ path: '/learning-items' }, res, error => { continued = !error; failure = error; });
  if (failure) throw failure;
  return { res, continued };
}
test('anonymous requests receive 401', async () => {
  const { res, continued } = await authFixture({ userId: null });
  assert.equal(res.statusCode, 401); assert.equal(continued, false);
});
test('suspension denies every signed-in role, including admins', async () => {
  for (const role of ['student', 'admin']) {
    const { res, continued } = await authFixture({ role, status: 'suspended' });
    assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'ACCOUNT_SUSPENDED');
    assert.equal(continued, false);
  }
});
test('section controls are enforced server-side for students', async () => {
  const blocked = await authFixture();
  assert.equal(blocked.res.statusCode, 403); assert.equal(blocked.res.body.code, 'MODULE_DISABLED');
  const allowed = await authFixture({ enabled: ['learning'] });
  assert.equal(allowed.continued, true);
});
test('active admins can access disabled sections', async () => {
  const { res, continued } = await authFixture({ role: 'admin' });
  assert.equal(continued, true); assert.equal(res.locals.role, 'admin');
});
