import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import {
  isAcademyVideoMime,
  MAX_ACADEMY_FILE_BYTES,
  MAX_ACADEMY_VIDEO_BYTES,
  type AcademyUploadMime,
} from "./academy-content";
import { assetFile } from "./ad-storage";

const sidecar = "http://127.0.0.1:1106";
const storage = new Storage({
  projectId: "",
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${sidecar}/token`,
    type: "external_account",
    credential_source: {
      url: `${sidecar}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
});

export async function createAcademyUpload(): Promise<{ objectPath: string; uploadUrl: string }> {
  const base = process.env.PRIVATE_OBJECT_DIR;
  if (!base) throw new Error("App Storage is not configured");
  const objectPath = `${base.replace(/\/$/, "")}/academy/${randomUUID()}`;
  const parts = objectPath.replace(/^\/+/, "").split("/");
  const bucketName = parts.shift()!;
  const response = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: parts.join("/"),
      method: "PUT",
      expires_at: new Date(Date.now() + 900_000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Could not create an academy upload URL");
  const { signed_url } = (await response.json()) as { signed_url: string };
  return { objectPath, uploadUrl: String(signed_url) };
}

export async function validateAcademyUpload(
  path: string,
  mime: AcademyUploadMime,
  expectedSize: number,
): Promise<string | null> {
  const maxSize = isAcademyVideoMime(mime) ? MAX_ACADEMY_VIDEO_BYTES : MAX_ACADEMY_FILE_BYTES;
  if (expectedSize < 1 || expectedSize > maxSize) return null;
  const file = assetFile(path);
  const [metadata] = await file.getMetadata();
  if (
    Number(metadata.size) !== expectedSize ||
    metadata.contentType?.split(";")[0] !== mime ||
    !metadata.generation
  ) return null;

  const pinned = storage.bucket(metadata.bucket!).file(metadata.name!, {
    generation: metadata.generation,
  });
  const [header] = await pinned.download({ start: 0, end: 15, validation: false });
  const valid =
    (mime === "application/pdf" && header.subarray(0, 5).toString("ascii") === "%PDF-") ||
    (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) ||
    (mime === "text/plain" && header.length > 0 && !header.includes(0)) ||
    (mime === "image/jpeg" && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) ||
    (mime === "image/png" && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (mime === "image/webp" &&
      header.subarray(0, 4).toString("ascii") === "RIFF" &&
      header.subarray(8, 12).toString("ascii") === "WEBP") ||
    (mime === "video/mp4" && header.subarray(4, 8).toString("ascii") === "ftyp") ||
    (mime === "video/webm" && header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])));
  if (!valid) return null;

  // Signed URLs remain usable until expiry, so pin the verified generation at a fresh key.
  const confirmedPath = `${path}-confirmed-${randomUUID()}`;
  await pinned.copy(assetFile(confirmedPath));
  await file.delete({ ignoreNotFound: true });
  return confirmedPath;
}

export async function readAcademyAsset(path: string): Promise<Buffer> {
  const [bytes] = await assetFile(path).download();
  return bytes;
}

export function streamAcademyAsset(path: string, range?: { start: number; end: number }) {
  return assetFile(path).createReadStream(range);
}

export async function deleteAcademyAsset(path: string): Promise<void> {
  await assetFile(path).delete({ ignoreNotFound: true });
}
