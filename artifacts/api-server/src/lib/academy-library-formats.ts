export const academyLibraryExtraMimes = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  ppt: "application/vnd.ms-powerpoint",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
} as const;

export type AcademyLibraryExtraMime = typeof academyLibraryExtraMimes[keyof typeof academyLibraryExtraMimes];
export type AcademyOfficeMime =
  | typeof academyLibraryExtraMimes.pptx
  | typeof academyLibraryExtraMimes.xlsx;

export function isAcademyOfficeMime(mime: string): mime is AcademyOfficeMime {
  return mime === academyLibraryExtraMimes.pptx || mime === academyLibraryExtraMimes.xlsx;
}

/** Check signatures as well as the declared extension/MIME. Never execute attachments. */
export function validAcademyExtraHeader(header: Buffer, mime: string): boolean {
  if (isAcademyOfficeMime(mime)) {
    return header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  }
  if (["application/msword", "application/vnd.ms-powerpoint", "application/vnd.ms-excel"].includes(mime)) {
    return header.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (mime === "text/csv") return header.length > 0 && !header.includes(0);
  if (mime === "audio/mpeg") {
    return header.subarray(0, 3).toString("ascii") === "ID3" ||
      (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
  }
  if (mime === "audio/mp4") return header.subarray(4, 8).toString("ascii") === "ftyp";
  if (mime === "audio/wav") {
    return header.subarray(0, 4).toString("ascii") === "RIFF" &&
      header.subarray(8, 12).toString("ascii") === "WAVE";
  }
  if (mime === "audio/ogg") return header.subarray(0, 4).toString("ascii") === "OggS";
  return false;
}
