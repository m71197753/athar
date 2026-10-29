import type { RequestHandler } from "express";
import { getClerkProxyHost } from "./clerkProxyMiddleware";

/** Must follow requireAuth; never trust a client role or email. */
export const requireAdmin: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (res.locals.role !== "admin") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    let crossOrigin = req.get("sec-fetch-site") === "cross-site";
    if (origin) {
      try { crossOrigin ||= new URL(origin).host !== getClerkProxyHost(req); }
      catch { crossOrigin = true; }
    }
    if (crossOrigin) {
      res.status(403).json({ error: "Cross-origin administrative changes are not allowed" });
      return;
    }
  }
  next();
};
