import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { zipSync, strToU8 } from "fflate";

const code = buildSync({
  stdin: {
    contents: "export * from './src/lib/academy-library-formats'; export * from './src/lib/academy-office-text'; export {RequestAcademyFileUploadBody} from '@workspace/api-zod';",
    resolveDir: fileURLToPath(new URL("../", import.meta.url)),
  },
  bundle: true, platform: "node", format: "cjs", write: false,
}).outputFiles[0].text;
const module = { exports: {} };
new Function("module", "exports", "require", code)(module, module.exports, createRequire(import.meta.url));
const { academyLibraryExtraMimes: types, validAcademyExtraHeader, extractAcademyOfficeText, RequestAcademyFileUploadBody } = module.exports;
const archive = files => Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([path, xml]) => [path, strToU8(xml)]))));

test("PowerPoint extracts Arabic, rich text, XML entities and slide text", () => {
  const bytes = archive({
    "ppt/slides/slide1.xml": '<p:sld xmlns:p="p" xmlns:a="a"><a:t>شرح المحاضرة الأولى</a:t><a:t xml:space="preserve">حقوق &amp; واجبات</a:t></p:sld>',
    "ppt/slides/slide2.xml": '<p:sld xmlns:p="p" xmlns:a="a"><a:t>الملخص والتطبيقات</a:t></p:sld>',
  });
  const text = extractAcademyOfficeText(bytes, types.pptx);
  assert.match(text, /شرح المحاضرة الأولى/);
  assert.match(text, /حقوق & واجبات/);
  assert.match(text, /الملخص والتطبيقات/);
  assert.equal(validAcademyExtraHeader(bytes.subarray(0, 16), types.pptx), true);
});

test("Excel reads shared strings, numbers, and inline strings", () => {
  const bytes = archive({
    "xl/sharedStrings.xml": '<sst><si><t>المقرر</t></si><si><r><t>الرياضيات</t></r></si></sst>',
    "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c><c><v>98</v></c><c t="inlineStr"><is><t>ممتاز</t></is></c></row></sheetData></worksheet>',
  });
  const text = extractAcademyOfficeText(bytes, types.xlsx);
  assert.match(text, /المقرر\tالرياضيات\t98\tممتاز/);
});

test("Office extraction rejects expansion bombs and XML entities", () => {
  const entity = archive({ "ppt/slides/slide1.xml": '<!DOCTYPE x [<!ENTITY x "bad">]><sld><t>&x;</t></sld>' });
  assert.throws(() => extractAcademyOfficeText(entity, types.pptx), /entities/);
  const large = archive({ "ppt/slides/slide1.xml": " ".repeat(4 * 1024 * 1024 + 1) });
  assert.throws(() => extractAcademyOfficeText(large, types.pptx), /budget/);
});

test("Signatures reject renamed executable attachments", () => {
  const fake = Buffer.alloc(16);
  fake.write("MZ");
  for (const mime of Object.values(types)) assert.equal(validAcademyExtraHeader(fake, mime), false, mime);
  assert.equal(types.exe, undefined);
  assert.equal(validAcademyExtraHeader(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), types.ppt), true);
  assert.equal(validAcademyExtraHeader(Buffer.from("ID3audio data"), types.mp3), true);
  assert.equal(validAcademyExtraHeader(Buffer.from("RIFF0000WAVEdata"), types.wav), true);
  assert.equal(validAcademyExtraHeader(Buffer.from("OggSaudio data"), types.ogg), true);
});

test("Upload contract accepts presentations and large attachments, not executable MIME", () => {
  for (const mime of Object.values(types)) {
    assert.equal(RequestAcademyFileUploadBody.safeParse({ originalName: "lecture", mime, size: 3 * 1024 ** 3 }).success, true, mime);
  }
  assert.equal(RequestAcademyFileUploadBody.safeParse({ originalName: "run.exe", mime: "application/x-msdownload", size: 100 }).success, false);
});
