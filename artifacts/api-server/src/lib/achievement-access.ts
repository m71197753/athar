import { and, eq } from "drizzle-orm";
import { achievementsTable, db } from "@workspace/db";

/** Achievement evidence is available to its owner through student routes only. */
export async function ownsAchievement(achievementId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: achievementsTable.id })
    .from(achievementsTable)
    .where(and(
      eq(achievementsTable.id, achievementId),
      eq(achievementsTable.userId, userId),
    ))
    .limit(1);
  return Boolean(row);
}

export async function canReadAchievementEvidence(
  achievementId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  return role === "admin" || ownsAchievement(achievementId, userId);
}
