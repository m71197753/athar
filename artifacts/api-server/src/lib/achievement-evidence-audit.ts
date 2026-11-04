import { db, adminAuditTable } from "@workspace/db";

export type AchievementEvidenceAuditAction =
  | "achievement_evidence.view"
  | "achievement_evidence.preview"
  | "achievement_evidence.download";

export function achievementEvidenceAuditEntry(
  actorId: string,
  attachmentId: string,
  action: AchievementEvidenceAuditAction,
) {
  return { actorId, action, target: attachmentId };
}

export async function recordAchievementEvidenceAccess(
  actorId: string,
  attachmentId: string,
  action: AchievementEvidenceAuditAction,
): Promise<void> {
  await db.insert(adminAuditTable).values(
    achievementEvidenceAuditEntry(actorId, attachmentId, action),
  );
}
