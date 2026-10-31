import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../../athar-students/src/lib/section-media-cleanup-audit.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(output, sandbox);
const { formatSectionMediaCleanupAuditTarget } = sandbox.exports;

test("cleanup audit summary is readable without exposing file or student details", () => {
  const result = formatSectionMediaCleanupAuditTarget(JSON.stringify({
    status: "completed", deletedFiles: 3, failedFiles: 0, removedAssets: 2,
    expiredUploads: 1, reclaimedBytes: 1536, fileName: "private.pdf", studentId: "student-secret",
  }));
  assert.match(result, /حُذف \p{Nd}+ ملف/u);
  assert.match(result, /أُزيل \p{Nd}+ مرفق/u);
  assert.match(result, /\p{Nd}+\.5 كيلوبايت/u);
  assert.doesNotMatch(result, /private|student-secret/);
});

test("partial and failed cleanup attempts have clear summaries", () => {
  const partial = formatSectionMediaCleanupAuditTarget(JSON.stringify({ status: "partial", deletedFiles: 1, failedFiles: 2 }));
  const failed = formatSectionMediaCleanupAuditTarget(JSON.stringify({ status: "failed" }));
  assert.match(partial, /تعذّر حذف \p{Nd}+ ملف/u);
  assert.match(failed, /فشلت العملية/);
});

test("invalid audit targets never display raw storage metadata", () => {
  assert.equal(formatSectionMediaCleanupAuditTarget("private/path/file.pdf"), "تعذّر قراءة ملخص العملية.");
});
