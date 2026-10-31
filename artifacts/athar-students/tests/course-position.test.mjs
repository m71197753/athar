import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path) {
  const context = { exports: {}, Map, Promise };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const client = load("../src/lib/course-position.ts");
const server = load("../../api-server/src/lib/course-position.ts");
const queues = load("../src/lib/course-position-queue.ts");
const lesson = (id, url, title = "A") => ({ id, type: "media", mediaType: "video", url, title, body: "" });
for (const [name, resolver] of [["client", client.resolveCourseLesson], ["server", server.resolveCourseLesson]]) {
  test(`${name}: stable lesson identity survives reordering, renaming, and moving units`, () => {
    const a = lesson("a", "/one"), b = lesson("b", "/two");
    assert.equal(resolver([b, { ...a, title: "Renamed", unitId: "other" }], a), 1);
    // Replacing a file keeps the lesson, but the tracked player still keys its
    // separate playback session by the new media asset URL.
    assert.equal(resolver([{ ...a, url: "/replacement" }], a), 0);
  });
  test(`${name}: removed lessons never fall back to their old numeric index`, () => {
    assert.equal(resolver([lesson("b", "/two")], lesson("a", "/one")), -1);
    assert.equal(resolver([lesson("a", "/one"), lesson("a", "/duplicate")], lesson("a", "/one")), -1);
  });
  test(`${name}: legacy source matching is conservative and independent of array order`, () => {
    const saved = lesson(undefined, "/one");
    assert.equal(resolver([lesson(undefined, "/two"), { ...saved, title: "Renamed" }], saved), 1);
    assert.equal(resolver([lesson(undefined, "/other")], saved), -1);
    assert.equal(resolver([{ ...saved }, { ...saved }], saved), -1);
    assert.equal(resolver([{ ...saved, title: "Other" }, saved], saved), 1);
  });
  test(`${name}: edited legacy text is not mistaken for a different lesson`, () => {
    const saved = { type: "text", title: "Text", body: "Original", url: "" };
    assert.equal(resolver([{ ...saved, body: "Changed" }], saved), -1);
    assert.equal(resolver([{ ...saved, unitId: "new-unit" }], saved), 0);
  });
}

test("pending saves remain ordered across component lifetimes; restore waits for the latest", async () => {
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = queues.enqueueCoursePosition("student/course", async () => { events.push("first-start"); await gate; events.push("first-end"); });
  const last = queues.enqueueCoursePosition("student/course", async () => { events.push("last"); });
  const restored = queues.waitForCoursePosition("student/course").then(() => events.push("restore"));
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(events, ["first-start"]);
  release();
  await Promise.all([first, last, restored]);
  assert.deepEqual(events, ["first-start", "first-end", "last", "restore"]);
});

test("a failed save cannot block the next save and accounts have separate queues", async () => {
  const failed = queues.enqueueCoursePosition("student-a/course", () => Promise.reject(new Error("offline")));
  await assert.rejects(failed);
  const saved = await queues.enqueueCoursePosition("student-a/course", async () => "saved");
  assert.equal(saved, "saved");
  let release;
  const blocked = queues.enqueueCoursePosition("student-a/course", () => new Promise(resolve => { release = resolve; }));
  assert.equal(await queues.enqueueCoursePosition("student-b/course", async () => "separate"), "separate");
  release();
  await blocked;
});
