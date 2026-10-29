import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import {
  db,
  DEFAULT_LANGUAGE_GAME_RULES,
  languageGamificationProfilesTable,
  languageWeeklyLeagueMembersTable,
  type LanguageGameRules,
} from "@workspace/db";
import { getLanguageAdminSettings } from "../lib/language-admin-settings";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type LeagueTier = "bronze" | "silver" | "gold" | "diamond";
type ProfileRow = typeof languageGamificationProfilesTable.$inferSelect;
type LeagueRow = typeof languageWeeklyLeagueMembersTable.$inferSelect;
type LeagueEntry = {
  id: string;
  displayName: string;
  weeklyXp: number;
  isVirtual: boolean;
  isCurrentUser: boolean;
  sortKey: string;
};

const TIERS: LeagueTier[] = ["bronze", "silver", "gold", "diamond"];
export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 4 * 60 * 60 * 1000;
export const STREAK_FREEZE_COST = 5;
export const MAX_FREEZE_CREDITS = 3;
const LEAGUE_SIZE = 30;
const PROMOTION_COUNT = 6;
const DEMOTION_COUNT = 6;

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(day: string, offset: number) {
  const value = new Date(`${day}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return dateKey(value);
}

function weekStartAt(date: Date) {
  const start = new Date(`${dateKey(date)}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return dateKey(start);
}

export function isValidLanguageTimezone(timezone: string) {
  try {
    if (!timezone || timezone.length > 64) return false;
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function getLocalLanguageDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysBetween(laterDay: string, earlierDay: string | null) {
  if (!earlierDay) return Number.POSITIVE_INFINITY;
  const later = new Date(`${laterDay}T00:00:00.000Z`).getTime();
  const earlier = new Date(`${earlierDay}T00:00:00.000Z`).getTime();
  return Math.round((later - earlier) / 86_400_000);
}

export function refillLanguageHearts(
  profile: ProfileRow,
  now: Date,
  rules: LanguageGameRules = DEFAULT_LANGUAGE_GAME_RULES,
) {
  const regenMs = rules.heartRegenMinutes * 60_000;
  if (profile.hearts >= rules.maxHearts) {
    return { hearts: rules.maxHearts, heartsUpdatedAt: now, nextHeartAt: null as Date | null };
  }
  const elapsed = Math.max(0, now.getTime() - profile.heartsUpdatedAt.getTime());
  const regenerated = Math.floor(elapsed / regenMs);
  const hearts = Math.min(rules.maxHearts, profile.hearts + regenerated);
  const heartsUpdatedAt = new Date(
    profile.heartsUpdatedAt.getTime() + regenerated * regenMs,
  );
  return {
    hearts,
    heartsUpdatedAt,
    nextHeartAt: hearts >= rules.maxHearts
      ? null
      : new Date(heartsUpdatedAt.getTime() + regenMs),
  };
}

export async function ensureLanguageGameProfile(
  tx: DbTransaction,
  userId: string,
  languageCode: string,
  now: Date,
  timezone?: string,
  rules: LanguageGameRules = DEFAULT_LANGUAGE_GAME_RULES,
) {
  const lockKey = `language-profile:${userId}:${languageCode}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
  await tx.insert(languageGamificationProfilesTable).values({
    userId,
    languageCode,
    timezone: timezone ?? "UTC",
    hearts: rules.maxHearts,
    heartsUpdatedAt: now,
  }).onConflictDoNothing();
  const [profile] = await tx.select().from(languageGamificationProfilesTable)
    .where(and(
      eq(languageGamificationProfilesTable.userId, userId),
      eq(languageGamificationProfilesTable.languageCode, languageCode),
    )).limit(1);
  if (!profile) throw new Error("Language game profile could not be loaded.");
  if (timezone && profile.timezone !== timezone) {
    const [updated] = await tx.update(languageGamificationProfilesTable)
      .set({ timezone, updatedAt: now })
      .where(eq(languageGamificationProfilesTable.id, profile.id))
      .returning();
    return updated ?? profile;
  }
  return profile;
}

function stableScore(seed: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return 20 + ((hash >>> 0) % 181);
}

function virtualEntries(
  count: number,
  weekStart: string,
  tier: LeagueTier,
  groupNumber: number,
): LeagueEntry[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const slot = index + 1;
    return {
      id: `virtual-${slot}`,
      displayName: `منافس افتراضي ${new Intl.NumberFormat("ar", { minimumIntegerDigits: 2 }).format(slot)}`,
      weeklyXp: stableScore(`${weekStart}:${tier}:${groupNumber}:${slot}`),
      isVirtual: true,
      isCurrentUser: false,
      sortKey: `virtual:${String(slot).padStart(2, "0")}`,
    };
  });
}

function sortAndRank(entries: LeagueEntry[]) {
  return entries
    .sort((first, second) =>
      second.weeklyXp - first.weeklyXp || first.sortKey.localeCompare(second.sortKey),
    )
    .map((entry, index) => {
      const { sortKey: _sortKey, ...visible } = entry;
      return { ...visible, rank: index + 1 };
    });
}

function realEntries(rows: LeagueRow[], currentUserId: string): LeagueEntry[] {
  const ordered = [...rows].sort((first, second) =>
    first.joinedAt.getTime() - second.joinedAt.getTime() || first.userId.localeCompare(second.userId),
  );
  return ordered.map((row, index) => ({
    id: row.userId === currentUserId ? "current-user" : `participant-${index + 1}`,
    displayName: row.userId === currentUserId
      ? "أنت"
      : `متعلم أثر ${new Intl.NumberFormat("ar").format(index + 1)}`,
    weeklyXp: row.weeklyXp,
    isVirtual: false,
    isCurrentUser: row.userId === currentUserId,
    sortKey: `real:${row.joinedAt.toISOString()}:${row.userId}`,
  }));
}

async function ensureLeagueMembership(
  tx: DbTransaction,
  userId: string,
  languageCode: string,
  weekStart: string,
  tier: LeagueTier,
  now: Date,
) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`language-league:${languageCode}:${weekStart}:${tier}`}))`);
  const filter = and(
    eq(languageWeeklyLeagueMembersTable.userId, userId),
    eq(languageWeeklyLeagueMembersTable.languageCode, languageCode),
    eq(languageWeeklyLeagueMembersTable.weekStart, weekStart),
  );
  const [existing] = await tx.select().from(languageWeeklyLeagueMembersTable)
    .where(filter).limit(1);
  if (existing) return existing;

  const groups = await tx.select({
    groupNumber: languageWeeklyLeagueMembersTable.groupNumber,
    memberCount: count(),
  }).from(languageWeeklyLeagueMembersTable).where(and(
    eq(languageWeeklyLeagueMembersTable.languageCode, languageCode),
    eq(languageWeeklyLeagueMembersTable.weekStart, weekStart),
    eq(languageWeeklyLeagueMembersTable.tier, tier),
  )).groupBy(languageWeeklyLeagueMembersTable.groupNumber)
    .orderBy(asc(languageWeeklyLeagueMembersTable.groupNumber));
  const available = groups.find(group => group.memberCount < LEAGUE_SIZE);
  const groupNumber = available?.groupNumber
    ?? Math.max(0, ...groups.map(group => group.groupNumber)) + 1;
  const [inserted] = await tx.insert(languageWeeklyLeagueMembersTable).values({
    userId,
    languageCode,
    weekStart,
    tier,
    groupNumber,
    weeklyXp: 0,
    joinedAt: now,
    updatedAt: now,
  }).onConflictDoNothing().returning();
  if (inserted) return inserted;

  const [raced] = await tx.select().from(languageWeeklyLeagueMembersTable)
    .where(filter).limit(1);
  if (!raced) throw new Error("Language league membership could not be loaded.");
  return raced;
}

async function calculateTierFromPreviousWeek(
  tx: DbTransaction,
  userId: string,
  languageCode: string,
  previous: LeagueRow,
  rules: LanguageGameRules,
) {
  const rows = await tx.select().from(languageWeeklyLeagueMembersTable).where(and(
    eq(languageWeeklyLeagueMembersTable.languageCode, languageCode),
    eq(languageWeeklyLeagueMembersTable.weekStart, previous.weekStart),
    eq(languageWeeklyLeagueMembersTable.tier, previous.tier),
    eq(languageWeeklyLeagueMembersTable.groupNumber, previous.groupNumber),
  ));
  const peers = realEntries(rows, userId);
  const virtuals = virtualEntries(
    LEAGUE_SIZE - rows.length,
    previous.weekStart,
    previous.tier as LeagueTier,
    previous.groupNumber,
  );
  const ranked = sortAndRank([...peers, ...virtuals]);
  const rank = ranked.find(entry => entry.isCurrentUser)?.rank;
  if (!rank) return previous.tier as LeagueTier;

  const tierIndex = TIERS.indexOf(previous.tier as LeagueTier);
  if (rank <= rules.promotionCount && tierIndex < TIERS.length - 1) {
    return TIERS[tierIndex + 1];
  }
  if (rank > LEAGUE_SIZE - rules.demotionCount && tierIndex > 0) {
    return TIERS[tierIndex - 1];
  }
  return previous.tier as LeagueTier;
}

export async function ensureCurrentLanguageLeague(
  tx: DbTransaction,
  userId: string,
  languageCode: string,
  initialProfile: ProfileRow,
  now: Date,
  rules: LanguageGameRules = DEFAULT_LANGUAGE_GAME_RULES,
) {
  const currentWeek = weekStartAt(now);
  const [existing] = await tx.select().from(languageWeeklyLeagueMembersTable).where(and(
    eq(languageWeeklyLeagueMembersTable.userId, userId),
    eq(languageWeeklyLeagueMembersTable.languageCode, languageCode),
    eq(languageWeeklyLeagueMembersTable.weekStart, currentWeek),
  )).limit(1);
  if (existing) return { profile: initialProfile, membership: existing };

  const previousWeek = shiftDate(currentWeek, -7);
  const [previous] = await tx.select().from(languageWeeklyLeagueMembersTable).where(and(
    eq(languageWeeklyLeagueMembersTable.userId, userId),
    eq(languageWeeklyLeagueMembersTable.languageCode, languageCode),
    eq(languageWeeklyLeagueMembersTable.weekStart, previousWeek),
  )).limit(1);
  let profile = initialProfile;
  if (previous) {
    const newTier = await calculateTierFromPreviousWeek(tx, userId, languageCode, previous, rules);
    if (newTier !== profile.tier) {
      const [updated] = await tx.update(languageGamificationProfilesTable)
        .set({ tier: newTier, updatedAt: now })
        .where(eq(languageGamificationProfilesTable.id, profile.id))
        .returning();
      if (updated) profile = updated;
    }
  }

  const membership = await ensureLeagueMembership(
    tx, userId, languageCode, currentWeek, profile.tier as LeagueTier, now,
  );
  return { profile, membership };
}

function profilePayload(profile: ProfileRow, membership: LeagueRow, now: Date, rules: LanguageGameRules) {
  const heartStatus = refillLanguageHearts(profile, now, rules);
  const today = getLocalLanguageDay(now, profile.timezone);
  const todayStudied = profile.lastActiveDay === today;
  const daysSinceLastStudy = daysBetween(today, profile.lastActiveDay);
  return {
    languageCode: profile.languageCode,
    xpTotal: profile.xpTotal,
    gems: profile.gems,
    hearts: heartStatus.hearts,
    maxHearts: rules.maxHearts,
    nextHeartAt: heartStatus.nextHeartAt?.toISOString() ?? null,
    currentStreak: profile.currentStreak,
    bestStreak: profile.bestStreak,
    todayStudied,
    streakAtRisk: profile.currentStreak > 0 && !todayStudied && (
      daysSinceLastStudy === 1 ||
      (daysSinceLastStudy === 2 && profile.streakFreezeCredits > 0)
    ),
    streakFreezeCredits: profile.streakFreezeCredits,
    soundEnabled: profile.soundEnabled,
    vibrationEnabled: profile.vibrationEnabled,
    tier: profile.tier as LeagueTier,
    weeklyXp: membership.weeklyXp,
  };
}

export async function buildLanguageGamificationSummary(
  tx: DbTransaction,
  userId: string,
  languageCode: string,
  profile: ProfileRow,
  membership: LeagueRow,
  now: Date,
  rules: LanguageGameRules = DEFAULT_LANGUAGE_GAME_RULES,
) {
  const rows = await tx.select().from(languageWeeklyLeagueMembersTable).where(and(
    eq(languageWeeklyLeagueMembersTable.languageCode, languageCode),
    eq(languageWeeklyLeagueMembersTable.weekStart, membership.weekStart),
    eq(languageWeeklyLeagueMembersTable.tier, membership.tier),
    eq(languageWeeklyLeagueMembersTable.groupNumber, membership.groupNumber),
  ));
  const real = realEntries(rows, userId);
  const virtual = virtualEntries(
    LEAGUE_SIZE - rows.length,
    membership.weekStart,
    membership.tier as LeagueTier,
    membership.groupNumber,
  );
  const members = sortAndRank([...real, ...virtual]);
  const current = members.find(member => member.isCurrentUser);
  if (!current) throw new Error("Current language league member is missing.");
  const tierIndex = TIERS.indexOf(membership.tier as LeagueTier);
  return {
    profile: profilePayload(profile, membership, now, rules),
    league: {
      tier: membership.tier as LeagueTier,
      weekStart: membership.weekStart,
      weeklyXp: membership.weeklyXp,
      rank: current.rank,
      participantCount: members.length,
      realParticipantCount: rows.length,
      virtualCompetitorCount: virtual.length,
      promotionSlots: tierIndex < TIERS.length - 1 ? rules.promotionCount : 0,
      demotionSlots: tierIndex > 0 ? rules.demotionCount : 0,
      members,
    },
  };
}

export async function getLanguageGamificationSummary(
  userId: string,
  languageCode: string,
  now = new Date(),
) {
  const { game: rules } = await getLanguageAdminSettings();
  return db.transaction(async tx => {
    const profile = await ensureLanguageGameProfile(tx, userId, languageCode, now, undefined, rules);
    const { profile: currentProfile, membership } = await ensureCurrentLanguageLeague(
      tx, userId, languageCode, profile, now, rules,
    );
    return buildLanguageGamificationSummary(
      tx, userId, languageCode, currentProfile, membership, now, rules,
    );
  });
}

export function calculateLanguageStreak(
  profile: ProfileRow,
  today: string,
) {
  if (profile.lastActiveDay === today) {
    return {
      currentStreak: profile.currentStreak,
      streakFreezeCredits: profile.streakFreezeCredits,
    };
  }
  const gap = daysBetween(today, profile.lastActiveDay);
  if (gap === 1) {
    return {
      currentStreak: profile.currentStreak + 1,
      streakFreezeCredits: profile.streakFreezeCredits,
    };
  }
  if (gap === 2 && profile.streakFreezeCredits > 0) {
    return {
      currentStreak: profile.currentStreak + 2,
      streakFreezeCredits: profile.streakFreezeCredits - 1,
    };
  }
  return { currentStreak: 1, streakFreezeCredits: profile.streakFreezeCredits };
}

export async function updateLanguageGamificationSettings(
  userId: string,
  languageCode: string,
  settings: { soundEnabled?: boolean; vibrationEnabled?: boolean },
  now = new Date(),
) {
  const { game: rules } = await getLanguageAdminSettings();
  return db.transaction(async tx => {
    const profile = await ensureLanguageGameProfile(tx, userId, languageCode, now, undefined, rules);
    const heartStatus = refillLanguageHearts(profile, now, rules);
    const [updated] = await tx.update(languageGamificationProfilesTable).set({
      soundEnabled: settings.soundEnabled ?? profile.soundEnabled,
      vibrationEnabled: settings.vibrationEnabled ?? profile.vibrationEnabled,
      hearts: heartStatus.hearts,
      heartsUpdatedAt: heartStatus.heartsUpdatedAt,
      updatedAt: now,
    }).where(eq(languageGamificationProfilesTable.id, profile.id)).returning();
    return updated ?? profile;
  });
}

export async function purchaseLanguageStreakFreeze(
  userId: string,
  languageCode: string,
  now = new Date(),
) {
  const { game: rules } = await getLanguageAdminSettings();
  return db.transaction(async tx => {
    const profile = await ensureLanguageGameProfile(tx, userId, languageCode, now, undefined, rules);
    if (profile.gems < rules.freezeCost) return { error: "not-enough-gems" as const };
    if (profile.streakFreezeCredits >= rules.maxFreezeCredits) return { error: "freeze-limit" as const };
    const heartStatus = refillLanguageHearts(profile, now, rules);
    const [updated] = await tx.update(languageGamificationProfilesTable).set({
      gems: profile.gems - rules.freezeCost,
      streakFreezeCredits: profile.streakFreezeCredits + 1,
      hearts: heartStatus.hearts,
      heartsUpdatedAt: heartStatus.heartsUpdatedAt,
      updatedAt: now,
    }).where(eq(languageGamificationProfilesTable.id, profile.id)).returning();
    return updated ? { profile: updated } : { error: "profile-update-failed" as const };
  });
}

export async function addWeeklyLanguageXp(
  tx: DbTransaction,
  membership: LeagueRow,
  amount: number,
  now: Date,
) {
  const [updated] = await tx.update(languageWeeklyLeagueMembersTable).set({
    weeklyXp: sql`${languageWeeklyLeagueMembersTable.weeklyXp} + ${amount}`,
    updatedAt: now,
  }).where(eq(languageWeeklyLeagueMembersTable.id, membership.id)).returning();
  if (!updated) throw new Error("Weekly language league score could not be updated.");
  return updated;
}

export async function withLanguageGameProfile(
  tx: DbTransaction,
  profile: ProfileRow,
  values: Partial<ProfileRow>,
) {
  const [updated] = await tx.update(languageGamificationProfilesTable)
    .set(values)
    .where(eq(languageGamificationProfilesTable.id, profile.id))
    .returning();
  if (!updated) throw new Error("Language game profile could not be updated.");
  return updated;
}

export type LanguageGameProfileRow = ProfileRow;
export type LanguageGameLeagueRow = LeagueRow;
export type { DbTransaction, LeagueTier };
