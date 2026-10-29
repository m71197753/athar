import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "generated-artifacts/worker-tests/app-worker.cjs");
mkdirSync(path.dirname(output), { recursive: true });
const build = spawnSync("pnpm", [
  "--filter", "@workspace/api-server", "exec", "esbuild",
  path.join(root, "artifacts/athar-students/src/lib/app-service-worker.ts"),
  "--bundle", "--platform=node", "--format=cjs",
  '--define:import.meta.env.BASE_URL="/"', `--outfile=${output}`,
], { cwd: root, encoding: "utf8" });
assert.equal(build.status, 0, build.stderr + build.stdout);
const require = createRequire(import.meta.url);

function loadRegistration(registration, calls) {
  delete require.cache[output];
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: { register: async (url, options) => {
      calls.push({ url, options });
      return registration;
    } } },
  });
  return require(output).registerAppWorker;
}

test("initial consent and reopening share sw.js with push and offline handlers", async () => {
  const listeners = {};
  const notifications = [];
  const opened = [];
  const scope = "https://athar.example/";
  const active = { state: "activated" };
  const registration = {
    scope, active,
    showNotification: async (...args) => { notifications.push(args); },
  };
  const offlineResponse = { publicOfflineNotice: true };
  vm.runInNewContext(readFileSync(path.join(root, "artifacts/athar-students/public/sw.js"), "utf8"), {
    URL, Response, Promise,
    self: {
      registration, location: { origin: "https://athar.example" },
      clients: { openWindow: async url => { opened.push(url); }, claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener: (name, handler) => { listeners[name] = handler; },
    },
    caches: { match: async () => offlineResponse },
    fetch: async () => { throw new Error("Offline"); },
  });
  const calls = [];
  const register = loadRegistration(registration, calls);
  assert.equal(await register(), registration);
  assert.equal(await register(), registration);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/sw.js");
  assert.equal(calls[0].options.scope, "/");
  assert.equal(calls[0].options.updateViaCache, "none");
  async function push() {
    let done;
    listeners.push({
      data: { json: () => ({ title: "أثر", body: "متابعة", tag: "athar-roadmap", url: "/roadmap#roadmap-task-123" }) },
      waitUntil: promise => { done = promise; },
    });
    await done;
  }
  await push();
  assert.equal(notifications.length, 1);
  // New page/module lifecycle on reopening, same browser registration.
  assert.equal(await loadRegistration(registration, calls)(), registration);
  await push();
  assert.equal(calls.length, 2);
  assert.equal(notifications.length, 2);
  assert.equal(calls[1].url, calls[0].url);
  let clicked;
  listeners.notificationclick({
    notification: { data: { url: "/roadmap#roadmap-task-123" }, close() {} },
    waitUntil: promise => { clicked = promise; },
  });
  await clicked;
  assert.equal(opened[0], "https://athar.example/roadmap#roadmap-task-123");
  listeners.notificationclick({
    notification: { data: { url: "https://other.example/roadmap" }, close() {} },
    waitUntil() { assert.fail("Cross-origin navigation must not be allowed"); },
  });
  let response;
  listeners.fetch({
    request: { url: scope + "roadmap", mode: "navigate", method: "GET" },
    respondWith: promise => { response = promise; },
  });
  assert.equal(await response, offlineResponse);
  listeners.fetch({
    request: { url: scope + "api/career-plan", mode: "navigate", method: "GET" },
    respondWith() { assert.fail("Private API responses must not be cached"); },
  });
  const main = readFileSync(path.join(root, "artifacts/athar-students/src/main.tsx"), "utf8");
  const pushHelper = readFileSync(path.join(root, "artifacts/athar-students/src/lib/roadmap-push.ts"), "utf8");
  assert.match(main, /registerAppWorker\(\)/);
  assert.match(pushHelper, /await registerAppWorker\(\)/);
  assert.doesNotMatch(main + pushHelper, /roadmap-sw\.js|serviceWorker\.register/);
});

test("subscription setup waits for the new worker, not an old ready registration", async () => {
  const listeners = new Set();
  const worker = {
    state: "installing",
    addEventListener: (_event, callback) => { listeners.add(callback); },
    removeEventListener: (_event, callback) => { listeners.delete(callback); },
  };
  const registration = { installing: worker, active: { state: "activated" } };
  const register = loadRegistration(registration, []);
  let resolved = false;
  const result = register().then(value => { resolved = true; return value; });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resolved, false);
  worker.state = "activated";
  registration.active = worker;
  for (const listener of [...listeners]) listener();
  assert.equal(await result, registration);
  assert.equal(resolved, true);
  assert.equal(listeners.size, 0);
});
