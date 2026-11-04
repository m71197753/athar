import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real component's event handlers with a deterministic media clock.
// This does not replace a browser/codec test with a published lesson.
function fixture({ mediaType = "video", deferred = false, savedProgress } = {}) {
  let now = 0;
  const requests = [], pending = [], cleanups = [];
  const listeners = new Map();
  const document = {
    visibilityState: "visible",
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    setInterval: () => 1, clearInterval: () => {},
  };
  const api = {
    getGetSectionMediaProgressQueryKey: slug => ["progress", slug],
    getListLearningItemsQueryKey: () => ["learning"],
    saveSectionMediaProgress: (slug, data) => {
      requests.push({ slug, ...data });
      if (!deferred) return Promise.resolve(data);
      return new Promise((resolve, reject) => pending.push({
        resolve: () => resolve(data), reject,
      }));
    },
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const context = {
    exports: {}, console, document, window, performance: { now: () => now },
    require: name => {
      if (name === "react") return {
        useCallback: fn => fn,
        useRef: current => ({ current }),
        useState: initial => [initial, () => {}],
        useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
      };
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@tanstack/react-query") return {
        useQueryClient: () => ({ setQueryData: () => {}, invalidateQueries: async () => {} }),
      };
      if (name === "@workspace/api-client-react") return api;
      if (name === "lucide-react" || name.endsWith(".css")) return {};
      if (name === "./media-playback") return playback;
      if (name === "../lib/section-units") return sectionUnitsContext.exports;
      throw new Error(`Unexpected import ${name}`);
    },
  };
  const compile = file => ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText;
  const sectionUnitsContext = { exports: {} };
  vm.runInNewContext(compile("../src/lib/section-units.ts"), sectionUnitsContext);
  const playbackContext = { exports: {} };
  vm.runInNewContext(compile("../src/sections/media-playback.ts"), playbackContext);
  const playback = playbackContext.exports;
  vm.runInNewContext(compile("../src/sections/TrackedSectionMedia.tsx"), context);
  const props = {
    sectionSlug: "learning", contextKey: "section", mediaAssetId: "file-one",
    mediaType, url: "/media/one", title: "Test lesson", savedProgress,
  };
  const session = context.exports.TrackedSectionMedia(props);
  const tree = session.type(session.props);
  const node = tree.props.children.find(child => child && child.type === mediaType);
  const player = {
    currentTime: 0, duration: 200, readyState: 1,
    playbackRate: 1, paused: true, seeking: false, ended: false,
  };
  node.props.ref(player);
  return {
    requests, pending, player, document, handlers: node.props,
    advance(seconds, distance = seconds * player.playbackRate) {
      now += seconds * 1000;
      player.currentTime += distance;
    },
    event(name) { listeners.get(name)?.(); },
    unmount() { node.props.ref(null); cleanups.forEach(fn => fn()); },
    keyFor(patch) { return context.exports.TrackedSectionMedia({ ...props, ...patch }).key; },
  };
}

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function ready(f) {
  f.handlers.onLoadedMetadata();
  if (f.pending.length) f.pending.shift().resolve();
  await settle();
}
function play(f) {
  f.player.paused = false;
  f.handlers.onPlay({ currentTarget: f.player });
}
function pause(f) {
  f.player.paused = true;
  f.handlers.onPause();
}
function seek(f, position) {
  f.player.seeking = true;
  f.player.currentTime = position;
  f.handlers.onSeeking({ currentTarget: f.player });
  f.player.seeking = false;
  f.handlers.onSeeked({ currentTarget: f.player });
}

test("pause credits the final fraction, but paused time and seek jumps add nothing", async () => {
  const f = fixture();
  await ready(f);
  play(f);
  f.advance(0.8); f.handlers.onTimeUpdate();
  f.advance(0.4); pause(f);
  await settle();
  assert.equal(f.requests.at(-1).watchedSeconds, 1);
  f.advance(5, 0); f.handlers.onTimeUpdate();
  seek(f, 100); await settle();
  assert.equal(f.requests.at(-1).watchedSeconds, 1);
  assert.equal(f.requests.at(-1).resumePositionSeconds, 100);
  seek(f, 20); await settle();
  assert.equal(f.requests.at(-1).resumePositionSeconds, 20);
});

test("hidden video is excluded on return while background audio is counted", async () => {
  for (const mediaType of ["video", "audio"]) {
    const f = fixture({ mediaType });
    await ready(f);
    play(f);
    f.document.visibilityState = "hidden"; f.event("visibilitychange");
    f.advance(5);
    f.document.visibilityState = "visible"; f.event("visibilitychange");
    f.advance(1); pause(f);
    await settle();
    assert.equal(f.requests.at(-1).watchedSeconds, mediaType === "audio" ? 6 : 1);
  }
});

test("rapid seeks serialize saves and keep the final backward position after unmount", async () => {
  const f = fixture({ deferred: true });
  await ready(f);
  seek(f, 80);
  seek(f, 40);
  seek(f, 12);
  assert.equal(f.requests.length, 2, "only first seek request is in flight");
  f.unmount();
  f.pending.shift().resolve();
  await settle();
  assert.equal(f.requests.length, 3);
  assert.equal(f.requests.at(-1).resumePositionSeconds, 12);
  f.pending.shift().resolve();
  await settle();
});

test("a failed save retries after reconnect, without an immediate retry loop", async () => {
  const f = fixture({ deferred: true });
  await ready(f);
  seek(f, 60);
  f.pending.shift().reject(new Error("offline"));
  await settle();
  assert.equal(f.requests.length, 2);
  f.event("online");
  assert.equal(f.requests.length, 3);
  assert.equal(f.requests.at(-1).resumePositionSeconds, 60);
  f.pending.shift().resolve();
  await settle();
});

test("changing a file, section or course creates an independent playback session", () => {
  const f = fixture();
  const original = f.keyFor({});
  assert.notEqual(f.keyFor({ mediaAssetId: "file-two" }), original);
  assert.notEqual(f.keyFor({ sectionSlug: "another-section" }), original);
  assert.notEqual(f.keyFor({ contextKey: "course:another" }), original);
  assert.notEqual(f.keyFor({ url: "/media/replacement" }), original);
});

test("loaded metadata restores position without crediting it as playback", async () => {
  const f = fixture({ savedProgress: {
    watchedSeconds: 15, durationSeconds: 200, resumePositionSeconds: 70,
  } });
  await ready(f);
  assert.equal(f.player.currentTime, 70);
  assert.equal(f.requests.length, 0, "restoring alone does not rewrite unchanged progress");
  play(f);
  f.advance(1);
  pause(f);
  await settle();
  assert.equal(f.requests.at(-1).watchedSeconds, 16);
  assert.equal(f.requests.at(-1).resumePositionSeconds, 71);
});

test("speed changes and buffering count real listening time, not media distance", async () => {
  const f = fixture();
  await ready(f);
  play(f);
  f.advance(1);
  f.player.playbackRate = 2;
  f.handlers.onRateChange();
  f.advance(2); f.handlers.onTimeUpdate();
  f.advance(3, 0); f.handlers.onTimeUpdate();
  pause(f);
  await settle();
  assert.equal(f.requests.at(-1).watchedSeconds, 3);
});
