import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const context = { exports: {}, Date, Set, Map, Number, RegExp, Math };
vm.runInNewContext(ts.transpileModule(
  readFileSync(new URL("../src/lib/section-media-cleanup-plan.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText, context);
const { selectSectionMediaCleanupCandidates: plan, SECTION_MEDIA_RETENTION_DAYS } = context.exports;

const now = Date.UTC(2026, 9, 31);
const older = new Date(now - 45 * 24 * 60 * 60 * 1000);
const newer = new Date(now - 2 * 24 * 60 * 60 * 1000);
const staleTime = older.toISOString();
const recentTime = newer.toISOString();
const id = suffix => `11111111-1111-4111-8111-${suffix.repeat(12)}`.slice(0, 36);
const row = (assetId, objectPath, status = "uploading", createdAt = older) => ({ id: assetId, objectPath, status, createdAt });
const object = (objectPath, timeCreated = staleTime) => ({ objectPath, timeCreated, size: 1024 });

test("only old section-media paths with no database owner are treated as orphan files", () => {
  const candidatePath = `bucket/private/section-assets/${id("a")}`;
  const knownReadyPath = `bucket/private/section-assets/${id("b")}-confirmed-${id("c")}`;
  const result = plan(
    [row(id("d"), knownReadyPath, "ready")],
    new Set(),
    [object(candidatePath), object(knownReadyPath), object(`bucket/private/ad-assets/${id("e")}`), object(`bucket/private/section-assets/${id("f")}`, recentTime)],
    now,
  );
  assert.deepEqual(Array.from(result.candidates, item => item.objectPath), [candidatePath]);
});

test("expired unlinked uploads and their old objects are removable, but recent uploads stay", () => {
  const stalePath = `bucket/private/section-assets/${id("1")}`;
  const recentPath = `bucket/private/section-assets/${id("2")}`;
  const result = plan(
    [row(id("3"), stalePath), row(id("4"), recentPath, "uploading", newer)],
    new Set(),
    [object(stalePath), object(recentPath, recentTime)],
    now,
  );
  assert.equal(SECTION_MEDIA_RETENTION_DAYS, 30);
  assert.deepEqual(Array.from(result.expiredUploads, asset => asset.objectPath), [stalePath]);
  assert.deepEqual(Array.from(result.candidates, file => file.objectPath), [stalePath]);
});

test("saved lesson references protect the published copy but not its unused source upload", () => {
  const assetId = id("5");
  const uploadPath = `bucket/private/section-assets/${id("6")}`;
  const copyPath = `${uploadPath}-confirmed-${id("7")}`;
  const result = plan(
    [row(assetId, copyPath, "ready")],
    new Set([assetId]),
    [object(uploadPath), object(copyPath)],
    now,
  );
  assert.equal(result.expiredUploads.length, 0);
  assert.deepEqual(Array.from(result.candidates, item => item.objectPath), [uploadPath]);
  assert.ok(!result.candidates.some(item => item.objectPath === copyPath));
});

test("expired upload rows without an object can be removed, while unknown filenames are ignored", () => {
  const missingPath = `bucket/private/section-assets/${id("8")}`;
  const result = plan(
    [row(id("9"), missingPath)],
    new Set(),
    [object("bucket/private/section-assets/not-a-generated-upload")],
    now,
  );
  assert.deepEqual(Array.from(result.expiredUploads, asset => asset.id), [id("9")]);
  assert.equal(result.candidates.length, 0);
});
