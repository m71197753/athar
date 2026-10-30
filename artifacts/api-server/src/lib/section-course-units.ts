type CourseOutline = {
  units?: Array<{ id: string; title: string; description: string }>;
  materials: Array<{ unitId?: string }>;
};

/** Unit membership is metadata over the canonical lesson list, not a second copy of content. */
export function validCourseUnits(course: CourseOutline): boolean {
  const units = course.units ?? [];
  if (units.length > 20) return false;
  const ids = new Set<string>();
  for (const unit of units) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(unit.id) ||
      ids.has(unit.id) || unit.title.trim().length < 2 || unit.title.trim().length > 120 ||
      unit.description.trim().length > 600) return false;
    ids.add(unit.id);
  }
  return course.materials.every(material => material.unitId === undefined || ids.has(material.unitId));
}
