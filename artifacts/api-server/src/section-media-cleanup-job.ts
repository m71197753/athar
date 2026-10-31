import { pool } from "@workspace/db";
import { cleanupSectionMedia } from "./lib/section-media-cleanup";
import { recordSectionMediaCleanupAudit } from "./lib/section-media-cleanup-audit";

const actorId = "system:scheduled-section-media-cleanup";

try {
  let result;
  try {
    result = await cleanupSectionMedia();
  } catch {
    try { await recordSectionMediaCleanupAudit(actorId); } catch { /* keep the original task failure */ }
    throw new Error("Scheduled section media cleanup failed");
  }

  await recordSectionMediaCleanupAudit(actorId, result);
  const summary = {
    deletedFiles: result.deletedFiles,
    failedFiles: result.failedFiles,
    removedAssets: result.removedAssets,
    expiredUploads: result.expiredUploads,
    reclaimedBytes: result.reclaimedBytes,
  };
  if (result.failedFiles > 0) {
    console.error("Scheduled section media cleanup was partial", summary);
    process.exitCode = 1;
  } else {
    console.info("Scheduled section media cleanup completed", summary);
  }
} catch {
  console.error("Scheduled section media cleanup failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
