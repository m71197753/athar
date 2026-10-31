// Uses the Replit App Storage sidecar, following the object-storage service template.
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { matchesMagic } from "./ad-rules";

const sidecar = "http://127.0.0.1:1106";
const storage = new Storage({
  projectId: "",
  credentials: {
    audience: "replit", subject_token_type: "access_token", token_url: `${sidecar}/token`,
    type: "external_account", credential_source: { url: `${sidecar}/credential`, format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  },
});
export function assetFile(path: string) {
  const parts = path.replace(/^\/+/, "").split("/");
  return storage.bucket(parts.shift()!).file(parts.join("/"));
}
export async function createAssetReadUrl(path: string, expiresInMs = 2 * 60 * 60 * 1000) {
  const base = process.env.PRIVATE_OBJECT_DIR;
  if (!base) throw new Error("App Storage is not configured");
  if (!Number.isSafeInteger(expiresInMs) || expiresInMs < 60_000 || expiresInMs > 24 * 60 * 60 * 1000) {
    throw new Error("Invalid asset read URL expiry");
  }
  const normalizedBase = base.replace(/^\/+|\/+$/g, "");
  const normalizedPath = path.replace(/^\/+/, "");
  if (!normalizedPath.startsWith(`${normalizedBase}/`)) throw new Error("Asset is outside the private object directory");
  const parts = normalizedPath.split("/");
  const bucketName = parts.shift();
  const objectName = parts.join("/");
  if (!bucketName || !objectName) throw new Error("Invalid asset object path");
  const response = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "GET",
      expires_at: new Date(Date.now() + expiresInMs).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Could not create an asset read URL");
  const payload = await response.json() as { signed_url?: unknown };
  if (typeof payload.signed_url !== "string") throw new Error("Invalid asset read URL response");
  const signedUrl = new URL(payload.signed_url);
  if (signedUrl.protocol !== "https:" || !signedUrl.hostname) throw new Error("Invalid asset read URL");
  return signedUrl.toString();
}
export async function createAssetUpload(folder = "ad-assets", expiresInMs = 2 * 60 * 60 * 1000) {
  if (!["ad-assets", "section-assets"].includes(folder)) throw new Error("Invalid asset folder");
  const base = process.env.PRIVATE_OBJECT_DIR;
  if (!base) throw new Error("App Storage is not configured");
  const objectPath = `${base.replace(/\/$/, "")}/${folder}/${randomUUID()}`;
  const parts = objectPath.replace(/^\/+/, "").split("/");
  const bucketName = parts.shift()!;
  const response = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket_name: bucketName, object_name: parts.join("/"), method: "PUT", expires_at: new Date(Date.now() + expiresInMs).toISOString() }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Could not create an upload URL");
  const { signed_url } = await response.json() as { signed_url: string };
  return { objectPath, uploadUrl: String(signed_url) };
}
export async function createResumableSectionUpload(mime: string, origin?: string) {
  const base = process.env.PRIVATE_OBJECT_DIR;
  if (!base) throw new Error("App Storage is not configured");
  const objectPath = `${base.replace(/\/$/, "")}/section-assets/${randomUUID()}`;
  const [uploadUrl] = await assetFile(objectPath).createResumableUpload({
    metadata: { contentType: mime },
    ...(origin ? { origin } : {}),
  });
  return { objectPath, uploadUrl };
}
export async function listSectionAssetObjects() {
  const base = process.env.PRIVATE_OBJECT_DIR;
  if (!base) throw new Error("App Storage is not configured");
  const parts = base.replace(/^\/+|\/+$/g, "").split("/");
  const bucketName = parts.shift();
  if (!bucketName || parts.length === 0) throw new Error("App Storage private path is invalid");
  const bucket = storage.bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix: `${parts.join("/")}/section-assets/`, autoPaginate: true });
  return files.map(file => ({ objectPath: `${bucketName}/${file.name}`, file }));
}
export async function validateUploadedAsset(path: string, mime: string, expectedSize: number, maxBytes: number | null = null) {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1) return null;
  const file = assetFile(path);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  if (size !== expectedSize || (maxBytes !== null && size > maxBytes) || metadata.contentType?.split(";")[0] !== mime || !metadata.generation) return null;
  // Pin the validated generation and copy to a new immutable key. The still-valid
  // presigned upload URL cannot overwrite a publicly served confirmed asset.
  const pinned = storage.bucket(metadata.bucket!).file(metadata.name!, { generation: metadata.generation });
  const [bytes] = await pinned.download({ start: 0, end: 63, validation: false });
  if (!matchesMagic(mime, bytes)) return null;
  const confirmedPath = `${path}-confirmed-${randomUUID()}`;
  await pinned.copy(assetFile(confirmedPath));
  return confirmedPath;
}
