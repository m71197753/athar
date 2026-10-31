import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const MB = 1024 * 1024;
function harness(responses) {
  const calls = [], progress = [], states = [];
  class XHR {
    upload = {};
    headers = {};
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { this.headers[key] = value; }
    getResponseHeader() { return this.response.range ?? null; }
    abort() { this.onabort?.(); }
    send(body) {
      calls.push({ range: this.headers["Content-Range"], size: body?.size ?? 0 });
      this.response = responses.shift();
      if (!this.response) throw new Error("Unexpected request");
      queueMicrotask(() => {
        this.upload.onprogress?.({ lengthComputable: true, loaded: body?.size ?? 0 });
        if (this.response.network) this.onerror();
        else { this.status = this.response.status; this.onload(); }
      });
    }
  }
  const context = {
    exports: {}, XMLHttpRequest: XHR, DOMException, navigator: { onLine: true },
    setTimeout: fn => { queueMicrotask(fn); return 1; }, clearTimeout: () => {},
  };
  const source = readFileSync(new URL("../src/lib/resumable-upload.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return {
    calls, progress, states,
    upload: (size, signal) => context.exports.uploadResumableFile(
      "https://storage.invalid/test-session", { size, slice: (start, end) => ({ size: end - start }) },
      "video/mp4", value => progress.push(value), { signal, onStatus: value => states.push(value) },
    ),
  };
}

test("uploads bounded chunks and only reports 100 after final confirmation", async () => {
  const h = harness([{ status: 308 }, { status: 308, range: `bytes=0-${8 * MB - 1}` }, { status: 200 }]);
  await h.upload(10 * MB);
  assert.deepEqual(h.calls.map(c => c.range), [
    `bytes */${10 * MB}`, `bytes 0-${8 * MB - 1}/${10 * MB}`, `bytes ${8 * MB}-${10 * MB - 1}/${10 * MB}`,
  ]);
  assert.equal(h.calls[1].size, 8 * MB);
  assert.equal(h.calls[2].size, 2 * MB);
  assert.equal(h.progress.at(-1), 100);
  assert.ok(h.progress.slice(0, -1).every(p => p < 100));
});

test("a retry starts at the confirmed offset instead of retransmitting the file", async () => {
  const h = harness([{ status: 308, range: `bytes=0-${8 * MB - 1}` }, { status: 200 }]);
  await h.upload(10 * MB);
  assert.equal(h.calls[1].range, `bytes ${8 * MB}-${10 * MB - 1}/${10 * MB}`);
});

test("probes server state after ambiguous network failure and skips accepted bytes", async () => {
  const h = harness([
    { status: 308 }, { network: true },
    { status: 308, range: `bytes=0-${8 * MB - 1}` }, { status: 200 },
  ]);
  await h.upload(10 * MB);
  assert.equal(h.calls[2].range, `bytes */${10 * MB}`);
  assert.equal(h.calls[3].size, 2 * MB);
  assert.ok(h.states.includes("reconnecting"));
});

test("lost final acknowledgement does not resend an already completed upload", async () => {
  const h = harness([{ status: 308 }, { network: true }, { status: 200 }]);
  await h.upload(MB);
  assert.equal(h.calls.length, 3);
  assert.equal(h.calls[2].size, 0);
  assert.equal(h.progress.at(-1), 100);
});

test("expired sessions and permission errors are explicit and never loop", async () => {
  for (const status of [404, 410, 403]) {
    const h = harness([{ status }]);
    await assert.rejects(h.upload(MB));
    assert.equal(h.calls.length, 1);
    assert.ok(!h.progress.includes(100));
  }
});

test("paused upload can be cancelled before sending data", async () => {
  const h = harness([]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(h.upload(MB, controller.signal), { name: "AbortError" });
  assert.equal(h.calls.length, 0);
});
