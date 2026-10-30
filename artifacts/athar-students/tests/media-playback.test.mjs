import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/sections/media-playback.ts", import.meta.url), "utf8");
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { playbackSeconds, resumePosition } = context.exports;

test("only actual playback contributes elapsed study time at any playback speed", () => {
  assert.equal(playbackSeconds(1, 1, 1), 1);
  assert.equal(playbackSeconds(1, 2, 2), 1);
  assert.equal(playbackSeconds(1, 0.5, 0.5), 1);
  assert.equal(playbackSeconds(1, 0, 1), 0);
  assert.equal(playbackSeconds(1, -1, 1), 0);
  assert.equal(playbackSeconds(1, 10, 1), 0);
  assert.equal(playbackSeconds(25, 25, 1), 0);
});

test("resume positions can move backwards and are bounded independently of study time", () => {
  assert.equal(resumePosition(120.9, 300), 120);
  assert.equal(resumePosition(30, 300), 30);
  assert.equal(resumePosition(18, 20), 18);
  assert.equal(resumePosition(400, 300), 300);
  assert.equal(resumePosition(-1, 300), 0);
  assert.equal(resumePosition(Number.NaN, 300), 0);
});
