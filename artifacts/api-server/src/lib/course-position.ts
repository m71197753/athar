import type { SectionBlock } from "@workspace/api-zod";

// Keep matching consistent with the browser; regression tests exercise both.
export function resolveCourseLesson(blocks: SectionBlock[], saved: SectionBlock): number {
  const sameSource = (block: SectionBlock) => block.type === saved.type &&
    block.mediaType === saved.mediaType && block.url === saved.url;
  if (saved.id) {
    const matches = blocks.flatMap((block, i) => block.id === saved.id ? [i] : []);
    return matches.length === 1 ? matches[0] : -1;
  }
  const exact = blocks.flatMap((block, i) => sameSource(block) && block.title === saved.title && block.body === saved.body ? [i] : []);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1 || saved.type === "text" || !saved.url) return -1;
  const sources = blocks.flatMap((block, i) => sameSource(block) ? [i] : []);
  return sources.length === 1 ? sources[0] : -1;
}
