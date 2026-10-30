import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/section-course-units.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(output, sandbox);
const { validCourseUnits } = sandbox.exports;
const id = "045be0bb-3cb8-4872-a66b-555dcaa66238";
const unit = { id, title: "الوحدة الأولى", description: "تمهيد" };

test("legacy lessons need no unit and grouped lessons retain a single content list", () => {
  assert.equal(validCourseUnits({ materials: [{}] }), true);
  assert.equal(validCourseUnits({ units: [unit], materials: [{}, { unitId: id }] }), true);
  assert.equal(validCourseUnits({ units: [unit], materials: [] }), true);
});

test("unit membership rejects dangling IDs, duplicates and invalid metadata", () => {
  assert.equal(validCourseUnits({ materials: [{ unitId: id }] }), false);
  assert.equal(validCourseUnits({ units: [unit, unit], materials: [] }), false);
  assert.equal(validCourseUnits({ units: [{ ...unit, title: " " }], materials: [] }), false);
  assert.equal(validCourseUnits({ units: [{ ...unit, id: "not-a-uuid" }], materials: [] }), false);
  assert.equal(validCourseUnits({ units: [{ ...unit, description: "x".repeat(601) }], materials: [] }), false);
});

test("removing a unit can preserve every lesson by unassigning, without deleting media", () => {
  const course = { units: [unit], materials: [{ title: "قديم", url: "" }, { title: "فيديو", unitId: id, url: "/api/platform/section-media/example" }] };
  const materials = course.materials.map(({ unitId, ...material }) => material);
  assert.equal(validCourseUnits({ units: [], materials }), true);
  assert.equal(materials.length, 2);
  assert.equal(materials[1].url, course.materials[1].url);
});
