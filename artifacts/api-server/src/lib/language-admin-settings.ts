import { eq } from "drizzle-orm";
import {
  db,
  DEFAULT_LANGUAGE_GAME_RULES,
  DEFAULT_LANGUAGE_PAGE_SETTINGS,
  languageAdminSettingsTable,
  languageContentItemsTable,
  type LanguageGameRules,
  type LanguagePageSettings,
} from "@workspace/db";
import { allLanguageContent } from "@workspace/language-content";

export const SUPPORTED_LANGUAGE_CODES = ["en", "fr", "es", "de", "tr"] as const;

export async function getLanguageAdminSettings() {
  let [row] = await db.select().from(languageAdminSettingsTable)
    .where(eq(languageAdminSettingsTable.key, "main")).limit(1);
  if (!row) {
    await db.insert(languageAdminSettingsTable).values({
      key: "main",
      page: DEFAULT_LANGUAGE_PAGE_SETTINGS,
      game: DEFAULT_LANGUAGE_GAME_RULES,
    }).onConflictDoNothing();
    [row] = await db.select().from(languageAdminSettingsTable)
      .where(eq(languageAdminSettingsTable.key, "main")).limit(1);
  }
  if (!row) throw new Error("Language administration settings could not be loaded.");
  return { page: row.page, game: row.game };
}

export async function saveLanguageAdminSettings(
  page: LanguagePageSettings,
  game: LanguageGameRules,
  adminId: string,
) {
  const [row] = await db.insert(languageAdminSettingsTable).values({
    key: "main",
    page,
    game,
    updatedBy: adminId,
  }).onConflictDoUpdate({
    target: languageAdminSettingsTable.key,
    set: { page, game, updatedBy: adminId, updatedAt: new Date() },
  }).returning();
  if (!row) throw new Error("Language administration settings could not be saved.");
  return { page: row.page, game: row.game };
}

let seedContentPromise: Promise<void> | null = null;

export function ensureBuiltinLanguageContent() {
  if (!seedContentPromise) {
    seedContentPromise = db.insert(languageContentItemsTable).values(
      allLanguageContent.map(item => ({
        ...item,
        partOfSpeech: item.partOfSpeech ?? null,
        pronunciationArabic: item.pronunciationArabic ?? null,
        exampleEnglish: item.exampleEnglish ?? null,
        exampleArabic: item.exampleArabic ?? null,
        grammarNote: item.grammarNote ?? null,
        relatedWordIds: item.relatedWordIds ?? [],
        active: true,
      })),
    ).onConflictDoNothing({ target: languageContentItemsTable.id })
      .then(() => undefined)
      .catch(error => {
        seedContentPromise = null;
        throw error;
      });
  }
  return seedContentPromise;
}
