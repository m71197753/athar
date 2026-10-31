type CleanupStatus = "completed" | "partial" | "failed";

function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toLocaleString("ar")} بايت`;
  const units = ["كيلوبايت", "ميجابايت", "جيجابايت", "تيرابايت"];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit++;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toLocaleString("ar", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

export function formatSectionMediaCleanupAuditTarget(target: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(target);
  } catch {
    return "تعذّر قراءة ملخص العملية.";
  }
  if (!parsed || typeof parsed !== "object" || !("status" in parsed)) return "تعذّر قراءة ملخص العملية.";
  const record = parsed as Record<string, unknown>;
  const status = record.status as CleanupStatus;
  if (status === "failed") return "فشلت العملية أثناء التنفيذ.";
  if (status !== "completed" && status !== "partial") return "تعذّر قراءة ملخص العملية.";

  const deletedFiles = count(record.deletedFiles);
  const failedFiles = count(record.failedFiles);
  const removedAssets = count(record.removedAssets);
  const expiredUploads = count(record.expiredUploads);
  const reclaimedBytes = count(record.reclaimedBytes);
  const outcome = status === "partial" ? `اكتملت جزئيًا؛ تعذّر حذف ${failedFiles.toLocaleString("ar")} ملفًا` : "اكتملت";
  return `${outcome}. حُذف ${deletedFiles.toLocaleString("ar")} ملف، وأُزيل ${removedAssets.toLocaleString("ar")} مرفق و${expiredUploads.toLocaleString("ar")} سجل رفع؛ المساحة المستعادة ${formatBytes(reclaimedBytes)}.`;
}
