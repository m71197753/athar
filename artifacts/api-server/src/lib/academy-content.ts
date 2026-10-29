import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const MAX_ACADEMY_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ACADEMY_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_ACADEMY_EXTRACTED_CHARS = 250_000;
const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 180;

export type AcademyMime =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain";
export type AcademyImageMime = "image/jpeg" | "image/png" | "image/webp";
export type AcademyStudentFileMime = AcademyMime | AcademyImageMime;
export type AcademyVideoMime = "video/mp4" | "video/webm";
export type AcademyCourseUploadMime = AcademyMime | AcademyVideoMime;
export type AcademyUploadMime = AcademyStudentFileMime | AcademyVideoMime;

export function isAcademyVideoMime(mime: string): mime is AcademyVideoMime {
  return mime === "video/mp4" || mime === "video/webm";
}

export function isAcademyImageMime(mime: string): mime is AcademyImageMime {
  return mime === "image/jpeg" || mime === "image/png" || mime === "image/webp";
}

export function supportedAcademyDocument(name: string, mime: string): mime is AcademyMime {
  const extension = name.toLowerCase().split(".").at(-1);
  return (
    (extension === "pdf" && mime === "application/pdf") ||
    (extension === "docx" &&
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
    (extension === "txt" && mime === "text/plain")
  );
}

export function supportedAcademyFile(name: string, mime: string): mime is AcademyStudentFileMime {
  const extension = name.toLowerCase().split(".").at(-1);
  return supportedAcademyDocument(name, mime) ||
    ((extension === "jpg" || extension === "jpeg") && mime === "image/jpeg") ||
    (extension === "png" && mime === "image/png") ||
    (extension === "webp" && mime === "image/webp");
}

export function supportedAcademyCourseUpload(
  name: string,
  mime: string,
): mime is AcademyCourseUploadMime {
  const extension = name.toLowerCase().split(".").at(-1);
  return supportedAcademyDocument(name, mime) ||
    (extension === "mp4" && mime === "video/mp4") ||
    (extension === "webm" && mime === "video/webm");
}

export async function extractAcademyText(bytes: Buffer, mime: AcademyMime): Promise<string> {
  let text: string;
  if (mime === "application/pdf") {
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }
  } else if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer: bytes });
    text = result.value;
  } else {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\u0000")) throw new Error("Text file contains binary data");
  }

  const cleaned = text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  if (cleaned.length < 20) throw new Error("The document does not contain enough readable text");
  if (cleaned.length > MAX_ACADEMY_EXTRACTED_CHARS) {
    throw new Error("The extracted text is too large to index safely");
  }
  return cleaned;
}

export function normalizeAcademyText(input: string): string {
  return input
    .normalize("NFKC")
    .toLocaleLowerCase("ar")
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function chunkAcademyText(input: string): string[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < 500) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start + CHUNK_SIZE * 0.65) end = boundary;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

export function academySearchTerms(query: string): string[] {
  return [...new Set(normalizeAcademyText(query).split(" ").filter((word) => word.length >= 2))].slice(0, 8);
}

export function academyExcerpt(content: string, terms: string[], maxLength = 420): string {
  const normalized = normalizeAcademyText(content);
  const firstMatch = terms
    .map((term) => normalized.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  let sourceStart = 0;
  if (firstMatch !== undefined) {
    let left = 0;
    let right = content.length;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (normalizeAcademyText(content.slice(0, middle)).length < firstMatch) left = middle + 1;
      else right = middle;
    }
    sourceStart = Math.max(0, left - 110);
  }
  const excerpt = content.slice(sourceStart, sourceStart + maxLength).trim();
  return `${sourceStart > 0 ? "… " : ""}${excerpt}${sourceStart + maxLength < content.length ? " …" : ""}`;
}
