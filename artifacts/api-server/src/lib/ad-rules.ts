import { CreateAdminAdBody, GetAdStatisticsQueryParams } from "@workspace/api-zod";
import type { AdInput } from "@workspace/api-zod";

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
export function isMediaUrl(value: string) {
  return /^\/api\/ads\/media\/[a-f0-9-]{36}$/.test(value) || isHttpUrl(value);
}
export function parseStatisticsDays(value: unknown) {
  return GetAdStatisticsQueryParams.safeParse({
    days: value === undefined ? undefined : typeof value === "string" ? Number(value) : null,
  });
}
export function validateAd(value: unknown): { data?: AdInput; error?: string } {
  const parsed = CreateAdminAdBody.safeParse(value);
  if (!parsed.success) return { error: "Invalid ad fields, dates or placement dimensions" };
  const data = parsed.data;
  if (!data.title.trim() || !data.cta.trim()) return { error: "Title and action label cannot be blank" };
  if (data.destination && !isHttpUrl(data.destination)) return { error: "Destination must be an HTTP(S) URL without credentials" };
  if (["image_link", "video_link", "image_code"].includes(data.format) && !isMediaUrl(data.mediaUrl)) return { error: "This format requires an uploaded asset or an HTTP(S) media URL" };
  if (["image_link", "video_link", "text_link"].includes(data.format) && !data.destination) return { error: "This format requires a destination link" };
  if (["code", "image_code"].includes(data.format) && !data.code.trim()) return { error: "This format requires HTML/code" };
  if (new Set(data.placements.map(item => `${item.page}:${item.slot}`)).size !== data.placements.length) return { error: "Choose each page and slot only once" };
  if (data.startsAt && data.endsAt && data.endsAt.getTime() <= data.startsAt.getTime()) return { error: "End time must be after start time" };
  return { data: { ...data, title: data.title.trim(), cta: data.cta.trim() } };
}
export function matchesMagic(mime: string, bytes: Buffer) {
  switch (mime) {
    case "image/jpeg": return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    case "image/png": return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    case "image/gif": return ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString());
    case "image/webp": return bytes.subarray(0,4).toString() === "RIFF" && bytes.subarray(8,12).toString() === "WEBP";
    case "video/mp4": return bytes.subarray(4,8).toString() === "ftyp";
    case "video/webm": return bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]));
    case "audio/mpeg": return bytes.subarray(0,3).toString() === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case "audio/mp4": return bytes.subarray(4,8).toString() === "ftyp";
    case "audio/wav": return bytes.subarray(0,4).toString() === "RIFF" && bytes.subarray(8,12).toString() === "WAVE";
    case "audio/ogg": return bytes.subarray(0,4).toString() === "OggS";
    case "audio/webm": return bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]));
    case "application/pdf": return bytes.subarray(0,5).toString("ascii") === "%PDF-";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return bytes.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04]));
    case "text/plain": return bytes.length > 0 && !bytes.includes(0);
    default: return false;
  }
}
