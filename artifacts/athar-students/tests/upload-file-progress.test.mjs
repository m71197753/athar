import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function createUploader(status = 200) {
  const percentages = [];
  class XHR {
    upload = {};
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader() {}
    send(file) {
      queueMicrotask(() => {
        this.upload.onprogress?.({ lengthComputable: false, loaded: Math.round(file.size / 2), total: 0 });
        this.status = status;
        this.onload();
      });
    }
  }
  const source = readFileSync(new URL("../src/lib/upload-file.ts", import.meta.url), "utf8");
  const context = {
    exports: {},
    XMLHttpRequest: XHR,
    require: () => ({ uploadResumableFile: async () => undefined }),
  };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return {
    percentages,
    upload: () => context.exports.uploadFile(
      "https://storage.invalid/upload", { size: 100 }, "application/pdf",
      value => percentages.push(value),
    ),
  };
}

test("direct uploads report real byte progress when the browser omits total size", async () => {
  const uploader = createUploader();
  await uploader.upload();
  assert.deepEqual(uploader.percentages, [0, 50, 100]);
});

test("a direct upload reports 100 percent only after storage accepts it", async () => {
  const uploader = createUploader(503);
  await assert.rejects(uploader.upload(), /تعذّر الرفع إلى التخزين/);
  assert.ok(uploader.percentages.every(percent => percent < 100));
});
