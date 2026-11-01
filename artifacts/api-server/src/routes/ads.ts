import { Router, type IRouter } from "express";
import { and, desc, eq, gte, isNull, lte, gt, or, sql } from "drizzle-orm";
import {
  db, adsTable, adCustomersTable, adEventsTable, adLeadsTable, adAssetsTable, adminAuditTable,
} from "@workspace/db";
import {
  CreateAdCustomerBody, UpdateAdCustomerBody, UpdateAdminAdParams, GetPublishedAdsQueryParams,
  RecordAdEventBody, CreateAdEnquiryBody, UpdateAdEnquiryBody, RequestAdAssetUploadBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { parseStatisticsDays, validateAd } from "../lib/ad-rules";
import { createAssetUpload, validateUploadedAsset, assetFile } from "../lib/ad-storage";
import { ignoreTracking, sameOriginEvent, visitorId } from "../lib/ad-tracking";

const router: IRouter = Router();
const active = () => and(eq(adsTable.status, "active"),
  or(isNull(adsTable.startsAt), lte(adsTable.startsAt, new Date())),
  or(isNull(adsTable.endsAt), gt(adsTable.endsAt, new Date())));
const serializeAd = (ad: typeof adsTable.$inferSelect) => ({
  ...ad, updatedAt: ad.updatedAt.toISOString(), startsAt: ad.startsAt?.toISOString() ?? null, endsAt: ad.endsAt?.toISOString() ?? null,
});
const serializeCustomer = (row: typeof adCustomersTable.$inferSelect) => ({ ...row, createdAt: row.createdAt.toISOString() });
const validId = (id: unknown) => UpdateAdminAdParams.safeParse({ id });
router.use(["/admin/ads", "/admin/ad-customers", "/admin/ad-statistics", "/admin/ad-enquiries", "/admin/ad-assets"], requireAuth, requireAdmin);

router.get("/admin/ads", async (_req, res) => {
  res.json((await db.select().from(adsTable).orderBy(desc(adsTable.updatedAt))).map(serializeAd));
});
router.post("/admin/ads", async (req, res) => {
  const { data, error } = validateAd(req.body);
  if (!data) { res.status(400).json({ error }); return; }
  if (data.customerId && !(await db.select().from(adCustomersTable).where(eq(adCustomersTable.id, data.customerId))).length) {
    res.status(400).json({ error: "Advertiser customer not found" }); return;
  }
  const [ad] = await db.transaction(async tx => {
    const rows = await tx.insert(adsTable).values({ ...data,
      startsAt: data.startsAt ? new Date(data.startsAt) : null, endsAt: data.endsAt ? new Date(data.endsAt) : null,
    }).returning();
    await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "ad.create", target: rows[0].id });
    return rows;
  });
  res.status(201).json(serializeAd(ad));
});
router.put("/admin/ads/:id", async (req, res) => {
  const params = validId(req.params.id), result = validateAd(req.body);
  if (!params.success || !result.data) { res.status(400).json({ error: result.error ?? "Invalid identifier" }); return; }
  const data = result.data;
  if (data.customerId && !(await db.select().from(adCustomersTable).where(eq(adCustomersTable.id, data.customerId))).length) {
    res.status(400).json({ error: "Advertiser customer not found" }); return;
  }
  const ad = await db.transaction(async tx => {
    const [row] = await tx.update(adsTable).set({ ...data,
      startsAt: data.startsAt ? new Date(data.startsAt) : null, endsAt: data.endsAt ? new Date(data.endsAt) : null,
    }).where(eq(adsTable.id, params.data.id)).returning();
    if (row) await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: `ad.update:${data.status}`, target: row.id });
    return row;
  });
  if (!ad) { res.status(404).json({ error: "Ad not found" }); return; }
  res.json(serializeAd(ad));
});
router.delete("/admin/ads/:id", async (req, res) => {
  const params = validId(req.params.id);
  if (!params.success) { res.status(400).json({ error: "Invalid identifier" }); return; }
  const ad = await db.transaction(async tx => {
    const [row] = await tx.update(adsTable).set({ status: "archived" }).where(eq(adsTable.id, params.data.id)).returning();
    if (row) await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "ad.archive", target: row.id });
    return row;
  });
  if (!ad) { res.status(404).json({ error: "Ad not found" }); return; }
  res.json({ ok: true });
});
router.get("/admin/ad-customers", async (_req, res) => {
  res.json((await db.select().from(adCustomersTable).orderBy(desc(adCustomersTable.createdAt))).map(serializeCustomer));
});
router.post("/admin/ad-customers", async (req, res) => {
  const input = CreateAdCustomerBody.strict().safeParse(req.body);
  if (!input.success || !input.data.name.trim() || (input.data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.data.email))) {
    res.status(400).json({ error: "Customer name and valid contact fields are required" }); return;
  }
  const row = await db.transaction(async tx => {
    const [customer] = await tx.insert(adCustomersTable).values({ ...input.data, name: input.data.name.trim() }).returning();
    await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "ad_customer.create", target: customer.id });
    return customer;
  });
  res.status(201).json(serializeCustomer(row));
});
router.put("/admin/ad-customers/:id", async (req, res) => {
  const params = validId(req.params.id), input = UpdateAdCustomerBody.strict().safeParse(req.body);
  if (!params.success || !input.success || !input.data.name.trim() || (input.data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.data.email))) {
    res.status(400).json({ error: "Invalid customer fields" }); return;
  }
  const row = await db.transaction(async tx => {
    const [customer] = await tx.update(adCustomersTable).set({ ...input.data, name: input.data.name.trim() }).where(eq(adCustomersTable.id, params.data.id)).returning();
    if (customer) await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "ad_customer.update", target: customer.id });
    return customer;
  });
  if (!row) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(serializeCustomer(row));
});
router.delete("/admin/ad-customers/:id", async (req, res) => {
  const params = validId(req.params.id);
  if (!params.success) { res.status(400).json({ error: "Invalid identifier" }); return; }
  const removed = await db.transaction(async tx => {
    const [row] = await tx.delete(adCustomersTable).where(eq(adCustomersTable.id, params.data.id)).returning();
    if (row) await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: "ad_customer.delete", target: row.id });
    return row;
  });
  if (!removed) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json({ ok: true });
});
router.patch("/admin/ad-enquiries/:id", async (req, res) => {
  const params = validId(req.params.id), input = UpdateAdEnquiryBody.strict().safeParse(req.body);
  if (!params.success || !input.success) { res.status(400).json({ error: "Invalid enquiry status" }); return; }
  const row = await db.transaction(async tx => {
    const [lead] = await tx.update(adLeadsTable).set(input.data).where(eq(adLeadsTable.id, params.data.id)).returning();
    if (lead) await tx.insert(adminAuditTable).values({ actorId: res.locals.userId, action: `ad_enquiry.status:${input.data.status}`, target: lead.id });
    return lead;
  });
  if (!row) { res.status(404).json({ error: "Enquiry not found" }); return; }
  res.json({ ok: true });
});
router.post("/admin/ad-assets", async (req, res) => {
  const input = RequestAdAssetUploadBody.strict().safeParse(req.body);
  if (!input.success || (input.data.mime.startsWith("image/") && input.data.size > 10 * 1024 * 1024)) {
    res.status(400).json({ error: "Use JPEG/PNG/WebP/GIF up to 10MB or MP4/WebM up to 80MB" }); return;
  }
  const { objectPath, uploadUrl } = await createAssetUpload();
  const [asset] = await db.insert(adAssetsTable).values({ ...input.data, ownerId: res.locals.userId, objectPath }).returning();
  res.status(201).json({ id: asset.id, uploadUrl });
});
router.post("/admin/ad-assets/:id/confirm", async (req, res) => {
  const params = validId(req.params.id);
  if (!params.success) { res.status(400).json({ error: "Invalid asset" }); return; }
  const [asset] = await db.select().from(adAssetsTable).where(and(eq(adAssetsTable.id, params.data.id), eq(adAssetsTable.ownerId, res.locals.userId)));
  if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
  if (asset.status === "ready") { res.json({ url: `/api/ads/media/${asset.id}` }); return; }
  let confirmedPath: string | null = null;
  try { confirmedPath = await validateUploadedAsset(asset.objectPath, asset.mime, asset.size); } catch { /* incomplete upload remains unavailable */ }
  if (!confirmedPath) { res.status(400).json({ error: "Upload missing, too large, or file content does not match its media type" }); return; }
  await db.update(adAssetsTable).set({ status: "ready", objectPath: confirmedPath }).where(eq(adAssetsTable.id, asset.id));
  res.json({ url: `/api/ads/media/${asset.id}` });
});

router.get("/ads/media/:id", async (req, res, next) => {
  const params = validId(req.params.id);
  if (!params.success) { res.sendStatus(404); return; }
  const [asset] = await db.select().from(adAssetsTable).where(and(eq(adAssetsTable.id, params.data.id), eq(adAssetsTable.status, "ready")));
  if (!asset) { res.sendStatus(404); return; }
  const file = assetFile(asset.objectPath);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  res.set({ "Content-Type": asset.mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600", "Accept-Ranges": "bytes" });
  const range = req.get("range");
  let start = 0, end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) { res.status(416).set("Content-Range", `bytes */${size}`).end(); return; }
    if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
    else { start = Math.max(0, size - Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) { res.status(416).set("Content-Range", `bytes */${size}`).end(); return; }
    res.status(206).set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  res.set("Content-Length", String(end - start + 1));
  const stream = file.createReadStream({ start, end, validation: false });
  stream.on("error", next);
  res.on("close", () => stream.destroy());
  stream.pipe(res);
});
router.get("/ads", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const input = GetPublishedAdsQueryParams.safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: "Invalid page" }); return; }
  const ads = (await db.select().from(adsTable).where(active()).orderBy(desc(adsTable.updatedAt)))
    .filter(ad => ad.placements.some(placement => placement.page === input.data.page));
  if (ads.length) visitorId(req, res);
  res.json(ads.map(ad => ({
    id: ad.id, title: ad.title, format: ad.format, mediaUrl: ad.mediaUrl, code: ad.code, destination: ad.destination, cta: ad.cta,
    placements: ad.placements.filter(placement => placement.page === input.data.page),
  })));
});
router.post("/ads/:id/events", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginEvent(req)) { res.sendStatus(403); return; }
  const params = validId(req.params.id), input = RecordAdEventBody.strict().safeParse(req.body);
  if (!params.success || !input.success) { res.status(400).json({ error: "Invalid event" }); return; }
  if (await ignoreTracking(req)) { res.json({ ok: true }); return; }
  const [ad] = await db.select().from(adsTable).where(and(eq(adsTable.id, params.data.id), active()));
  if (!ad || !ad.placements.some(placement => placement.page === input.data.page && placement.slot === input.data.slot)) {
    res.status(404).json({ error: "Active placement not found" }); return;
  }
  await db.insert(adEventsTable).values({
    adId: ad.id, customerId: ad.customerId, kind: input.data.kind, visitor: visitorId(req, res),
    placement: `${input.data.page}:${input.data.slot}`, window: Math.floor(Date.now() / 900000),
  }).onConflictDoNothing();
  res.json({ ok: true });
});
router.post("/ads/:id/enquiries", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginEvent(req)) { res.sendStatus(403); return; }
  const params = validId(req.params.id), input = CreateAdEnquiryBody.strict().safeParse(req.body);
  if (!params.success || !input.success || !input.data.consent || !input.data.name.trim() || input.data.contact.trim().length < 3) {
    res.status(400).json({ error: "Name, contact information and explicit consent are required" }); return;
  }
  const [ad] = await db.select().from(adsTable).where(and(eq(adsTable.id, params.data.id), active()));
  if (!ad) { res.status(404).json({ error: "Ad not available" }); return; }
  const visitor = visitorId(req, res);
  const accepted = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${visitor}))`);
    const recent = await tx.$count(adLeadsTable, and(eq(adLeadsTable.visitor, visitor), gte(adLeadsTable.createdAt, new Date(Date.now() - 86400000))));
    if (recent >= 3) return false;
    await tx.insert(adLeadsTable).values({ adId: ad.id, customerId: ad.customerId, visitor, name: input.data.name.trim(),
      contact: input.data.contact.trim(), message: input.data.message.trim() });
    return true;
  });
  if (!accepted) { res.status(429).json({ error: "Please wait before sending more enquiries" }); return; }
  res.status(201).json({ ok: true });
});

type Counts = { id: string; impressions: number; clicks: number; visitors: number };
type LeadCount = { id: string; enquiries: number };
const metric = (events?: Partial<Counts>, leads = 0) => {
  const impressions = Number(events?.impressions ?? 0), clicks = Number(events?.clicks ?? 0);
  return { impressions, clicks, visitors: Number(events?.visitors ?? 0), enquiries: Number(leads), ctr: impressions ? Math.round(clicks / impressions * 10000) / 100 : 0 };
};
router.get("/admin/ad-statistics", async (req, res) => {
  const input = parseStatisticsDays(req.query.days);
  if (!input.success) { res.status(400).json({ error: "Choose 7, 30 or 90 days" }); return; }
  const days = input.data.days;
  const since = new Date(); since.setUTCHours(0,0,0,0); since.setUTCDate(since.getUTCDate() - days + 1);
  const [byAdResult, byCustomerResult, dailyResult, totalsResult, leadAdResult, leadCustomerResult, leadDailyResult, ads, customers, leads] = await Promise.all([
    db.execute(sql`select ad_id as id, count(*) filter(where kind='impression')::int as impressions, count(*) filter(where kind='click')::int as clicks, count(distinct visitor) filter(where kind='impression')::int as visitors from ad_events where created_at >= ${since} group by ad_id`),
    db.execute(sql`select coalesce(customer_id::text,'unassigned') as id, count(*) filter(where kind='impression')::int as impressions, count(*) filter(where kind='click')::int as clicks, count(distinct visitor) filter(where kind='impression')::int as visitors from ad_events where created_at >= ${since} group by customer_id`),
    db.execute(sql`select to_char(created_at at time zone 'UTC','YYYY-MM-DD') as id, count(*) filter(where kind='impression')::int as impressions, count(*) filter(where kind='click')::int as clicks, count(distinct visitor) filter(where kind='impression')::int as visitors from ad_events where created_at >= ${since} group by 1`),
    db.execute(sql`select count(*) filter(where kind='impression')::int as impressions, count(*) filter(where kind='click')::int as clicks, count(distinct visitor) filter(where kind='impression')::int as visitors from ad_events where created_at >= ${since}`),
    db.execute(sql`select ad_id as id, count(*)::int as enquiries from ad_enquiries where created_at >= ${since} group by ad_id`),
    db.execute(sql`select coalesce(customer_id::text,'unassigned') as id, count(*)::int as enquiries from ad_enquiries where created_at >= ${since} group by customer_id`),
    db.execute(sql`select to_char(created_at at time zone 'UTC','YYYY-MM-DD') as id, count(*)::int as enquiries from ad_enquiries where created_at >= ${since} group by 1`),
    db.select().from(adsTable), db.select().from(adCustomersTable),
    db.select({ id: adLeadsTable.id, adId: adLeadsTable.adId, adTitle: adsTable.title, name: adLeadsTable.name,
      contact: adLeadsTable.contact, message: adLeadsTable.message, status: adLeadsTable.status, createdAt: adLeadsTable.createdAt,
    }).from(adLeadsTable).innerJoin(adsTable, eq(adsTable.id, adLeadsTable.adId))
      .where(gte(adLeadsTable.createdAt, since)).orderBy(desc(adLeadsTable.createdAt)).limit(100),
  ]);
  const events = (result: typeof byAdResult) => result.rows as unknown as Counts[];
  const leadCounts = (result: typeof leadAdResult) => result.rows as unknown as LeadCount[];
  const combined = (id: string, e: typeof byAdResult, l: typeof leadAdResult) => metric(events(e).find(row => row.id === id), leadCounts(l).find(row => row.id === id)?.enquiries);
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(since); date.setUTCDate(date.getUTCDate() + index);
    const id = date.toISOString().slice(0,10);
    return { date: id, ...combined(id, dailyResult, leadDailyResult) };
  });
  res.json({
    updatedAt: new Date().toISOString(), days,
    totals: metric(events(totalsResult)[0], leadCounts(leadAdResult).reduce((total, row) => total + Number(row.enquiries), 0)),
    byAd: ads.map(ad => ({ id: ad.id, title: ad.title, ...combined(ad.id, byAdResult, leadAdResult) })),
    byCustomer: [...customers.map(customer => ({ id: customer.id, title: customer.name })), { id: "unassigned", title: "بدون عميل" }]
      .map(customer => ({ ...customer, ...combined(customer.id, byCustomerResult, leadCustomerResult) })),
    daily, leads: leads.map(lead => ({ ...lead, createdAt: lead.createdAt.toISOString() })),
  });
});
export default router;
