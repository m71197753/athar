import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/section-media-cleanup-notifications.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const membershipAdmins = [{ recipientId: "admin-1" }, { recipientId: "admin-2" }];
let insertedNotifications = [];
const membershipsTable = { userId: "userId", role: "role", status: "status" };
const adminNotificationsTable = {};
const query = {
  from(table) { assert.equal(table, membershipsTable); return this; },
  where(filter) { assert.equal(filter.length, 2); return Promise.resolve(membershipAdmins); },
};
const db = {
  select() { return query; },
  insert(table) {
    assert.equal(table, adminNotificationsTable);
    return {
      values(rows) {
        insertedNotifications = rows;
        return { onConflictDoNothing: async () => undefined };
      },
    };
  },
};
const sandbox = {
  exports: {},
  require: (name) => name === "drizzle-orm"
    ? { and: (...filters) => filters, eq: (field, value) => ({ field, value }) }
    : { adminNotificationsTable, db, membershipsTable },
};
vm.runInNewContext(output, sandbox);
const { notifyAdminsOfSectionMediaCleanupIssue, sectionMediaCleanupNotification } = sandbox.exports;
const auditId = "13df8ff1-cc25-4d9c-8edb-92b170ad7494";

test("partial cleanup sends a count-only alert to active administrators", async () => {
  insertedNotifications = [];
  const notified = await notifyAdminsOfSectionMediaCleanupIssue(auditId, {
    retentionDays: 30, deletedFiles: 2, failedFiles: 1, removedAssets: 0, expiredUploads: 0, reclaimedBytes: 2048,
  });
  assert.equal(notified, true);
  assert.deepEqual(insertedNotifications.map(row => row.recipientId), ["admin-1", "admin-2"]);
  assert.equal(insertedNotifications[0].type, "section_media_cleanup");
  assert.equal(insertedNotifications[0].targetId, auditId);
  assert.match(insertedNotifications[0].message, /حُذف 2 ملف/);
  assert.match(insertedNotifications[0].message, /تعذّر حذف 1 ملف/);
  assert.doesNotMatch(insertedNotifications[0].message, /student|path|filename/i);
});

test("successful cleanup does not send an alert", async () => {
  insertedNotifications = [];
  const notified = await notifyAdminsOfSectionMediaCleanupIssue(auditId, {
    retentionDays: 30, deletedFiles: 2, failedFiles: 0, removedAssets: 1, expiredUploads: 0, reclaimedBytes: 2048,
  });
  assert.equal(notified, false);
  assert.equal(insertedNotifications.length, 0);
});

test("fatal cleanup notification uses a generic error message", () => {
  const notification = sectionMediaCleanupNotification("admin-1", auditId);
  assert.equal(notification.title, "فشل تنظيف المرفقات القديمة");
  assert.match(notification.message, /تعذّر إكمال تنظيف المرفقات/);
  assert.equal(notification.targetId, auditId);
  assert.doesNotMatch(notification.message, /student|path|filename/i);
});
