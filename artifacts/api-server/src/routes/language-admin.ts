import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateAdminLanguageContentBody,
  CreateAdminLanguageContentResponse,
  GetAdminLanguageSettingsResponse,
  GetLanguagePlatformSettingsResponse,
  ListAdminLanguageContentQueryParams,
  ListAdminLanguageContentResponse,
  ListLanguageLearningContentQueryParams,
  ListLanguageLearningContentResponse,
  ImportAdminLanguageContentBody,
  ImportAdminLanguageContentResponse,
  UpdateAdminLanguageContentBody,
  UpdateAdminLanguageContentParams,
  UpdateAdminLanguageContentResponse,
  UpdateAdminLanguageSettingsBody,
  UpdateAdminLanguageSettingsResponse,
} from "@workspace/api-zod";
import {
  validateLanguageContentImportItems,
  type ParsedLanguageImportItem,
} from "@workspace/language-content";
import {
  adminAuditTable,
  db,
  languageContentItemsTable,
  languageReviewStatesTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import { requireAuth } from "../middlewares/requireAuth";
import {
  ensureBuiltinLanguageContent,
  getLanguageAdminSettings,
  saveLanguageAdminSettings,
  SUPPORTED_LANGUAGE_CODES,
} from "../lib/language-admin-settings";
import {
  canChangeLanguageContentLocation,
  changesLanguageContentLocation,
} from "../lib/language-content-safety";

const router: IRouter = Router();
const serializeItem = (item: typeof languageContentItemsTable.$inferSelect) => ({
  ...item,
  updatedAt: item.updatedAt.toISOString(),
});

router.get("/languages/settings", requireAuth, async (_req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const settings = await getLanguageAdminSettings();
  res.json(GetLanguagePlatformSettingsResponse.parse(settings));
});

router.get("/languages/content", requireAuth, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const parsed = ListLanguageLearningContentQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const settings = await getLanguageAdminSettings();
  if (!settings.page.enabledLanguages.includes(parsed.data.languageCode)) {
    res.status(403).json({ error: "هذه اللغة غير متاحة حاليًا." });
    return;
  }
  await ensureBuiltinLanguageContent();
  const userId = res.locals.userId as string;
  const savedItems = await db.select({ contentId: languageReviewStatesTable.contentId })
    .from(languageReviewStatesTable)
    .where(and(
      eq(languageReviewStatesTable.userId, userId),
      eq(languageReviewStatesTable.languageCode, parsed.data.languageCode),
      eq(languageReviewStatesTable.level, parsed.data.level),
    ));
  const savedIds = [...new Set(savedItems.map(item => item.contentId))];
  const activeFilter = eq(languageContentItemsTable.active, true);
  const itemFilter = savedIds.length
    ? or(activeFilter, inArray(languageContentItemsTable.id, savedIds))
    : activeFilter;
  const items = await db.select().from(languageContentItemsTable)
    .where(and(
      eq(languageContentItemsTable.languageCode, parsed.data.languageCode),
      eq(languageContentItemsTable.level, parsed.data.level),
      itemFilter,
    ))
    .orderBy(desc(languageContentItemsTable.active), languageContentItemsTable.difficulty, languageContentItemsTable.id);
  res.json(ListLanguageLearningContentResponse.parse(items.map(serializeItem)));
});

router.get("/admin/language/settings", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  res.json(GetAdminLanguageSettingsResponse.parse(await getLanguageAdminSettings()));
});

router.put("/admin/language/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateAdminLanguageSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const settings = await saveLanguageAdminSettings(
    parsed.data.page,
    parsed.data.game,
    res.locals.userId as string,
  );
  await db.insert(adminAuditTable).values({
    actorId: res.locals.userId as string,
    action: "language_settings_updated",
    target: "language-platform",
  });
  res.json(UpdateAdminLanguageSettingsResponse.parse(settings));
});

router.get("/admin/language/content", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const parsed = ListAdminLanguageContentQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureBuiltinLanguageContent();
  const { languageCode, level, page, pageSize, search, includeArchived } = parsed.data;
  const clauses = [
    eq(languageContentItemsTable.languageCode, languageCode),
    eq(languageContentItemsTable.level, level),
  ];
  if (!includeArchived) clauses.push(eq(languageContentItemsTable.active, true));
  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    clauses.push(or(
      ilike(languageContentItemsTable.english, term),
      ilike(languageContentItemsTable.arabic, term),
      ilike(languageContentItemsTable.category, term),
    )!);
  }
  const where = and(...clauses);
  const [totalRow] = await db.select({ total: count() }).from(languageContentItemsTable).where(where);
  const items = await db.select().from(languageContentItemsTable).where(where)
    .orderBy(desc(languageContentItemsTable.active), languageContentItemsTable.updatedAt, languageContentItemsTable.id)
    .limit(pageSize).offset((page - 1) * pageSize);
  res.json(ListAdminLanguageContentResponse.parse({
    items: items.map(serializeItem),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  }));
});

router.post("/admin/language/content", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAdminLanguageContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureBuiltinLanguageContent();
  const item = parsed.data;
  const id = `admin-${randomUUID()}`;
  const [created] = await db.insert(languageContentItemsTable).values({
    id,
    ...item,
    partOfSpeech: item.partOfSpeech ?? null,
    pronunciationArabic: item.pronunciationArabic ?? null,
    exampleEnglish: item.exampleEnglish ?? null,
    exampleArabic: item.exampleArabic ?? null,
    grammarNote: item.grammarNote ?? null,
    relatedWordIds: item.relatedWordIds ?? [],
    active: true,
  }).returning();
  await db.insert(adminAuditTable).values({
    actorId: res.locals.userId as string,
    action: "language_content_created",
    target: id,
  });
  res.status(201).json(CreateAdminLanguageContentResponse.parse(serializeItem(created)));
});

router.post("/admin/language/content/import", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = ImportAdminLanguageContentBody.safeParse(req.body);
  if (!parsed.success) {
    const rowErrors = parsed.error.issues.slice(0, 250).map(issue => ({
      row: typeof issue.path[1] === "number" ? issue.path[1] + 1 : 1,
      message: issue.message.slice(0, 300),
    }));
    res.status(400).json({ error: "بيانات الاستيراد غير صالحة.", rowErrors });
    return;
  }

  await ensureBuiltinLanguageContent();
  const items: ParsedLanguageImportItem[] = parsed.data.items.map(item => ({
    ...item,
    partOfSpeech: item.partOfSpeech ?? undefined,
    pronunciationArabic: item.pronunciationArabic ?? undefined,
    exampleEnglish: item.exampleEnglish ?? undefined,
    exampleArabic: item.exampleArabic ?? undefined,
    grammarNote: item.grammarNote ?? undefined,
    relatedWordIds: item.relatedWordIds ?? [],
  }));
  const result = await db.transaction(async tx => {
    const groups = new Map<string, {
      languageCode: string;
      level: ParsedLanguageImportItem["level"];
      kind: string;
    }>();
    for (const item of items) {
      const key = `${item.languageCode}\u0000${item.level}\u0000${item.kind}`;
      groups.set(key, { languageCode: item.languageCode, level: item.level, kind: item.kind });
    }
    const groupConditions = [...groups.values()].map(group => and(
      eq(languageContentItemsTable.languageCode, group.languageCode),
      eq(languageContentItemsTable.level, group.level),
      eq(languageContentItemsTable.kind, group.kind),
    )!);
    const matchingItems = await tx.select({
      id: languageContentItemsTable.id,
      languageCode: languageContentItemsTable.languageCode,
      level: languageContentItemsTable.level,
      kind: languageContentItemsTable.kind,
      english: languageContentItemsTable.english,
    }).from(languageContentItemsTable).where(or(...groupConditions)!);

    const sourceIds = new Set(items.flatMap(item => item.sourceId ? [item.sourceId] : []));
    const idsToLookup = new Set<string>(sourceIds);
    for (const item of items) {
      for (const reference of item.relatedWordIds) {
        if (!sourceIds.has(reference)) idsToLookup.add(reference);
      }
    }
    const lookedUpItems = idsToLookup.size
      ? await tx.select({
          id: languageContentItemsTable.id,
          languageCode: languageContentItemsTable.languageCode,
          level: languageContentItemsTable.level,
          kind: languageContentItemsTable.kind,
          english: languageContentItemsTable.english,
        }).from(languageContentItemsTable).where(inArray(languageContentItemsTable.id, [...idsToLookup]))
      : [];
    const existingById = new Map([...matchingItems, ...lookedUpItems].map(item => [item.id, item]));
    const issues = validateLanguageContentImportItems(items, [...existingById.values()]);
    if (issues.length) return { issues };

    const ids = items.map(() => `admin-${randomUUID()}`);
    const idBySourceId = new Map<string, string>();
    items.forEach((item, index) => {
      if (item.sourceId) idBySourceId.set(item.sourceId, ids[index]);
    });
    const active = parsed.data.activateAfterImport;
    await tx.insert(languageContentItemsTable).values(items.map((item, index) => ({
      id: ids[index],
      languageCode: item.languageCode,
      level: item.level,
      kind: item.kind,
      category: item.category,
      partOfSpeech: item.partOfSpeech ?? null,
      english: item.english,
      arabic: item.arabic,
      pronunciationArabic: item.pronunciationArabic ?? null,
      exampleEnglish: item.exampleEnglish ?? null,
      exampleArabic: item.exampleArabic ?? null,
      grammarNote: item.grammarNote ?? null,
      difficulty: item.difficulty,
      relatedWordIds: item.relatedWordIds.map(reference => idBySourceId.get(reference) ?? reference),
      active,
    })));
    await tx.insert(adminAuditTable).values(ids.map(id => ({
      actorId: res.locals.userId as string,
      action: "language_content_imported",
      target: id,
    })));

    return { imported: items.length, activated: active ? items.length : 0, inactive: active ? 0 : items.length };
  });

  if ("issues" in result && result.issues) {
    const conflict = result.issues.some(issue => issue.message.includes("موجود بالفعل"));
    res.status(conflict ? 409 : 400).json({
      error: conflict ? "لم يتم الاستيراد لأن بعض العناصر موجودة بالفعل." : "راجع أخطاء الصفوف قبل الاستيراد.",
      rowErrors: result.issues.slice(0, 250),
    });
    return;
  }
  res.status(201).json(ImportAdminLanguageContentResponse.parse(result));
});

router.patch("/admin/language/content/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateAdminLanguageContentParams.safeParse(req.params);
  const parsed = UpdateAdminLanguageContentBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "راجع بيانات العنصر وحاول مرة أخرى." });
    return;
  }
  const [existing] = await db.select().from(languageContentItemsTable)
    .where(eq(languageContentItemsTable.id, params.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "عنصر اللغة غير موجود." });
    return;
  }
  const nextLanguage = parsed.data.languageCode ?? existing.languageCode;
  const nextLevel = parsed.data.level ?? existing.level;
  if (changesLanguageContentLocation(existing, {
    languageCode: nextLanguage,
    level: nextLevel,
  })) {
    const [used] = await db.select({ total: count() }).from(languageReviewStatesTable)
      .where(eq(languageReviewStatesTable.contentId, existing.id));
    if (!canChangeLanguageContentLocation(
      existing,
      { languageCode: nextLanguage, level: nextLevel },
      (used?.total ?? 0) > 0,
    )) {
      res.status(409).json({ error: "لا يمكن نقل عنصر له سجل مراجعة؛ أنشئ عنصرًا جديدًا بدلًا منه." });
      return;
    }
  }
  const [updated] = await db.update(languageContentItemsTable).set({
    ...parsed.data,
    updatedAt: new Date(),
  }).where(eq(languageContentItemsTable.id, existing.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "عنصر اللغة غير موجود." });
    return;
  }
  await db.insert(adminAuditTable).values({
    actorId: res.locals.userId as string,
    action: parsed.data.active === false ? "language_content_archived" : "language_content_updated",
    target: existing.id,
  });
  res.json(UpdateAdminLanguageContentResponse.parse(serializeItem(updated)));
});

export default router;
