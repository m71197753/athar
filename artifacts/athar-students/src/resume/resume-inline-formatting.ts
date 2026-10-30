import type { StudentResumeContent } from "@workspace/api-client-react";

export type ResumeInlineStyleRange = NonNullable<StudentResumeContent["inlineStyles"]>[number];
export type ResumeInlineStylePatch = Partial<Pick<
  ResumeInlineStyleRange,
  "bold" | "italic" | "underline" | "color" | "fontSize"
>>;
export type ResumeInlineStyle = Omit<ResumeInlineStyleRange, "field" | "start" | "end">;

const styleKeys = ["bold", "italic", "underline", "color", "fontSize"] as const;

function sameStyle(first: ResumeInlineStyle, second: ResumeInlineStyle) {
  return styleKeys.every(key => first[key] === second[key]);
}

function makeRange(field: string, start: number, end: number, style: ResumeInlineStyle): ResumeInlineStyleRange | null {
  if (end <= start || !styleKeys.some(key => style[key] !== undefined && style[key] !== false)) return null;
  return { field, start, end, ...style };
}

export function getResumeTextSegments(
  text: string,
  field: string,
  ranges: ResumeInlineStyleRange[] = [],
): { text: string; style: ResumeInlineStyle }[] {
  if (!text) return [];
  const relevant = ranges.filter(range => range.field === field && range.start < text.length && range.end > 0);
  const boundaries = [...new Set([0, text.length, ...relevant.flatMap(range => [
    Math.max(0, Math.min(text.length, range.start)),
    Math.max(0, Math.min(text.length, range.end)),
  ])])].sort((a, b) => a - b);
  const segments: { text: string; style: ResumeInlineStyle }[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end <= start) continue;
    const style: ResumeInlineStyle = {};
    for (const range of relevant) {
      if (range.start <= start && range.end >= end) {
        for (const key of styleKeys) {
          if (range[key] !== undefined) style[key] = range[key] as never;
        }
      }
    }
    const previous = segments.at(-1);
    if (previous && sameStyle(previous.style, style)) previous.text += text.slice(start, end);
    else segments.push({ text: text.slice(start, end), style });
  }
  return segments;
}

export function applyResumeInlineStyle(
  ranges: ResumeInlineStyleRange[] = [],
  field: string,
  start: number,
  end: number,
  patch: ResumeInlineStylePatch,
): ResumeInlineStyleRange[] {
  if (end <= start) return ranges;
  const otherFields = ranges.filter(range => range.field !== field);
  const relevant = ranges.filter(range => range.field === field && range.end > start && range.start < end);
  const boundaries = [...new Set([
    start,
    end,
    ...relevant.flatMap(range => [range.start, range.end]),
  ])].sort((a, b) => a - b);
  const updated: ResumeInlineStyleRange[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const segmentStart = boundaries[index];
    const segmentEnd = boundaries[index + 1];
    if (segmentEnd <= segmentStart) continue;
    const style: ResumeInlineStyle = {};
    for (const range of ranges) {
      if (range.field === field && range.start <= segmentStart && range.end >= segmentEnd) {
        for (const key of styleKeys) {
          if (range[key] !== undefined) style[key] = range[key] as never;
        }
      }
    }
    if (segmentStart >= start && segmentEnd <= end) {
      for (const key of styleKeys) {
        const value = patch[key];
        if (value === undefined) continue;
        if (value === false || value === null) delete style[key];
        else style[key] = value as never;
      }
    }
    const next = makeRange(field, segmentStart, segmentEnd, style);
    if (!next) continue;
    const previous = updated.at(-1);
    if (previous && previous.end === next.start && sameStyle(
      Object.fromEntries(styleKeys.map(key => [key, previous[key]])) as ResumeInlineStyle,
      Object.fromEntries(styleKeys.map(key => [key, next[key]])) as ResumeInlineStyle,
    )) previous.end = next.end;
    else updated.push(next);
  }
  const untouched = ranges.filter(range => range.field === field && (range.end <= start || range.start >= end));
  return [...otherFields, ...untouched, ...updated].sort((a, b) =>
    a.field.localeCompare(b.field) || a.start - b.start || a.end - b.end);
}

export function hasResumeInlineStyle(
  ranges: ResumeInlineStyleRange[] = [],
  field: string,
  start: number,
  end: number,
  key: "bold" | "italic" | "underline",
): boolean {
  if (end <= start) return false;
  const boundaries = [...new Set([
    start,
    end,
    ...ranges.filter(range => range.field === field && range.end > start && range.start < end)
      .flatMap(range => [Math.max(start, range.start), Math.min(end, range.end)]),
  ])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).every((segmentStart, index) => {
    const segmentEnd = boundaries[index + 1];
    return ranges.some(range => range.field === field && range.start <= segmentStart && range.end >= segmentEnd && range[key] === true);
  });
}

export function getResumeInlineStyleForSelection(
  ranges: ResumeInlineStyleRange[] = [],
  field: string,
  start: number,
  end: number,
): ResumeInlineStyle {
  if (end <= start) return {};
  const relevant = ranges.filter(range => range.field === field && range.end > start && range.start < end);
  const boundaries = [...new Set([
    start,
    end,
    ...relevant.flatMap(range => [Math.max(start, range.start), Math.min(end, range.end)]),
  ])].sort((a, b) => a - b);
  const styles = boundaries.slice(0, -1).map((segmentStart, index) => {
    const segmentEnd = boundaries[index + 1];
    const style: ResumeInlineStyle = {};
    for (const range of relevant) {
      if (range.start <= segmentStart && range.end >= segmentEnd) {
        for (const key of styleKeys) {
          if (range[key] !== undefined) style[key] = range[key] as never;
        }
      }
    }
    return style;
  });
  const common: ResumeInlineStyle = {};
  for (const key of styleKeys) {
    const first = styles[0]?.[key];
    if (first !== undefined && styles.every(style => style[key] === first)) common[key] = first as never;
  }
  return common;
}

export function updateResumeInlineStylesAfterTextChange(
  ranges: ResumeInlineStyleRange[] = [],
  field: string,
  previousText: string,
  nextText: string,
): ResumeInlineStyleRange[] {
  if (previousText === nextText) return ranges;
  let prefix = 0;
  while (prefix < previousText.length && prefix < nextText.length && previousText[prefix] === nextText[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < previousText.length - prefix &&
    suffix < nextText.length - prefix &&
    previousText[previousText.length - 1 - suffix] === nextText[nextText.length - 1 - suffix]
  ) suffix++;
  const oldEnd = previousText.length - suffix;
  const newEnd = nextText.length - suffix;
  const delta = newEnd - oldEnd;
  const result: ResumeInlineStyleRange[] = [];
  for (const range of ranges) {
    if (range.field !== field) {
      result.push(range);
      continue;
    }
    if (range.end <= prefix) {
      result.push(range);
      continue;
    }
    if (range.start >= oldEnd) {
      const start = range.start + delta;
      const end = range.end + delta;
      if (end > start) result.push({ ...range, start, end });
      continue;
    }
    if (range.start <= prefix && range.end >= oldEnd) {
      const end = Math.min(nextText.length, range.end + delta);
      if (end > range.start) result.push({ ...range, end });
      continue;
    }
    if (range.start < prefix) result.push({ ...range, end: prefix });
    if (range.end > oldEnd) {
      const start = Math.max(range.start, oldEnd) + delta;
      const end = range.end + delta;
      if (end > start) result.push({ ...range, start, end });
    }
  }
  return result;
}

export function removeResumeInlineStylesForArrayIndex(
  ranges: ResumeInlineStyleRange[] = [],
  section: string,
  removedIndex: number,
): ResumeInlineStyleRange[] {
  return ranges.flatMap(range => {
    const match = range.field.match(new RegExp(`^${section}\\.(\\d+)(\\..*)?$`));
    if (!match) return [range];
    const index = Number(match[1]);
    if (index === removedIndex) return [];
    if (index < removedIndex) return [range];
    return [{ ...range, field: `${section}.${index - 1}${match[2] ?? ""}` }];
  });
}

export function moveResumeInlineStylesForArrayIndex(
  ranges: ResumeInlineStyleRange[] = [],
  section: string,
  fromIndex: number,
  toIndex: number,
): ResumeInlineStyleRange[] {
  if (fromIndex === toIndex) return ranges;
  return ranges.map(range => {
    const match = range.field.match(new RegExp(`^${section}\\.(\\d+)(\\..*)?$`));
    if (!match) return range;
    const index = Number(match[1]);
    let nextIndex = index;
    if (index === fromIndex) nextIndex = toIndex;
    else if (fromIndex < toIndex && index > fromIndex && index <= toIndex) nextIndex = index - 1;
    else if (fromIndex > toIndex && index >= toIndex && index < fromIndex) nextIndex = index + 1;
    return nextIndex === index ? range : { ...range, field: `${section}.${nextIndex}${match[2] ?? ""}` };
  });
}
