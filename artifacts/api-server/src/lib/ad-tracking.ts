import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { getAuth } from "@clerk/express";
import { db, membershipsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function key() {
  if (!process.env.SESSION_SECRET) throw new Error("Analytics signing is not configured");
  return process.env.SESSION_SECRET;
}
const sign = (value: string) => createHmac("sha256", key()).update(value).digest("hex");
export function visitorId(req: Request, res: Response) {
  const cookie = req.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith("athar_ad_visitor="))?.split("=")[1] ?? "";
  const [id, signature] = cookie.split(".");
  let valid = false;
  if (/^[a-f0-9]{32}$/.test(id ?? "") && /^[a-f0-9]{64}$/.test(signature ?? "")) {
    valid = timingSafeEqual(Buffer.from(sign(id), "hex"), Buffer.from(signature, "hex"));
  }
  const identifier = valid ? id : randomBytes(16).toString("hex");
  if (!valid) res.cookie("athar_ad_visitor", `${identifier}.${sign(identifier)}`, {
    httpOnly: true, sameSite: "lax", secure: req.secure || req.get("x-forwarded-proto")?.split(",")[0] === "https",
    maxAge: 30 * 86400000, path: "/api/ads",
  });
  // Store only a keyed anonymous browser identifier, never IP addresses or account IDs.
  return sign(`ad-visitor:${identifier}`);
}
export function sameOriginEvent(req: Request) {
  if (req.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === getClerkProxyHost(req); } catch { return false; }
}
export async function ignoreTracking(req: Request) {
  if (/bot|crawler|spider|headless/i.test(req.get("user-agent") ?? "")) return true;
  const userId = getAuth(req).userId;
  if (!userId) return false;
  const [member] = await db.select().from(membershipsTable).where(eq(membershipsTable.userId, userId));
  return member?.role === "admin" || member?.status === "suspended";
}
