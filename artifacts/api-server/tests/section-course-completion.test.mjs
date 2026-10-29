import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const tables = {
  academyProgressTable: {},
  learningItemsTable: {
    userId: "learning.userId",
    sectionCourseId: "learning.sectionCourseId",
  },
  sectionMediaProgressTable: {
    userId: "mediaProgress.userId",
    sectionSlug: "mediaProgress.sectionSlug",
    contextKey: "mediaProgress.contextKey",
    mediaAssetId: "mediaProgress.mediaAssetId",
    watchedSeconds: "mediaProgress.watchedSeconds",
    durationSeconds: "mediaProgress.durationSeconds",
  },
  platformMediaAssetsTable: { id: "media.id", status: "media.status", mime: "media.mime" },
  platformSettingsTable: { key: "settings.key", moduleSettings: "settings.moduleSettings" },
  platformSectionsTable: {
    slug: "sections.slug",
    published: "sections.published",
  },
};
const mediaId = "26e2f993-7247-4b73-a8fb-26cb7e56fa03";

function conditionMatches(row, condition) {
  if (!condition) return true;
  if (condition.operator === "and") return condition.conditions.every(item => conditionMatches(row, item));
  const key = condition.column.split(".").at(-1);
  if (condition.operator === "eq") return row[key] === condition.value;
  return true;
}

function createHarness() {
  const rows = new Map([
    [tables.learningItemsTable, []],
    [tables.sectionMediaProgressTable, []],
    [tables.platformMediaAssetsTable, [{ id: mediaId, status: "ready", mime: "video/mp4" }]],
    [tables.platformSettingsTable, []],
    [tables.platformSectionsTable, [{
      slug: "section-abcdef123456",
      title: "المهارات المهنية",
      published: true,
      blocks: [{ type: "media", mediaType: "video", title: "محاضرة", body: "", url: `/api/platform/section-media/${mediaId}` }],
      courses: [{
        id: "6f099430-30a7-4afc-9b42-10c1cba1d220",
        title: "أساسيات التواصل",
        description: "تدريب على التواصل في العمل.",
        skills: ["التواصل المهني"],
        materials: [{ type: "media", mediaType: "video", title: "محاضرة", body: "", url: `/api/platform/section-media/${mediaId}` }],
      }],
    }, {
      slug: "section-123456abcdef",
      title: "مسودة",
      published: false,
      courses: [{
        id: "fa7a4ae4-b423-40db-93fa-f465679b9344",
        title: "مسودة دورة",
        description: "",
        materials: [],
      }],
    }]],
  ]);
  const router = {
    routes: new Map(),
    use() {},
    get(path, ...handlers) { this.routes.set(`GET ${path}`, handlers.at(-1)); },
    post(path, ...handlers) { this.routes.set(`POST ${path}`, handlers.at(-1)); },
    put(path, ...handlers) { this.routes.set(`PUT ${path}`, handlers.at(-1)); },
    patch(path, ...handlers) { this.routes.set(`PATCH ${path}`, handlers.at(-1)); },
    delete(path, ...handlers) { this.routes.set(`DELETE ${path}`, handlers.at(-1)); },
  };
  let nextId = 0;
  const query = selectedRows => ({
    where(condition) { return query(selectedRows.filter(row => conditionMatches(row, condition))); },
    limit: async count => selectedRows.slice(0, count),
    orderBy: async () => selectedRows,
    then: (resolve, reject) => Promise.resolve(selectedRows).then(resolve, reject),
  });
  const db = {
    select: () => ({ from: table => query(rows.get(table) ?? []) }),
    insert: table => ({
      values: value => {
        let inserted = { ...value, id: `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`, createdAt: new Date(), updatedAt: new Date() };
        return {
          onConflictDoNothing: ({ target }) => {
            const conflict = (rows.get(table) ?? []).some(row =>
              target.every(column => row[column.split(".").at(-1)] === inserted[column.split(".").at(-1)]),
            );
            if (conflict) inserted = undefined;
            else rows.get(table).push(inserted);
            return { returning: async () => inserted ? [inserted] : [] };
          },
          onConflictDoUpdate: ({ target }) => {
            const existing = (rows.get(table) ?? []).find(row =>
              target.every(column => row[column.split(".").at(-1)] === inserted[column.split(".").at(-1)]),
            );
            if (existing) Object.assign(existing, {
              watchedSeconds: inserted.watchedSeconds,
              durationSeconds: inserted.durationSeconds,
              updatedAt: new Date(),
            });
            else rows.get(table).push(inserted);
            inserted = existing ?? inserted;
            return { returning: async () => [inserted] };
          },
        };
      },
    }),
    update: table => ({
      set: value => ({
        where: condition => ({
          returning: async () => {
            const matching = (rows.get(table) ?? []).filter(row => conditionMatches(row, condition));
            for (const row of matching) Object.assign(row, value);
            return matching;
          },
        }),
      }),
    }),
    transaction: callback => callback(db),
  };
  const passthrough = { safeParse: value => ({ success: true, data: value }), parse: value => value };
  const paramSchema = {
    safeParse(value) {
      const valid = /^section-[a-f0-9]{12}$/.test(value?.slug ?? "") &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value?.courseId ?? "");
      return valid ? { success: true, data: value } : { success: false };
    },
  };
  const exported = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL("../src/routes/learning.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module: exported,
    exports: exported.exports,
    Date,
    Set,
    Map,
    require(name) {
      const dependencies = {
        express: { Router: () => router },
        "drizzle-orm": {
          and: (...conditions) => ({ operator: "and", conditions }),
          asc: column => column,
          eq: (column, value) => ({ operator: "eq", column, value }),
          sql: () => ({}),
        },
        "@workspace/db": { ...tables, db },
        "@workspace/api-zod": {
          CompletePlatformSectionCourseParams: paramSchema,
          CompletePlatformSectionCourseResponse: passthrough,
          CreateLearningItemBody: passthrough,
          CreateLearningItemResponse: passthrough,
          DeleteLearningItemParams: passthrough,
          GetAcademyProgressResponse: passthrough,
          GetSectionMediaProgressParams: passthrough,
          GetSectionMediaProgressResponse: passthrough,
          ListLearningItemsQueryParams: passthrough,
          ListLearningItemsResponse: passthrough,
          SaveAcademyProgressBody: passthrough,
          SaveAcademyProgressParams: passthrough,
          SaveAcademyProgressResponse: passthrough,
          SaveSectionMediaProgressBody: passthrough,
          SaveSectionMediaProgressParams: passthrough,
          SaveSectionMediaProgressResponse: passthrough,
          UpdateLearningItemBody: passthrough,
          UpdateLearningItemParams: passthrough,
          UpdateLearningItemResponse: passthrough,
        },
        "../middlewares/requireAuth": { requireAuth() {} },
        "../lib/platform-access": { enabledModules: async () => [] },
      };
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return { router, rows };
}

async function complete(harness, userId, slug = "section-abcdef123456", courseId = "6f099430-30a7-4afc-9b42-10c1cba1d220") {
  const handler = harness.router.routes.get("POST /sections/:slug/courses/:courseId/complete");
  assert.equal(typeof handler, "function");
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  const res = { ...response, locals: { userId } };
  await handler({ params: { slug, courseId } }, res);
  Object.assign(response, res);
  return response;
}

test("course completion is idempotent, user-scoped, and only accepts published section courses", async () => {
  const harness = createHarness();
  const first = await complete(harness, "student-one");
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.title, "أساسيات التواصل");
  assert.equal(first.body.status, "completed");
  assert.deepEqual(Array.from(first.body.skills), ["التواصل المهني"]);

  const repeated = await complete(harness, "student-one");
  assert.equal(repeated.body.id, first.body.id);
  assert.deepEqual(Array.from(repeated.body.skills), ["التواصل المهني"]);
  assert.equal(harness.rows.get(tables.learningItemsTable).length, 1);

  const otherStudent = await complete(harness, "student-two");
  assert.equal(otherStudent.statusCode, 200);
  assert.equal(harness.rows.get(tables.learningItemsTable).length, 2);

  const draftCourse = await complete(harness, "student-one", "section-123456abcdef", "fa7a4ae4-b423-40db-93fa-f465679b9344");
  assert.equal(draftCourse.statusCode, 404);
  const unknownCourse = await complete(harness, "student-one", "section-abcdef123456", "fa7a4ae4-b423-40db-93fa-f465679b9344");
  assert.equal(unknownCourse.statusCode, 404);
});

test("section playback progress only accepts published media and remains private per student", async () => {
  const harness = createHarness();
  const save = harness.router.routes.get("PUT /sections/:slug/media-progress");
  const payload = {
    contextKey: "course:6f099430-30a7-4afc-9b42-10c1cba1d220",
    mediaAssetId: mediaId,
    watchedSeconds: 145,
    durationSeconds: 360,
  };
  const saveResponse = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, setHeader() {} };
  saveResponse.locals = { userId: "student-one" };
  await save({ params: { slug: "section-abcdef123456" }, body: payload }, saveResponse);
  assert.equal(saveResponse.statusCode, 200);
  assert.equal(saveResponse.body.watchedSeconds, 145);

  const rejected = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, setHeader() {} };
  rejected.locals = { userId: "student-one" };
  await save({ params: { slug: "section-abcdef123456" }, body: { ...payload, mediaAssetId: "5fa383b7-8cb6-4bc7-858a-85d13022e3e4" } }, rejected);
  assert.equal(rejected.statusCode, 404);

  const list = harness.router.routes.get("GET /sections/:slug/media-progress");
  const privateResponse = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, setHeader() {} };
  privateResponse.locals = { userId: "student-two" };
  await list({ params: { slug: "section-abcdef123456" } }, privateResponse);
  assert.deepEqual(Array.from(privateResponse.body), []);
  assert.equal(harness.rows.get(tables.sectionMediaProgressTable).length, 1);
});
