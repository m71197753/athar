import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const achievementId = "0d6fa65c-e2ca-48d9-bc3d-2a3bf2454bbd";
const ownerId = "student-owner";
const otherStudentId = "student-other";
const achievementsTable = { id: "achievements.id", userId: "achievements.userId" };
let ownedAchievement = { id: achievementId, userId: ownerId };
let queryResult = [];

const query = {
  from(table) { assert.equal(table, achievementsTable); return this; },
  where(filter) {
    assert.equal(filter.operator, "and");
    const idFilter = filter.conditions.find(condition => condition.column === achievementsTable.id);
    const ownerFilter = filter.conditions.find(condition => condition.column === achievementsTable.userId);
    queryResult = idFilter?.value === ownedAchievement.id && ownerFilter?.value === ownedAchievement.userId
      ? [{ id: ownedAchievement.id }]
      : [];
    return this;
  },
  limit(count) { assert.equal(count, 1); return Promise.resolve(queryResult); },
};

const source = fs.readFileSync(new URL("../src/lib/achievement-access.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = {
  exports: {},
  require: name => name === "drizzle-orm"
    ? {
        eq: (column, value) => ({ column, value }),
        and: (...conditions) => ({ operator: "and", conditions }),
      }
    : {
        achievementsTable,
        db: { select: fields => {
          assert.equal(fields.id, achievementsTable.id);
          return query;
        } },
      },
};
vm.runInNewContext(output, context);
const { ownsAchievement, canReadAchievementEvidence } = context.exports;

test("an achievement owner can access their evidence", async () => {
  assert.equal(await ownsAchievement(achievementId, ownerId), true);
});

test("a different student cannot access the achievement evidence", async () => {
  assert.equal(await ownsAchievement(achievementId, otherStudentId), false);
});

test("an unrelated achievement id is not treated as owned", async () => {
  assert.equal(await ownsAchievement("10be5107-99aa-483d-8a2e-e3483459e2e0", ownerId), false);
});

test("an active administrator can review evidence through the admin-only surface", async () => {
  assert.equal(await canReadAchievementEvidence(achievementId, "admin-user", "admin"), true);
});

test("a different student still cannot review another student's evidence", async () => {
  assert.equal(await canReadAchievementEvidence(achievementId, otherStudentId, "student"), false);
});
