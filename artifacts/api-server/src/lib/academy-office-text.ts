import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { academyLibraryExtraMimes, type AcademyOfficeMime } from "./academy-library-formats";

const MAX_XML_BYTES = 12 * 1024 * 1024;
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false });
function parseXml(bytes: Uint8Array): unknown {
  const xml = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML entities are not allowed");
  return parser.parse(xml);
}
function texts(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(texts);
  const textValue = (value: unknown): string[] => {
    if (typeof value === "string" || typeof value === "number") return [String(value)];
    if (Array.isArray(value)) return value.flatMap(textValue);
    if (value && typeof value === "object" && "#text" in value) return textValue(value["#text"]);
    return [];
  };
  return Object.entries(node).flatMap(([key, value]) => key === "t" ? textValue(value) : texts(value));
}
const array = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];

export function extractAcademyOfficeText(bytes: Buffer, mime: AcademyOfficeMime): string {
  let total = 0, count = 0;
  const archive = unzipSync(bytes, { filter: entry => {
    if (++count > 2000) throw new Error("Too many archive entries");
    const selected = mime === academyLibraryExtraMimes.pptx
      ? /^ppt\/slides\/slide\d+\.xml$/.test(entry.name)
      : /^xl\/(?:sharedStrings|worksheets\/sheet\d+)\.xml$/.test(entry.name);
    if (!selected) return false;
    total += entry.originalSize;
    if (entry.originalSize > 4 * 1024 * 1024 || total > MAX_XML_BYTES) {
      throw new Error("Office XML exceeds the safe processing budget");
    }
    return true;
  } });
  const entries = Object.entries(archive).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
  if (mime === academyLibraryExtraMimes.pptx) {
    return entries.map(([, xml]) => texts(parseXml(xml)).join("\n")).join("\n\n");
  }
  // Spreadsheet shared strings and inline strings, including rich-text cells.
  const sharedXml = archive["xl/sharedStrings.xml"];
  const sharedRoot = sharedXml ? parseXml(sharedXml) as { sst?: { si?: unknown | unknown[] } } : {};
  const shared = array(sharedRoot.sst?.si).map(node => texts(node).join(""));
  const lines: string[] = [];
  for (const [name, xml] of entries) {
    if (!name.startsWith("xl/worksheets/")) continue;
    type Cell = { "@_t"?: string; v?: string; is?: unknown };
    const root = parseXml(xml) as { worksheet?: { sheetData?: { row?: { c?: Cell | Cell[] } | { c?: Cell | Cell[] }[] } } };
    for (const row of array(root.worksheet?.sheetData?.row)) {
      const values = array(row.c).map(cell => cell["@_t"] === "s"
        ? shared[Number(cell.v)] ?? ""
        : cell["@_t"] === "inlineStr" ? texts(cell.is).join("") : String(cell.v ?? ""));
      lines.push(values.join("\t"));
    }
  }
  return lines.join("\n");
}
