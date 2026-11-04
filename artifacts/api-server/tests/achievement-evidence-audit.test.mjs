import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const adminAuditTable = { name: "platform_admin_audit" };
const written = [];
const db = {
  insert(table) {
    assert.equal(table, adminAuditTable);
    return { values: async value => { written.push(value); } };
  },
};

const source = fs.readFileSync(new URL("../src/lib/achievement-evidence-audit.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = {
  exports: {},
  require: () => ({ db, adminAuditTable }),
};
vm.runInNewContext(output, context);
const { recordAchievementEvidenceAccess } = context.exports;

test("evidence review audit stores actor, action, and attachment id only", async () => {
  await recordAchievementEvidenceAccess("admin-user", "attachment-id", "achievement_evidence.view");

  const entry = written.at(-1);
  assert.equal(entry.actorId, "admin-user");
  assert.equal(entry.action, "achievement_evidence.view");
  assert.equal(entry.target, "attachment-id");
  assert.deepEqual(Object.keys(entry).sort(), ["action", "actorId", "target"]);
});

test("file preview and download are distinguishable without storing file data", async () => {
  await recordAchievementEvidenceAccess("admin-user", "image-id", "achievement_evidence.preview");
  await recordAchievementEvidenceAccess("admin-user", "document-id", "achievement_evidence.download");

  assert.equal(written.at(-2).action, "achievement_evidence.preview");
  assert.equal(written.at(-1).action, "achievement_evidence.download");
  assert.equal(written.at(-2).target, "image-id");
  assert.equal(written.at(-1).target, "document-id");
});
