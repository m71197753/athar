"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../athar-students/src/lib/app-service-worker.ts
var app_service_worker_exports = {};
__export(app_service_worker_exports, {
  registerAppWorker: () => registerAppWorker
});
module.exports = __toCommonJS(app_service_worker_exports);
var base = "/".replace(/\/$/, "");
var pending;
function registerAppWorker() {
  pending ??= install().catch((error) => {
    pending = void 0;
    throw error;
  });
  return pending;
}
async function install() {
  const registration = await navigator.serviceWorker.register(`${base}/sw.js`, {
    scope: `${base}/`,
    updateViaCache: "none"
  });
  const worker = registration.installing || registration.waiting;
  if (worker && worker.state !== "activated") {
    await new Promise((resolve, reject) => {
      const finish = () => {
        if (worker.state !== "activated" && worker.state !== "redundant") return;
        clearTimeout(timeout);
        worker.removeEventListener("statechange", finish);
        if (worker.state === "activated") resolve();
        else reject(new Error("\u062A\u0639\u0630\u0651\u0631 \u062A\u0641\u0639\u064A\u0644 \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u062A\u0635\u0641\u062D. \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0635\u0641\u062D\u0629 \u0648\u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B."));
      };
      const timeout = setTimeout(() => {
        worker.removeEventListener("statechange", finish);
        reject(new Error("\u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A. \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0635\u0641\u062D\u0629 \u0648\u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B."));
      }, 2e4);
      worker.addEventListener("statechange", finish);
      finish();
    });
  }
  if (!registration.active || registration.active.state !== "activated") {
    throw new Error("\u062A\u0639\u0630\u0651\u0631 \u062A\u0641\u0639\u064A\u0644 \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u062A\u0635\u0641\u062D. \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0635\u0641\u062D\u0629 \u0648\u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B.");
  }
  return registration;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerAppWorker
});
