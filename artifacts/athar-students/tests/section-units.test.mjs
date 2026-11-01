import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/section-units.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = { exports: {}, URL };
vm.runInNewContext(output, sandbox);
const { groupCourseMaterials, adminPreviewMediaUrl, safeSectionLink } = sandbox.exports;

test("unit ordering never duplicates or drops canonical lessons, including legacy content", () => {
  const units = [{ id: "b", title: "الثانية" }, { id: "a", title: "الأولى" }];
  const materials = [{ title: "قديم" }, { unitId: "a", title: "أ" }, { unitId: "b", title: "ب" }, { unitId: "missing", title: "غير مصنف" }, { unitId: "b", title: "ب2" }];
  const result = groupCourseMaterials({ units, materials });
  assert.deepEqual(Array.from(result.groups, group => group.unit.id), ["b", "a"]);
  assert.deepEqual(Array.from(result.groups[0].lessons, lesson => lesson.index), [2, 4]);
  assert.deepEqual(Array.from(result.loose, lesson => lesson.index), [0, 3]);
  assert.equal(groupCourseMaterials({ materials }).loose.length, 5);
});

test("draft preview uses only protected canonical media and safe external links", () => {
  const id = "045be0bb-3cb8-4872-a66b-555dcaa66238";
  assert.equal(adminPreviewMediaUrl(`/api/platform/section-media/${id}`), `/api/admin/section-media/${id}/preview`);
  assert.equal(adminPreviewMediaUrl("data:text/html,unsafe"), "");
  assert.equal(safeSectionLink("javascript:alert(1)"), undefined);
  assert.equal(safeSectionLink("https://user:password@example.com"), undefined);
  assert.equal(safeSectionLink("https://example.com/lesson"), "https://example.com/lesson");
});
