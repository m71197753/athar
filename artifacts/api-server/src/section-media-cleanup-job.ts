import { pool } from "@workspace/db";
import { cleanupSectionMedia } from "./lib/section-media-cleanup";
import { recordSectionMediaCleanupAudit } from "./lib/section-media-cleanup-audit";
import { notifyAdminsOfSectionMediaCleanupIssue } from "./lib/section-media-cleanup-notifications";

const actorId = "system:scheduled-section-media-cleanup";

try {
  let result;
  try {
    result = await cleanupSectionMedia();
  } catch {
    try {
      const auditId = await recordSectionMediaCleanupAudit(actorId);
      await notifyAdminsOfSectionMediaCleanupIssue(auditId);
    } catch { /* keep the original task failure */ }
    throw new Error("Scheduled section media cleanup failed");
  }

  const auditId = await recordSectionMediaCleanupAudit(actorId, result);
  if (result.failedFiles > 0) {
    try { await notifyAdminsOfSectionMediaCleanupIssue(auditId, result); } catch {
      console.error("Could not notify administrators about partial section media cleanup");
    }
  }
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
