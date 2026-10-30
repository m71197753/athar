/** Direct-to-storage upload; only metadata passes through the app server. */
export function uploadFile(
  url: string,
  file: File,
  mime: string,
  onProgress: (percentage: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", mime);
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else reject(new Error(`تعذّر الرفع إلى التخزين (${request.status}).`));
    };
    request.onerror = () => reject(new Error("انقطع الاتصال أثناء الرفع. أعد المحاولة عند استقرار الشبكة."));
    request.onabort = () => reject(new Error("تم إلغاء الرفع."));
    onProgress(0);
    request.send(file);
  });
}
