import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const tables = {
  membershipsTable: {}, adminAuditTable: {},
  platformContentTable: {},
  platformSettingsTable: { key: 'settings.key', moduleSettings: 'settings.moduleSettings' },
  platformSectionsTable: {
    id: 'sections.id', published: 'sections.published', blocks: 'sections.blocks',
    courses: 'sections.courses',
    sortOrder: 'sections.sortOrder', updatedAt: 'sections.updatedAt',
  },
  platformMediaAssetsTable: {
    id: 'media.id', ownerId: 'media.ownerId', status: 'media.status',
    mime: 'media.mime', size: 'media.size', objectPath: 'media.objectPath',
  },
  studentsTable: {}, achievementsTable: {}, learningItemsTable: {},
  careerPlansTable: {}, resumeSharesTable: {},
};
const tableRows = new Map([
  [tables.platformSectionsTable, []],
  [tables.platformMediaAssetsTable, []],
  [tables.adminAuditTable, []],
]);

function matches(row, condition) {
  if (!condition) return true;
  if (condition.operator === 'and') return condition.conditions.every(item => matches(row, item));
  const key = condition.column.split('.').at(-1);
  if (condition.operator === 'eq') return row[key] === condition.value;
  if (condition.operator === 'in') return condition.values.includes(row[key]);
  return true;
}

function createDatabase() {
  let nextId = 0;
  const rowsFor = table => tableRows.get(table) ?? [];
  const queryResult = rows => ({
    limit: async count => rows.slice(0, count),
    then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
  });
  const db = {
    select: () => ({
      from: table => {
        const rows = rowsFor(table);
        return {
          where: condition => queryResult(rows.filter(row => matches(row, condition))),
          orderBy: async () => rows,
          limit: async count => rows.slice(0, count),
        };
      },
    }),
    insert: table => ({
      values: value => {
        const row = table === tables.adminAuditTable
          ? value
          : { ...value, id: value.id ?? `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`, updatedAt: new Date() };
        rowsFor(table).push(row);
        return {
          returning: async () => [row],
          then: (resolve, reject) => Promise.resolve([row]).then(resolve, reject),
        };
      },
    }),
    update: table => ({
      set: patch => ({
        where: condition => {
          const changed = rowsFor(table).filter(row => matches(row, condition));
          changed.forEach(row => Object.assign(row, patch, { updatedAt: new Date() }));
          return { returning: async () => changed };
        },
      }),
    }),
    delete: table => ({
      where: condition => {
        const rows = rowsFor(table);
        const removed = rows.filter(row => matches(row, condition));
        tableRows.set(table, rows.filter(row => !matches(row, condition)));
        return { returning: async () => removed };
      },
    }),
    transaction: callback => callback(db),
  };
  return db;
}

function bodySchema(validate = value => value && typeof value === 'object') {
  return {
    strict() { return this; },
    safeParse(value) { return validate(value) ? { success: true, data: value } : { success: false }; },
  };
}
const passthroughSchema = { parse: value => value };
const mediaTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm',
  'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain',
]);

function loadAdminRouter() {
  const routes = new Map();
  const mounts = [];
  const router = {
    use: (...args) => mounts.push(args),
    get: (path, ...handlers) => routes.set(`GET ${path}`, handlers.at(-1)),
    post: (path, ...handlers) => routes.set(`POST ${path}`, handlers.at(-1)),
    put: (path, ...handlers) => routes.set(`PUT ${path}`, handlers.at(-1)),
    patch: (path, ...handlers) => routes.set(`PATCH ${path}`, handlers.at(-1)),
    delete: (path, ...handlers) => routes.set(`DELETE ${path}`, handlers.at(-1)),
  };
  const requireAuth = () => {};
  const requireAdmin = () => {};
  const CreateAdminSectionBody = bodySchema(value => value?.title && value?.kind && Array.isArray(value.blocks));
  const UpdateAdminSectionBody = CreateAdminSectionBody;
  const RequestSectionMediaUploadBody = bodySchema(value =>
    typeof value?.originalName === 'string' && mediaTypes.has(value?.mime) && Number.isInteger(value?.size) && value.size > 0);
  const resultSchema = { parse: value => value };
  const apiZod = {
    CreateAdminContentBody: {}, UpdateAdminContentBody: {}, UpdateAdminUserBody: {},
    SaveAdminSettingsBody: {}, ListAdminUsersQueryParams: {}, ListAdminAuditQueryParams: {},
    UpdateAdminContentParams: {},
    CreateAdminSectionBody, UpdateAdminSectionBody,
    UpdateAdminSectionParams: bodySchema(value => Boolean(value?.id)),
    DeleteAdminSectionParams: bodySchema(value => Boolean(value?.id)),
    GetPlatformContentResponse: {
      parse: value => value,
      shape: { sections: { parse: value => value, element: { parse: value => value } } },
    },
    GetAdminOverviewDetailsQueryParams: {}, GetAdminOverviewDetailsResponse: {},
    RequestSectionMediaUploadBody,
    RequestSectionMediaUploadResponse: resultSchema,
    ConfirmSectionMediaUploadParams: bodySchema(value => Boolean(value?.id)),
    ConfirmSectionMediaUploadResponse: resultSchema,
  };
  let uploadCount = 0;
  let validationCount = 0;
  let uuid = 0;
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('../src/routes/admin.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, URL, Date, Set, Map,
    require: name => {
      const dependencies = {
        express: { Router: () => router },
        '@clerk/express': { clerkClient: { users: { getUserList: async () => ({ data: [] }) } } },
        'node:crypto': { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` },
        'drizzle-orm': {
          and: (...conditions) => ({ operator: 'and', conditions }),
          count: () => ({}), desc: column => column,
          eq: (column, value) => ({ operator: 'eq', column, value }),
          inArray: (column, values) => ({ operator: 'in', column, values }),
          sql: () => ({}),
        },
        '@workspace/db': { ...tables, db: createDatabase() },
        '@workspace/api-zod': apiZod,
        '../middlewares/requireAuth': { requireAuth },
        '../middlewares/requireAdmin': { requireAdmin },
        '../lib/platform-access': {
          ALL_MODULES: [], enabledModules: async () => [], platformAppearance: async () => ({}),
          platformModuleSettings: async () => [],
        },
        '../lib/ad-storage': {
          assetFile: () => ({ createReadStream: () => ({ on() { return this; }, pipe() {} }) }),
          createAssetUpload: async () => ({ objectPath: '/objects/section-assets/test', uploadUrl: 'https://storage.example/upload' }),
          validateUploadedAsset: async objectPath => { validationCount += 1; return objectPath; },
        },
      };
      assert(name in dependencies, `Unexpected dependency ${name}`);
      if (name === '../lib/ad-storage') {
        const original = dependencies[name].createAssetUpload;
        dependencies[name].createAssetUpload = async (...args) => { uploadCount += 1; return original(...args); };
      }
      return dependencies[name];
    },
  });
  return {
    routes, mounts, requireAuth, requireAdmin,
    get uploadCount() { return uploadCount; },
    get validationCount() { return validationCount; },
    reset() { for (const rows of tableRows.values()) rows.length = 0; },
  };
}

function response() {
  return {
    statusCode: 200, body: undefined, headers: {},
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    end() { this.ended = true; },
  };
}
const call = async (router, method, path, { body = {}, params = {}, userId = 'admin-user' } = {}) => {
  const handler = router.routes.get(`${method} ${path}`);
  assert.equal(typeof handler, 'function', `Missing route ${method} ${path}`);
  const res = response();
  res.locals = { userId, role: 'admin' };
  await handler({ body, params, headers: {}, get: () => undefined }, res);
  return res;
};

test('section and media administration is protected by auth and administrator middleware', () => {
  const router = loadAdminRouter();
  const adminMount = router.mounts.find(args => args[0] === '/admin');
  assert.ok(adminMount);
  assert.equal(adminMount[1], router.requireAuth);
  assert.equal(adminMount[2], router.requireAdmin);
});

test('admin can request and confirm a media upload, publish it in a section, edit, and delete', async () => {
  const router = loadAdminRouter();
  router.reset();
  const ticket = await call(router, 'POST', '/admin/section-media/uploads', {
    body: { originalName: 'cover.png', mime: 'image/png', size: 128 },
  });
  assert.equal(ticket.statusCode, 201);
  assert.equal(router.uploadCount, 1);

  const confirmed = await call(router, 'POST', '/admin/section-media/uploads/:id/confirm', {
    params: { id: ticket.body.id },
  });
  assert.equal(confirmed.statusCode, 200);
  assert.equal(router.validationCount, 1);
  assert.equal(confirmed.body.url, `/api/platform/section-media/${ticket.body.id}`);

  const create = await call(router, 'POST', '/admin/sections', {
    body: {
      kind: 'content_page', title: 'مساحة تجريبية', description: 'محتوى للقسم',
      blocks: [{ type: 'media', mediaType: 'image', title: 'صورة الغلاف', body: '', url: confirmed.body.url }],
      courses: [{
        id: '6f099430-30a7-4afc-9b42-10c1cba1d220',
        title: 'مدخل إلى التصميم',
        description: 'دورة قصيرة بمحتوى عملي.',
        materials: [{ type: 'media', mediaType: 'image', title: 'ملف الدرس', body: '', url: confirmed.body.url }],
      }],
      published: false, sortOrder: 20,
    },
  });
  assert.equal(create.statusCode, 201);
  assert.equal(create.body.published, false);
  assert.equal(create.body.blocks[0].mediaType, 'image');
  assert.equal(create.body.courses[0].title, 'مدخل إلى التصميم');
  assert.equal(create.body.courses[0].materials[0].url, confirmed.body.url);

  const update = await call(router, 'PUT', '/admin/sections/:id', {
    params: { id: create.body.id },
    body: {
      kind: create.body.kind, title: 'مساحة منشورة', description: create.body.description,
      blocks: create.body.blocks, courses: create.body.courses, published: true, sortOrder: 10,
    },
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.body.title, 'مساحة منشورة');
  assert.equal(update.body.published, true);

  const list = await call(router, 'GET', '/admin/sections');
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].blocks[0].url, confirmed.body.url);
  assert.equal(list.body.items[0].courses[0].id, create.body.courses[0].id);

  const courseMedia = await call(router, 'GET', '/platform/section-media/:id', {
    params: { id: ticket.body.id },
  });
  assert.equal(courseMedia.headers['Content-Type'], 'image/png');

  const deleted = await call(router, 'DELETE', '/admin/sections/:id', { params: { id: create.body.id } });
  assert.equal(deleted.statusCode, 200);
  assert.equal(deleted.body.ok, true);
  assert.equal((await call(router, 'GET', '/admin/sections')).body.items.length, 0);
});

test('oversized section video is rejected before creating a storage upload', async () => {
  const router = loadAdminRouter();
  router.reset();
  const result = await call(router, 'POST', '/admin/section-media/uploads', {
    body: { originalName: 'lesson.mp4', mime: 'video/mp4', size: 81 * 1024 * 1024 },
  });
  assert.equal(result.statusCode, 400);
  assert.equal(router.uploadCount, 0);
});
