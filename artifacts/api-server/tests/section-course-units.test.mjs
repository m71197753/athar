import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/section-course-units.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(output, sandbox);
const { validCourseUnits, validCourseMaterials, MAX_COURSE_UNITS, MAX_COURSE_MATERIALS } = sandbox.exports;
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

test("course unit and lesson limits match between the server and student administration UI", () => {
  assert.equal(MAX_COURSE_UNITS, 100);
  assert.equal(MAX_COURSE_MATERIALS, 100);
  const uiLimits = fs.readFileSync(new URL("../../athar-students/src/lib/course-limits.ts", import.meta.url), "utf8");
  assert.match(uiLimits, new RegExp(`MAX_COURSE_UNITS\\s*=\\s*${MAX_COURSE_UNITS}`));
  assert.match(uiLimits, new RegExp(`MAX_COURSE_MATERIALS\\s*=\\s*${MAX_COURSE_MATERIALS}`));
  const units = Array.from({ length: 101 }, (_, index) => ({
    ...unit, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  }));
  const materials = Array.from({ length: 101 }, () => ({}));
  assert.equal(validCourseUnits({ units: units.slice(0, 100), materials: [{}] }), true);
  assert.equal(validCourseUnits({ units, materials: [{}] }), false);
  assert.equal(validCourseMaterials(materials.slice(0, 100)), true);
  assert.equal(validCourseMaterials(materials), false);
  assert.equal(validCourseMaterials([]), false);
});
