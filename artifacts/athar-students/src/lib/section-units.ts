import type { SectionBlock, SectionCourse, SectionCourseUnit } from "@workspace/api-client-react";

export type IndexedLesson = { block: SectionBlock; index: number };
export type UnitGroup = { unit: SectionCourseUnit; lessons: IndexedLesson[] };

/** Groups the canonical flat materials array by unit, preserving array order. Unknown/missing unitId is treated as ungrouped. */
export function groupCourseMaterials(course: Pick<SectionCourse, "units" | "materials">) {
  const units = course.units ?? [];
  const known = new Set(units.map(unit => unit.id));
  const groups: UnitGroup[] = units.map(unit => ({
    unit,
    lessons: course.materials.map((block, index) => ({ block, index })).filter(({ block }) => block.unitId === unit.id),
  }));
  const loose = course.materials.map((block, index) => ({ block, index })).filter(({ block }) => !block.unitId || !known.has(block.unitId));
  return { groups, loose };
}

const mediaIdPattern = /^\/api\/platform\/section-media\/([a-f0-9-]{36})$/i;
/** Admin-only protected alias for rendering unpublished media in preview. Never saved. */
export const adminPreviewMediaUrl = (url: string) => {
  const id = mediaIdPattern.exec(url)?.[1];
  return id ? `/api/admin/section-media/${id}/preview` : "";
};

export function safeSectionLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
