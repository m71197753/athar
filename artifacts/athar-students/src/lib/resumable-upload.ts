// Sessions stay in memory only: upload URLs are bearer capabilities and must
// not be persisted to localStorage or written to logs.
const CHUNK_BYTES = 8 * 1024 * 1024; // GCS chunks must be multiples of 256 KiB.

export type UploadOptions = {
  resumable?: boolean;
  signal?: AbortSignal;
  onStatus?: (status: "uploading" | "reconnecting") => void;
};

export class UploadSessionExpiredError extends Error {
  constructor() { super("انتهت جلسة الرفع. اختر الملف لبدء جلسة جديدة."); }
}

function abortError() { return new DOMException("تم إلغاء الرفع.", "AbortError"); }

function wait(delay: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const aborted = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", aborted); resolve(); }, delay);
    signal?.addEventListener("abort", aborted, { once: true });
  });
}

function request(
  url: string, range: string, body: Blob | null, mime: string,
  signal: AbortSignal | undefined, onBytes?: (bytes: number) => void,
): Promise<{ complete: boolean; offset: number }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 120_000;
    xhr.setRequestHeader("Content-Type", mime);
    xhr.setRequestHeader("Content-Range", range);
    const aborted = () => xhr.abort();
    signal?.addEventListener("abort", aborted, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", aborted);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onBytes?.(event.loaded); };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) { resolve({ complete: true, offset: 0 }); return; }
      if (xhr.status === 308) {
        const received = xhr.getResponseHeader("Range");
        const match = received ? /^bytes=0-(\d+)$/i.exec(received.trim()) : null;
        if (received && !match) { reject(new Error("تعذّر التحقق من الجزء المرفوع.")); return; }
        resolve({ complete: false, offset: match ? Number(match[1]) + 1 : 0 });
        return;
      }
      if (xhr.status === 404 || xhr.status === 410) { reject(new UploadSessionExpiredError()); return; }
      const error = new Error(`تعذّر رفع الملف (${xhr.status}).`) as Error & { permanent?: boolean };
      error.permanent = xhr.status >= 400 && xhr.status < 500 && xhr.status !== 408 && xhr.status !== 429;
      reject(error);
    };
    xhr.onerror = xhr.ontimeout = () => { cleanup(); reject(new Error("انقطع الاتصال أثناء الرفع.")); };
    xhr.onabort = () => { cleanup(); reject(abortError()); };
    xhr.send(body);
  });
}

export async function uploadResumableFile(
  url: string, file: File, mime: string, onProgress: (percentage: number) => void, options: UploadOptions,
): Promise<void> {
  let offset = 0, failures = 0, needProbe = true;
  onProgress(0);
  while (true) {
    if (options.signal?.aborted) throw abortError();
    try {
      if (needProbe) {
        const status = await request(url, `bytes */${file.size}`, null, mime, options.signal);
        if (status.complete) { onProgress(100); return; }
        if (!Number.isSafeInteger(status.offset) || status.offset > file.size) throw new Error("موضع الرفع غير صالح.");
        offset = status.offset;
        onProgress(Math.min(99, Math.floor(offset / file.size * 100)));
        if (offset === file.size) throw new Error("جارٍ انتظار تأكيد اكتمال الملف من التخزين.");
        needProbe = false;
      }
      options.onStatus?.("uploading");
      const end = Math.min(offset + CHUNK_BYTES, file.size);
      const result = await request(url, `bytes ${offset}-${end - 1}/${file.size}`, file.slice(offset, end), mime, options.signal,
        bytes => onProgress(Math.min(99, Math.floor((offset + bytes) / file.size * 100))));
      if (result.complete) { onProgress(100); return; }
      if (!Number.isSafeInteger(result.offset) || result.offset <= offset || result.offset > end) {
        throw new Error("لم يؤكد التخزين استلام الجزء. أعد محاولة الاستكمال.");
      }
      offset = result.offset;
      failures = 0;
    } catch (error) {
      if (options.signal?.aborted || error instanceof UploadSessionExpiredError ||
        (error instanceof Error && (error.name === "AbortError" || (error as Error & { permanent?: boolean }).permanent))) throw error;
      failures++;
      if (failures > 6) throw new Error("تعذّر استكمال الرفع تلقائيًا. اضغط «استكمال الرفع» للمحاولة من آخر جزء محفوظ.");
      options.onStatus?.("reconnecting");
      // Wait while offline without spending retries; retry automatically once
      // connectivity returns. A failed response is ambiguous, so always probe.
      do { await wait(Math.min(1000 * 2 ** (failures - 1), 15_000), options.signal); }
      while (navigator.onLine === false);
      needProbe = true;
    }
  }
}
