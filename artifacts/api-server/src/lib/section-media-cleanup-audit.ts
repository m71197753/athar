import { db, adminAuditTable } from "@workspace/db";

export type SectionMediaCleanupSummary = {
  retentionDays: number;
  expiredUploads: number;
  removedAssets: number;
  deletedFiles: number;
  failedFiles: number;
  reclaimedBytes: number;
};

export function sectionMediaCleanupAuditEntry(actorId: string, result?: SectionMediaCleanupSummary) {
  return {
    actorId,
    action: "section-media.cleanup",
    target: JSON.stringify(result ? {
      status: result.failedFiles > 0 ? "partial" : "completed",
      retentionDays: result.retentionDays,
      deletedFiles: result.deletedFiles,
      failedFiles: result.failedFiles,
      removedAssets: result.removedAssets,
      expiredUploads: result.expiredUploads,
      reclaimedBytes: result.reclaimedBytes,
    } : { status: "failed" }),
  };
}

export async function recordSectionMediaCleanupAudit(actorId: string, result?: SectionMediaCleanupSummary) {
  await db.insert(adminAuditTable).values(sectionMediaCleanupAuditEntry(actorId, result));
}
