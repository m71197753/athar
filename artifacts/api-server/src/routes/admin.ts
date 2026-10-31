import { Router, type IRouter, type RequestHandler } from "express";
import { clerkClient } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import mammoth from "mammoth";
import {
  db, membershipsTable, adminAuditTable, platformContentTable, platformSettingsTable, platformSectionsTable,
  platformMediaAssetsTable, studentsTable, achievementsTable, learningItemsTable, careerPlansTable, resumeSharesTable,
} from "@workspace/db";
import {
  CreateAdminContentBody, UpdateAdminContentBody, UpdateAdminUserBody,
  SaveAdminSettingsBody, ListAdminUsersQueryParams, ListAdminAuditQueryParams,
  UpdateAdminContentParams, CreateAdminSectionBody, UpdateAdminSectionBody,
  UpdateAdminSectionParams, DeleteAdminSectionParams, GetPlatformContentResponse,
  GetAdminOverviewDetailsQueryParams, GetAdminOverviewDetailsResponse,
  RequestSectionMediaUploadBody, RequestSectionMediaUploadResponse,
  ConfirmSectionMediaUploadParams, ConfirmSectionMediaUploadResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { ALL_MODULES, enabledModules, platformAppearance, platformModuleSettings } from "../lib/platform-access";
import { assetFile, createAssetUpload, createResumableSectionUpload, validateUploadedAsset } from "../lib/ad-storage";
import { validCourseUnits } from "../lib/section-course-units";

const router: IRouter = Router();
const PAGE_SIZE = 20;
const serializedContent = (item: typeof platformContentTable.$inferSelect) => ({ ...item, updatedAt: item.updatedAt.toISOString() });
const serializedSection = (item: typeof platformSectionsTable.$inferSelect) => ({ ...item, updatedAt: item.updatedAt.toISOString() });
const sectionMimeKind: Record<string, "image" | "audio" | "video" | "file"> = {
  "image/jpeg": "image", "image/png": "image", "image/webp": "image", "image/gif": "image",
  "audio/mpeg": "audio", "audio/mp4": "audio", "audio/wav": "audio", "audio/ogg": "audio", "audio/webm": "audio",
  "video/mp4": "video", "video/webm": "video",
  "application/pdf": "file",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "file",
  "text/plain": "file",
};
const sectionMediaUrl = (id: string) => `/api/platform/section-media/${id}`;
const sectionMediaIdFromUrl = (url: string) => /^\/api\/platform\/section-media\/([a-f0-9-]{36})$/i.exec(url)?.[1];

async function hasReadySectionMedia(
  blocks: Array<{ type: string; url: string; mediaType?: string }>,
  courses: Array<{ materials: Array<{ type: string; url: string; mediaType?: string }> }> = [],
) {
  const allBlocks = [...blocks, ...courses.flatMap(course => course.materials)];
  const ids = [...new Set(allBlocks.filter(block => block.type === "media").map(block => sectionMediaIdFromUrl(block.url)).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return !allBlocks.some(block => block.type === "media");
  const assets = await db.select().from(platformMediaAssetsTable)
    .where(and(inArray(platformMediaAssetsTable.id, ids), eq(platformMediaAssetsTable.status, "ready")));
  const assetsById = new Map(assets.map(asset => [asset.id, asset]));
  return allBlocks.filter(block => block.type === "media").every(block => {
    const id = sectionMediaIdFromUrl(block.url);
    const asset = id ? assetsById.get(id) : undefined;
    return Boolean(asset && block.mediaType === sectionMimeKind[asset.mime]);
  });
}

router.get("/access", requireAuth, async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ userId: res.locals.userId, role: res.locals.role, status: "active",
    enabledModules: res.locals.role === "admin" ? ALL_MODULES : await enabledModules() });
});
router.get("/platform", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const [items, sections, moduleSettings, modules, appearance] = await Promise.all([
    db.select().from(platformContentTable).where(eq(platformContentTable.published, true)).orderBy(desc(platformContentTable.updatedAt)),
    db.select().from(platformSectionsTable).where(eq(platformSectionsTable.published, true))
      .orderBy(platformSectionsTable.sortOrder, desc(platformSectionsTable.updatedAt)),
    platformModuleSettings(), enabledModules(), platformAppearance(),
  ]);
  res.json(GetPlatformContentResponse.parse({
    items: items.map(serializedContent), sections: sections.map(serializedSection),
    moduleSettings, enabledModules: modules, appearance,
  }));
});
const serveSectionMedia: RequestHandler = async (req, res) => {
  const adminPreview = req.path?.startsWith("/admin/section-media/") ?? false;
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!/^[a-f0-9-]{36}$/i.test(id)) { res.status(404).end(); return; }
  const [asset] = await db.select().from(platformMediaAssetsTable)
    .where(and(eq(platformMediaAssetsTable.id, id), eq(platformMediaAssetsTable.status, "ready")));
  if (!asset) { res.status(404).end(); return; }

  const [publishedSections, settings] = await Promise.all([
    db.select({ blocks: platformSectionsTable.blocks, courses: platformSectionsTable.courses }).from(platformSectionsTable)
      .where(eq(platformSectionsTable.published, true)),
    db.select({ moduleSettings: platformSettingsTable.moduleSettings }).from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "main")).limit(1),
  ]);
  const url = sectionMediaUrl(id);
  const referenced = publishedSections.some(section =>
    section.blocks.some(block => block.type === "media" && block.url === url) ||
    section.courses.some(course => course.materials.some(block => block.type === "media" && block.url === url))) ||
    Boolean(settings[0]?.moduleSettings?.some(module => module.enabled && module.blocks?.some(block => block.type === "media" && block.url === url)));
  if (!referenced && !adminPreview) { res.status(404).end(); return; }
  const cacheControl = adminPreview ? "private, no-store" : "public, max-age=86400, immutable";
  res.setHeader("Cache-Control", cacheControl);

  if (req.query?.["preview"] === "1" && asset.mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (asset.size > 10 * 1024 * 1024) {
      res.type("text/plain").send("هذا المستند كبير للمعاينة النصية. استخدم زر تنزيل الملف لفتحه على جهازك.");
      return;
    }
    try {
      const [bytes] = await assetFile(asset.objectPath).download({ validation: false });
      const preview = await mammoth.extractRawText({ buffer: bytes });
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'self'");
      res.setHeader("Cache-Control", cacheControl);
      res.send(preview.value);
    } catch (error) {
      req.log.warn({ assetId: id, error }, "Unable to render document preview");
      res.status(500).json({ error: "Document preview unavailable" });
    }
    return;
  }

  const range = req.get("range");
  res.setHeader("Content-Type", asset.mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`);
  res.setHeader("Accept-Ranges", "bytes");
  if (range && (asset.mime.startsWith("video/") || asset.mime.startsWith("audio/"))) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), asset.size - 1) : asset.size - 1;
    if (!match || start < 0 || end < start || start >= asset.size) {
      res.setHeader("Content-Range", `bytes */${asset.size}`);
      res.status(416).end();
      return;
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${asset.size}`);
    res.setHeader("Content-Length", String(end - start + 1));
    assetFile(asset.objectPath).createReadStream({ start, end }).on("error", () => res.destroy()).pipe(res);
    return;
  }
  res.setHeader("Content-Length", String(asset.size));
  assetFile(asset.objectPath).createReadStream().on("error", () => res.destroy()).pipe(res);
};
router.get("/platform/section-media/:id", serveSectionMedia);
router.use("/admin", requireAuth, requireAdmin);
router.get("/admin/section-media/:id/preview", serveSectionMedia);

router.get("/admin/overview", async (_req, res) => {
  const [accounts, students, achievements, learningItems, careerPlans, activeShares, admins, suspended] = await Promise.all([
    clerkClient.users.getCount(),
    db.$count(studentsTable), db.$count(achievementsTable), db.$count(learningItemsTable), db.$count(careerPlansTable),
    db.$count(resumeSharesTable, eq(resumeSharesTable.enabled, true)),
    db.$count(membershipsTable, and(eq(membershipsTable.role, "admin"), eq(membershipsTable.status, "active"))),
    db.$count(membershipsTable, eq(membershipsTable.status, "suspended")),
  ]);
  res.json({ accounts, students, achievements, learningItems, careerPlans, activeShares, admins, suspended });
});

router.get("/admin/overview/details", async (req, res) => {
  const parsed = GetAdminOverviewDetailsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid detail category or page" }); return; }
  const { kind, page } = parsed.data;
  const offset = (page - 1) * PAGE_SIZE;
  let items: Array<{ id: string; title: string; subtitle: string; ownerId: string; updatedAt: string }> = [];
  let total = 0;

  switch (kind) {
    case "accounts": {
      const { data, totalCount } = await clerkClient.users.getUserList({ limit: PAGE_SIZE, offset });
      const ids = data.map(user => user.id);
      const [members, shares] = ids.length ? await Promise.all([
        db.select().from(membershipsTable).where(inArray(membershipsTable.userId, ids)),
        db.select({ userId: resumeSharesTable.userId }).from(resumeSharesTable)
          .where(and(inArray(resumeSharesTable.userId, ids), eq(resumeSharesTable.enabled, true))),
      ]) : [[], []];
      total = totalCount;
      items = data.map(user => {
        const email = user.emailAddresses.find(row => row.id === user.primaryEmailAddressId)?.emailAddress ?? "";
        const membership = members.find(row => row.userId === user.id);
        const role = membership?.role ?? "student";
        const status = membership?.status ?? "active";
        const hasShare = shares.some(row => row.userId === user.id);
        return {
          id: user.id,
          title: [user.firstName, user.lastName].filter(Boolean).join(" ") || "حساب طالب",
          subtitle: [email, role === "admin" ? "مشرف" : "طالب", status === "suspended" ? "موقوف" : "نشط", hasShare ? "له رابط عام" : ""].filter(Boolean).join(" · "),
          ownerId: user.id,
          updatedAt: new Date(user.createdAt).toISOString(),
        };
      });
      break;
    }
    case "students": {
      const [rows, [{ total: rowCount }]] = await Promise.all([
        db.select().from(studentsTable).orderBy(desc(studentsTable.updatedAt)).limit(PAGE_SIZE).offset(offset),
        db.select({ total: count() }).from(studentsTable),
      ]);
      total = rowCount;
      items = rows.map(row => ({
        id: row.id, title: row.fullName,
        subtitle: [row.university, row.major, row.yearOfStudy ? `السنة ${row.yearOfStudy}` : ""].filter(Boolean).join(" · "),
        ownerId: row.userId, updatedAt: row.updatedAt.toISOString(),
      }));
      break;
    }
    case "admins":
    case "suspended": {
      const predicate = kind === "admins"
        ? and(eq(membershipsTable.role, "admin"), eq(membershipsTable.status, "active"))
        : eq(membershipsTable.status, "suspended");
      const [rows, [{ total: rowCount }]] = await Promise.all([
        db.select().from(membershipsTable).where(predicate).orderBy(desc(membershipsTable.updatedAt)).limit(PAGE_SIZE).offset(offset),
        db.select({ total: count() }).from(membershipsTable).where(predicate),
      ]);
      total = rowCount;
      items = rows.map(row => ({
        id: row.userId, title: kind === "admins" ? "حساب مشرف" : "حساب موقوف",
        subtitle: row.userId, ownerId: row.userId, updatedAt: row.updatedAt.toISOString(),
      }));
      break;
    }
    case "achievements": {
      const [rows, [{ total: rowCount }]] = await Promise.all([
        db.select().from(achievementsTable).orderBy(desc(achievementsTable.updatedAt)).limit(PAGE_SIZE).offset(offset),
        db.select({ total: count() }).from(achievementsTable),
      ]);
      total = rowCount;
      items = rows.map(row => ({
        id: row.id, title: row.title,
        subtitle: [row.category, row.summary || row.result].filter(Boolean).join(" · "),
        ownerId: row.userId, updatedAt: row.updatedAt.toISOString(),
      }));
      break;
    }
    case "learningItems": {
      const [rows, [{ total: rowCount }]] = await Promise.all([
        db.select().from(learningItemsTable).orderBy(desc(learningItemsTable.updatedAt)).limit(PAGE_SIZE).offset(offset),
        db.select({ total: count() }).from(learningItemsTable),
      ]);
      total = rowCount;
      items = rows.map(row => ({
        id: row.id, title: row.title,
        subtitle: [row.kind, row.subject, row.source].filter(Boolean).join(" · "),
        ownerId: row.userId, updatedAt: row.updatedAt.toISOString(),
      }));
      break;
    }
    case "careerPlans": {
      const [rows, [{ total: rowCount }]] = await Promise.all([
        db.select().from(careerPlansTable).orderBy(desc(careerPlansTable.updatedAt)).limit(PAGE_SIZE).offset(offset),
        db.select({ total: count() }).from(careerPlansTable),
      ]);
      total = rowCount;
      items = rows.map(row => ({
        id: row.id, title: row.targetRole,
        subtitle: [row.overview, row.focusSkills.join("، ")].filter(Boolean).join(" · "),
        ownerId: row.userId, updatedAt: row.updatedAt.toISOString(),
      }));
      break;
    }
    case "activeShares": {
      const [rows, [{ total: rowCount }]] = await Promise.all([
        db.select().from(resumeSharesTable).where(eq(resumeSharesTable.enabled, true))
          .orderBy(desc(resumeSharesTable.updatedAt)).limit(PAGE_SIZE).offset(offset),
        db.select({ total: count() }).from(resumeSharesTable).where(eq(resumeSharesTable.enabled, true)),
      ]);
      total = rowCount;
      items = rows.map(row => ({
        id: row.id, title: "رابط عام مفعّل", subtitle: "رابط السيرة متاح للمشاركة",
        ownerId: row.userId, updatedAt: row.updatedAt.toISOString(),
      }));
      break;
    }
  }

  res.json(GetAdminOverviewDetailsResponse.parse({ kind, items, total, page, pageSize: PAGE_SIZE }));
});

router.get("/admin/users", async (req, res) => {
  const parsed = ListAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid search or page" }); return; }
  const { page, search } = parsed.data;
  const { data, totalCount } = await clerkClient.users.getUserList({ query: search?.trim() || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const ids = data.map(user => user.id);
  const members = ids.length ? await db.select().from(membershipsTable).where(inArray(membershipsTable.userId, ids)) : [];
  const shares = ids.length ? await db.select({ userId: resumeSharesTable.userId }).from(resumeSharesTable).where(and(inArray(resumeSharesTable.userId, ids), eq(resumeSharesTable.enabled, true))) : [];
  res.json({ total: totalCount, page, pageSize: PAGE_SIZE, items: data.map(user => {
    const member = members.find(row => row.userId === user.id);
    const email = user.emailAddresses.find(row => row.id === user.primaryEmailAddressId);
    return { userId: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "طالب أثر",
      email: email?.emailAddress ?? "", verified: email?.verification?.status === "verified",
      role: member?.role ?? "student", status: member?.status ?? "active",
      createdAt: new Date(user.createdAt).toISOString(), shared: shares.some(row => row.userId === user.id) };
  }) });
});

router.patch("/admin/users/:userId", async (req, res) => {
  const input = UpdateAdminUserBody.strict().safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Invalid membership" }); return; }
  const userId = String(req.params.userId);
  if (userId === res.locals.userId) { res.status(409).json({ error: "You cannot change your own role or account status" }); return; }
  let target;
  try { target = await clerkClient.users.getUser(userId); }
  catch (error) {
    if ((error as { status?: number }).status === 404) { res.status(404).json({ error: "User not found" }); return; }
    throw error;
  }
  const primary = target.emailAddresses.find(email => email.id === target.primaryEmailAddressId);
  if (input.data.role === "admin" && primary?.verification?.status !== "verified") {
    res.status(400).json({ error: "An administrator must have a verified primary email" }); return;
  }
  const changed = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(812604)`);
    // Recheck actor under the same lock as every role mutation.
    const [actor] = await tx.select().from(membershipsTable).where(eq(membershipsTable.userId, res.locals.userId));
    if (actor?.role !== "admin" || actor.status !== "active") return false;
    await tx.insert(membershipsTable).values({ userId, ...input.data })
      .onConflictDoUpdate({ target: membershipsTable.userId, set: input.data });
    if (input.data.status === "suspended") {
      await tx.update(resumeSharesTable).set({ enabled: false, token: null }).where(eq(resumeSharesTable.userId, userId));
    }
    await tx.insert(adminAuditTable).values({ actorId: res.locals.userId,
      action: `member.update:${input.data.role}:${input.data.status}`, target: userId });
    return true;
  });
  if (!changed) { res.status(403).json({ error: "Administrator access was revoked" }); return; }
  res.json({ ok: true });
});

router.delete("/admin/users/:userId", async (req, res) => {
  const userId = String(req.params.userId);
  await db.transaction(async tx => {
    await tx.update(resumeSharesTable).set({ enabled: false, token: null }).where(eq(resumeSharesTable.userId, userId));
    await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "share.revoke", target: userId });
  });
  res.json({ ok: true });
});

router.get("/admin/content", async (_req, res) => {
  const items = await db.select().from(platformContentTable).orderBy(desc(platformContentTable.updatedAt));
  res.json({ items: items.map(serializedContent) });
});

function validUrl(kind: string, url: string) {
  if (!url) return kind === "announcement";
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch { return false; }
}

router.post("/admin/content", async (req, res) => {
  const parsed = CreateAdminContentBody.strict().safeParse(req.body);
  if (!parsed.success || !parsed.data.title.trim() || !validUrl(parsed.data.kind, parsed.data.url)) {
    res.status(400).json({ error: "A title and a valid HTTP(S) link are required for resources" }); return;
  }
  const item = await db.transaction(async tx => {
    const [created] = await tx.insert(platformContentTable).values({ ...parsed.data, title: parsed.data.title.trim() }).returning();
    await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "content.create", target: created.id });
    return created;
  });
  res.status(201).json(serializedContent(item));
});

router.put("/admin/content/:id", async (req, res) => {
  const params = UpdateAdminContentParams.safeParse(req.params);
  const input = UpdateAdminContentBody.strict().safeParse(req.body);
  if (!params.success || !input.success || !input.data.title.trim() || !validUrl(input.data.kind, input.data.url)) {
    res.status(400).json({ error: "Invalid content or URL" }); return;
  }
  const item = await db.transaction(async tx => {
    const [updated] = await tx.update(platformContentTable).set({ ...input.data, title: input.data.title.trim() })
      .where(eq(platformContentTable.id, params.data.id)).returning();
    if (updated) await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "content.update", target: updated.id });
    return updated;
  });
  if (!item) { res.status(404).json({ error: "Content not found" }); return; }
  res.json(serializedContent(item));
});
router.delete("/admin/content/:id", async (req, res) => {
  const params = UpdateAdminContentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid identifier" }); return; }
  const removed = await db.transaction(async tx => {
    const [item] = await tx.delete(platformContentTable).where(eq(platformContentTable.id, params.data.id)).returning();
    if (item) await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "content.delete", target: item.id });
    return item;
  });
  if (!removed) { res.status(404).json({ error: "Content not found" }); return; }
  res.json({ ok: true });
});
router.get("/admin/settings", async (_req, res) => {
  const [moduleSettings, appearance] = await Promise.all([platformModuleSettings(), platformAppearance()]);
  res.json({ moduleSettings, appearance });
});
router.put("/admin/settings", async (req, res) => {
  const input = SaveAdminSettingsBody.strict().safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Invalid module settings" }); return;
  }
  const moduleSettings = input.data.moduleSettings.map(module => ({
    ...module, title: module.title.trim(), description: module.description.trim(),
    blocks: (module.blocks ?? []).map(block => ({
      ...block, title: block.title.trim(), body: block.body.trim(), url: block.url.trim(),
    })),
  }));
  const keys = new Set(moduleSettings.map(module => module.key));
  if (moduleSettings.length !== ALL_MODULES.length || keys.size !== ALL_MODULES.length || !ALL_MODULES.every(key => keys.has(key)) ||
      moduleSettings.some(module => module.title.length < 2 || module.blocks.length > 20 ||
        module.blocks.some(block => !block.title || (block.type === "text" ? !block.body || block.url !== "" :
          block.type === "link" ? !validUrl("resource", block.url) :
            block.type === "media" ? !sectionMediaIdFromUrl(block.url) || !block.mediaType : true)))) {
    res.status(400).json({ error: "Every platform section must be configured exactly once" }); return;
  }
  if (!await hasReadySectionMedia(moduleSettings.flatMap(module => module.blocks))) {
    res.status(400).json({ error: "An attached media file is missing or does not match its type" }); return;
  }
  const enabled = moduleSettings.filter(module => module.enabled).map(module => module.key);
  const appearance = { ...await platformAppearance(), ...input.data.appearance };
  await db.transaction(async tx => {
    await tx.insert(platformSettingsTable).values({
      key: "main", enabledModules: enabled, moduleSettings, appearance,
    }).onConflictDoUpdate({ target: platformSettingsTable.key, set: {
      enabledModules: enabled, moduleSettings, appearance,
    } });
    await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "settings.save", target: "platform" });
  });
  res.json({ moduleSettings, appearance });
});

function validSectionBlocks(blocks: Array<{ type: string; url: string; mediaType?: string; unitId?: string }>, allowUnits = false) {
  return blocks.every(block => (!allowUnits && block.unitId !== undefined) ? false : block.type === "text" ? block.url === "" && !block.mediaType
    : block.type === "link" ? !block.mediaType && validUrl("resource", block.url)
      : block.type === "media" ? Boolean(block.mediaType && ["image", "audio", "video", "file"].includes(block.mediaType) && sectionMediaIdFromUrl(block.url))
        : false);
}
function validSectionCourses(courses: Array<{ id: string; title: string; skills?: string[]; units?: Array<{ id: string; title: string; description: string }>; materials: Array<{ type: string; url: string; mediaType?: string; unitId?: string }> }>) {
  const ids = new Set<string>();
  return courses.length <= 20 && courses.every(course => {
    const idIsUniqueUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(course.id) && !ids.has(course.id);
    ids.add(course.id);
    return idIsUniqueUuid && course.title.trim().length >= 2 &&
      (course.skills ?? []).length <= 20 &&
      (course.skills ?? []).every(skill => skill.trim().length > 0 && skill.trim().length <= 60) &&
      course.materials.length >= 1 && course.materials.length <= 20 &&
      validCourseUnits(course) && validSectionBlocks(course.materials, true);
  });
}
function normalizeSection(input: ReturnType<typeof CreateAdminSectionBody.parse>) {
  return {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    iconKey: input.iconKey ?? "book",
    accentKey: input.accentKey ?? "teal",
    cardStyle: input.cardStyle ?? "soft",
    blocks: input.blocks.map(block => ({
      ...block, title: block.title.trim(), body: block.body.trim(), url: block.url.trim(),
    })),
    courses: (input.courses ?? []).map(course => ({
      ...course,
      title: course.title.trim(),
      description: course.description.trim(),
      units: course.units?.map(unit => ({ ...unit, title: unit.title.trim(), description: unit.description.trim() })),
      skills: [...new Set((course.skills ?? []).map(skill => skill.trim()).filter(Boolean))],
      materials: course.materials.map(block => ({
        ...block, title: block.title.trim(), body: block.body.trim(), url: block.url.trim(),
      })),
    })),
  };
}
router.get("/admin/sections", async (_req, res) => {
  const items = await db.select().from(platformSectionsTable)
    .orderBy(platformSectionsTable.sortOrder, desc(platformSectionsTable.updatedAt));
  res.json({ items: GetPlatformContentResponse.shape.sections.parse(items.map(serializedSection)) });
});
router.post("/admin/section-media/uploads", async (req, res) => {
  const input = RequestSectionMediaUploadBody.strict().safeParse(req.body);
  if (!input.success || !sectionMimeKind[input.data.mime]) {
    res.status(400).json({ error: "Choose an image, audio, video, PDF, Word or text file" }); return;
  }
  const mime = input.data.mime;
  const originalName = input.data.originalName.replace(/[\u0000-\u001f\u007f/\\]/g, " ").trim().slice(0, 240) || "attachment";
  const resumable = input.data.resumable === true;
  const { objectPath, uploadUrl } = resumable
    ? await createResumableSectionUpload(mime, req.get("origin"))
    : await createAssetUpload("section-assets", 2 * 60 * 60 * 1000);
  const [asset] = await db.insert(platformMediaAssetsTable).values({
    ownerId: res.locals.userId, originalName, mime, size: input.data.size, objectPath, status: "uploading",
  }).returning();
  await db.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "section-media.upload-request", target: asset.id });
  res.setHeader("Cache-Control", "private, no-store");
  res.status(201).json(RequestSectionMediaUploadResponse.parse({ id: asset.id, uploadUrl, resumable }));
});
router.post("/admin/section-media/uploads/:id/confirm", async (req, res) => {
  const params = ConfirmSectionMediaUploadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid upload identifier" }); return; }
  const [asset] = await db.select().from(platformMediaAssetsTable).where(and(
    eq(platformMediaAssetsTable.id, params.data.id),
    eq(platformMediaAssetsTable.ownerId, res.locals.userId),
  ));
  if (!asset) { res.status(404).json({ error: "Upload not found" }); return; }
  if (asset.status === "ready") {
    res.json(ConfirmSectionMediaUploadResponse.parse({ url: sectionMediaUrl(asset.id) }));
    return;
  }
  if (asset.status !== "uploading") { res.status(409).json({ error: "Upload is not pending" }); return; }
  const confirmedPath = await validateUploadedAsset(asset.objectPath, asset.mime, asset.size, null);
  if (!confirmedPath) { res.status(400).json({ error: "Uploaded file failed type or size verification" }); return; }
  await db.update(platformMediaAssetsTable).set({ objectPath: confirmedPath, status: "ready" })
    .where(eq(platformMediaAssetsTable.id, asset.id));
  await db.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "section-media.upload-confirm", target: asset.id });
  res.json(ConfirmSectionMediaUploadResponse.parse({ url: sectionMediaUrl(asset.id) }));
});
router.post("/admin/sections", async (req, res) => {
  const parsed = CreateAdminSectionBody.strict().safeParse(req.body);
  if (!parsed.success || !parsed.data.title.trim() || !validSectionBlocks(parsed.data.blocks) ||
    !validSectionCourses(parsed.data.courses ?? [])) {
    res.status(400).json({ error: "Invalid section content or link" }); return;
  }
  if (!await hasReadySectionMedia(parsed.data.blocks, parsed.data.courses ?? [])) {
    res.status(400).json({ error: "An attached media file is missing or does not match its type" }); return;
  }
  const input = normalizeSection(parsed.data);
  const section = await db.transaction(async tx => {
    const [created] = await tx.insert(platformSectionsTable).values({
      ...input, slug: `section-${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    }).returning();
    await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "section.create", target: created.id });
    return created;
  });
  res.status(201).json(GetPlatformContentResponse.shape.sections.element.parse(serializedSection(section)));
});
router.put("/admin/sections/:id", async (req, res) => {
  const params = UpdateAdminSectionParams.safeParse(req.params);
  const parsed = UpdateAdminSectionBody.strict().safeParse(req.body);
  if (!params.success || !parsed.success || !parsed.data.title.trim() || !validSectionBlocks(parsed.data.blocks) ||
    !validSectionCourses(parsed.data.courses ?? [])) {
    res.status(400).json({ error: "Invalid section content or link" }); return;
  }
  if (!await hasReadySectionMedia(parsed.data.blocks, parsed.data.courses ?? [])) {
    res.status(400).json({ error: "An attached media file is missing or does not match its type" }); return;
  }
  const input = normalizeSection(parsed.data);
  const section = await db.transaction(async tx => {
    const [updated] = await tx.update(platformSectionsTable).set(input)
      .where(eq(platformSectionsTable.id, params.data.id)).returning();
    if (updated) {
      for (const course of input.courses ?? []) {
        await tx.update(learningItemsTable).set({ skills: course.skills ?? [] }).where(and(
          eq(learningItemsTable.sectionCourseId, course.id),
          eq(learningItemsTable.kind, "course"),
          eq(learningItemsTable.status, "completed"),
        ));
      }
      await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "section.update", target: updated.id });
    }
    return updated;
  });
  if (!section) { res.status(404).json({ error: "Section not found" }); return; }
  res.json(GetPlatformContentResponse.shape.sections.element.parse(serializedSection(section)));
});
router.delete("/admin/sections/:id", async (req, res) => {
  const params = DeleteAdminSectionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid section identifier" }); return; }
  const section = await db.transaction(async tx => {
    const [deleted] = await tx.delete(platformSectionsTable).where(eq(platformSectionsTable.id, params.data.id)).returning();
    if (deleted) await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "section.delete", target: deleted.id });
    return deleted;
  });
  if (!section) { res.status(404).json({ error: "Section not found" }); return; }
  res.json({ ok: true });
});
router.get("/admin/audit", async (req, res) => {
  const input = ListAdminAuditQueryParams.safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: "Invalid page" }); return; }
  const { page } = input.data;
  const [items, [{ total }]] = await Promise.all([
    db.select().from(adminAuditTable).orderBy(desc(adminAuditTable.createdAt), desc(adminAuditTable.id)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(adminAuditTable),
  ]);
  res.json({ items: items.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })), total, page, pageSize: PAGE_SIZE });
});
export default router;
