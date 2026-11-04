import { useState } from "react";
import { ArrowDown, ArrowUp, FolderOpen, Inbox, Plus, Trash2 } from "lucide-react";
import type { SectionBlock, SectionCourse, SectionCourseUnit } from "@workspace/api-client-react";
import { SectionContentBlockEditor } from "./SectionContentBlockEditor";
import { RequiredMark } from "../components/RequiredMark";
import { groupCourseMaterials, type IndexedLesson } from "../lib/section-units";
import { MAX_COURSE_MATERIALS, MAX_COURSE_UNITS } from "../lib/course-limits";
import "./section-builder.css";

const emptyLesson = (unitId?: string): SectionBlock => ({ type: "text", title: "", body: "", url: "", ...(unitId ? { unitId } : {}) });

export function CourseUnitsEditor({ course, onChange }: { course: SectionCourse; onChange: (patch: Partial<SectionCourse>) => void }) {
  const [notice, setNotice] = useState("");
  const units = course.units ?? [];
  const { groups, loose } = groupCourseMaterials(course);
  const full = course.materials.length >= MAX_COURSE_MATERIALS;

  const setUnits = (next: SectionCourseUnit[]) => onChange({ units: next });
  const patchUnit = (id: string, patch: Partial<SectionCourseUnit>) => setUnits(units.map(u => u.id === id ? { ...u, ...patch } : u));
  const moveUnit = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= units.length) return;
    const next = [...units]; [next[i], next[j]] = [next[j], next[i]]; setUnits(next);
  };
  const removeUnit = (unit: SectionCourseUnit) => {
    const kept = course.materials.filter(m => m.unitId === unit.id).length;
    onChange({
      units: units.filter(u => u.id !== unit.id),
      materials: course.materials.map(m => {
        if (m.unitId !== unit.id) return m;
        const { unitId: _drop, ...rest } = m; void _drop; return rest;
      }),
    });
    setNotice(`حُذفت الوحدة «${unit.title || "بلا عنوان"}» وبقيت دروسها (${kept.toLocaleString("ar")}) ضمن «دروس بدون وحدة».`);
  };
  const addUnit = () => { setNotice(""); setUnits([...units, { id: crypto.randomUUID(), title: "", description: "" }]); };
  const setMaterial = (index: number, patch: Partial<SectionBlock>) => onChange({ materials: course.materials.map((m, i) => i === index ? { ...m, ...patch } : m) });
  const assign = (index: number, unitId: string) => onChange({
    materials: course.materials.map((m, i) => {
      if (i !== index) return m;
      const { unitId: _old, ...rest } = m; void _old;
      return unitId ? { ...rest, unitId } : rest;
    }),
  });
  const batch = (index: number, blocks: SectionBlock[]) => {
    const unitId = course.materials[index]?.unitId;
    const tagged = blocks.map(b => { const { unitId: _u, ...rest } = b; void _u; return unitId ? { ...rest, unitId } : rest; });
    onChange({ materials: [...course.materials.slice(0, index), ...tagged, ...course.materials.slice(index + 1)] });
  };
  const moveInGroup = (lessons: IndexedLesson[], pos: number, d: -1 | 1) => {
    const other = lessons[pos + d]; if (!other) return;
    const a = lessons[pos].index, b = other.index;
    const next = [...course.materials]; [next[a], next[b]] = [next[b], next[a]];
    onChange({ materials: next });
  };
  const addLesson = (unitId?: string) => { if (!full) onChange({ materials: [...course.materials, emptyLesson(unitId)] }); };
  const removeLesson = (index: number) => onChange({ materials: course.materials.filter((_, i) => i !== index) });

  const renderLessons = (lessons: IndexedLesson[], groupKey: string) => lessons.length === 0
    ? <p className="sb-empty-group">لا توجد دروس هنا بعد. أضف درسًا أو انقل درسًا من مكان آخر.</p>
    : <div className="adm-section-block-list">{lessons.map(({ block, index }, pos) => <article className="adm-section-block adm-course-material sb-lesson" key={`${course.id}-${index}`}>
      <div className="adm-section-block-top"><b>درس {pos + 1}</b><div className="adm-section-block-tools">
        <label className="sb-assign"><span className="sr-only">نقل الدرس إلى وحدة</span>
          <select value={block.unitId && units.some(u => u.id === block.unitId) ? block.unitId : ""} onChange={e => assign(index, e.target.value)} data-testid={`select-lesson-unit-${course.id}-${index}`}>
            <option value="">بدون وحدة</option>
            {units.map((u, i) => <option key={u.id} value={u.id}>{u.title || `وحدة ${i + 1}`}</option>)}
          </select>
        </label>
        <button type="button" className="icon-button" aria-label={`تحريك الدرس ${pos + 1} لأعلى`} data-testid={`button-course-material-up-${course.id}-${index}`} disabled={pos === 0} onClick={() => moveInGroup(lessons, pos, -1)}><ArrowUp size={15}/></button>
        <button type="button" className="icon-button" aria-label={`تحريك الدرس ${pos + 1} لأسفل`} data-testid={`button-course-material-down-${course.id}-${index}`} disabled={pos === lessons.length - 1} onClick={() => moveInGroup(lessons, pos, 1)}><ArrowDown size={15}/></button>
        {course.materials.length > 1 && <button type="button" className="icon-button danger-icon" aria-label={`حذف الدرس ${pos + 1}`} data-testid={`button-course-material-remove-${course.id}-${index}`} onClick={() => removeLesson(index)}><Trash2 size={15}/></button>}
      </div></div>
      <SectionContentBlockEditor
        block={block}
        name={`course-${course.id}-material-kind-${index}-${groupKey}`}
        testIdPrefix={`course-${course.id}-material-${index}`}
        maxBatchFileCount={MAX_COURSE_MATERIALS + 1 - course.materials.length}
        onChange={patch => setMaterial(index, patch)}
        onUploadMany={blocks => batch(index, blocks)}
      />
    </article>)}</div>;

  return <div className="sb-units">
    <div className="adm-section-block-heading"><div><h5>الوحدات والدروس</h5><p>نظّم الدروس في وحدات مرتبة. الحد الأقصى {MAX_COURSE_UNITS.toLocaleString("ar")} وحدة و{MAX_COURSE_MATERIALS.toLocaleString("ar")} درسًا لكل دورة ({course.materials.length.toLocaleString("ar")}/{MAX_COURSE_MATERIALS.toLocaleString("ar")}).</p></div>
      <button type="button" className="button button-outline button-compact" disabled={units.length >= MAX_COURSE_UNITS} onClick={addUnit} data-testid={`button-add-unit-${course.id}`}><Plus size={14}/> إضافة وحدة</button>
    </div>
    {notice && <p className="sb-notice" role="status">{notice} <button type="button" onClick={() => setNotice("")}>حسنًا</button></p>}
    {groups.map(({ unit, lessons }, i) => <section className="sb-unit" key={unit.id} data-testid={`admin-unit-${unit.id}`}>
      <header className="sb-unit-head">
        <span className="sb-unit-index"><FolderOpen size={15}/> الوحدة {(i + 1).toLocaleString("ar")}</span>
        <div className="adm-section-block-tools">
          <button type="button" className="icon-button" aria-label={`تحريك الوحدة ${i + 1} لأعلى`} disabled={i === 0} onClick={() => moveUnit(i, -1)} data-testid={`button-unit-up-${unit.id}`}><ArrowUp size={15}/></button>
          <button type="button" className="icon-button" aria-label={`تحريك الوحدة ${i + 1} لأسفل`} disabled={i === units.length - 1} onClick={() => moveUnit(i, 1)} data-testid={`button-unit-down-${unit.id}`}><ArrowDown size={15}/></button>
          <button type="button" className="icon-button danger-icon" aria-label={`حذف الوحدة ${i + 1} مع إبقاء دروسها`} onClick={() => removeUnit(unit)} data-testid={`button-unit-remove-${unit.id}`}><Trash2 size={15}/></button>
        </div>
      </header>
      <div className="adm-section-meta-fields">
        <label className="adm-field"><span>عنوان الوحدة <RequiredMark/></span><input required minLength={2} maxLength={120} value={unit.title} onChange={e => patchUnit(unit.id, { title: e.target.value })} data-testid={`input-unit-title-${unit.id}`}/></label>
        <label className="adm-field"><span>وصف الوحدة</span><textarea rows={2} maxLength={600} value={unit.description} onChange={e => patchUnit(unit.id, { description: e.target.value })} data-testid={`input-unit-description-${unit.id}`}/></label>
      </div>
      {renderLessons(lessons, unit.id)}
      <button type="button" className="sb-add-lesson" disabled={full} onClick={() => addLesson(unit.id)} data-testid={`button-unit-add-lesson-${unit.id}`}><Plus size={14}/> درس في هذه الوحدة</button>
    </section>)}
    {(loose.length > 0 || units.length === 0) && <section className="sb-unit sb-unit-loose" data-testid={`admin-loose-lessons-${course.id}`}>
      <header className="sb-unit-head"><span className="sb-unit-index"><Inbox size={15}/> {units.length ? "دروس بدون وحدة" : "دروس الدورة"}</span></header>
      {renderLessons(loose, "loose")}
      <button type="button" className="sb-add-lesson" disabled={full} onClick={() => addLesson()} data-testid={`button-course-add-material-${course.id}`}><Plus size={14}/> إضافة درس</button>
    </section>}
  </div>;
}
