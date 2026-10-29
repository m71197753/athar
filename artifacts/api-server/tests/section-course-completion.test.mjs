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
  platformSectionsTable: {
    slug: "sections.slug",
    published: "sections.published",
  },
};

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
    [tables.platformSectionsTable, [{
      slug: "section-abcdef123456",
      title: "المهارات المهنية",
      published: true,
      courses: [{
        id: "6f099430-30a7-4afc-9b42-10c1cba1d220",
        title: "أساسيات التواصل",
        description: "تدريب على التواصل في العمل.",
        skills: ["التواصل المهني"],
        materials: [],
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
          ListLearningItemsQueryParams: passthrough,
          ListLearningItemsResponse: passthrough,
          SaveAcademyProgressBody: passthrough,
          SaveAcademyProgressParams: passthrough,
          SaveAcademyProgressResponse: passthrough,
          UpdateLearningItemBody: passthrough,
          UpdateLearningItemParams: passthrough,
          UpdateLearningItemResponse: passthrough,
        },
        "../middlewares/requireAuth": { requireAuth() {} },
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
