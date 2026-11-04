import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/section-media-cleanup-audit.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = {
  exports: {},
  require: () => ({ db: {}, adminAuditTable: "platform_admin_audit" }),
};
vm.runInNewContext(output, sandbox);
const { sectionMediaCleanupAuditEntry } = sandbox.exports;

test("cleanup audit entry stores a count-only summary and identifies the scheduled runner", () => {
  const entry = sectionMediaCleanupAuditEntry("system:scheduled-section-media-cleanup", {
    retentionDays: 30, deletedFiles: 4, failedFiles: 1, removedAssets: 2, expiredUploads: 3, reclaimedBytes: 2048,
  });
  assert.equal(entry.action, "section-media.cleanup");
  assert.equal(entry.actorId, "system:scheduled-section-media-cleanup");
  assert.deepEqual(JSON.parse(entry.target), {
    status: "partial", retentionDays: 30, deletedFiles: 4, failedFiles: 1,
    removedAssets: 2, expiredUploads: 3, reclaimedBytes: 2048,
  });
  assert.doesNotMatch(entry.target, /filename|student|objectPath/i);
});

test("fatal cleanup failures create a generic audit event without exception details", () => {
  const entry = sectionMediaCleanupAuditEntry("system:scheduled-section-media-cleanup");
  assert.deepEqual(JSON.parse(entry.target), { status: "failed" });
});
