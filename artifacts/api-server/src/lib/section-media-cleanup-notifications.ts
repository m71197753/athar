import { and, eq } from "drizzle-orm";
import { adminNotificationsTable, db, membershipsTable } from "@workspace/db";
import type { SectionMediaCleanupSummary } from "./section-media-cleanup-audit";

export function sectionMediaCleanupNotification(recipientId: string, auditId: string, result?: SectionMediaCleanupSummary) {
  const partial = result !== undefined;
  return {
    recipientId,
    type: "section_media_cleanup",
    title: partial ? "تعذّر حذف بعض المرفقات" : "فشل تنظيف المرفقات القديمة",
    message: partial
      ? `حُذف ${result.deletedFiles.toLocaleString("ar")} ملف، وتعذّر حذف ${result.failedFiles.toLocaleString("ar")} ملف. راجع سجل النشاط الإداري.`
      : "تعذّر إكمال تنظيف المرفقات القديمة. راجع سجل النشاط الإداري وسجلات التشغيل.",
    targetId: auditId,
  };
}

export async function notifyAdminsOfSectionMediaCleanupIssue(auditId: string, result?: SectionMediaCleanupSummary) {
  if (result && result.failedFiles === 0) return false;
  const admins = await db.select({ recipientId: membershipsTable.userId })
    .from(membershipsTable)
    .where(and(
      eq(membershipsTable.role, "admin"),
      eq(membershipsTable.status, "active"),
    ));
  if (admins.length === 0) return false;
  await db.insert(adminNotificationsTable)
    .values(admins.map(({ recipientId }) => sectionMediaCleanupNotification(recipientId, auditId, result)))
    .onConflictDoNothing();
  return true;
}
