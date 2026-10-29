import { useState, type CSSProperties, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, BookOpen, ExternalLink, FileText, Layers3, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import {
  getGetPlatformContentQueryKey, getListAdminSectionsQueryKey,
  useCreateAdminSection, useDeleteAdminSection, useListAdminSections, useUpdateAdminSection,
} from "@workspace/api-client-react";
import type { PlatformSection, SectionBlock, SectionCourse, SectionInput } from "@workspace/api-client-react";
import { SectionContentBlockEditor } from "./SectionContentBlockEditor";
import { RequiredMark } from "../components/RequiredMark";
import { SectionAppearanceFields } from "../components/SectionAppearanceFields";
import { getSectionAccent, getSectionIcon } from "../lib/section-appearance";

const blankSection = (): SectionInput => ({
  kind: "content_page", title: "", description: "",
  iconKey: "book", accentKey: "teal", cardStyle: "soft",
  blocks: [{ type: "text", title: "", body: "", url: "" }],
  courses: [], published: false, sortOrder: 100,
});
const sectionForm = (section: PlatformSection): SectionInput => ({
  kind: section.kind, title: section.title, description: section.description,
  iconKey: section.iconKey ?? "book", accentKey: section.accentKey ?? "teal", cardStyle: section.cardStyle ?? "soft",
  blocks: section.blocks.map(block => ({ ...block })),
  courses: (section.courses ?? []).map(course => ({ ...course, skills: course.skills ?? [], materials: course.materials.map(block => ({ ...block })) })),
  published: section.published, sortOrder: section.sortOrder,
});
const emptyBlock = (): SectionBlock => ({ type: "text", title: "", body: "", url: "" });
const newCourse = (): SectionCourse => ({ id: crypto.randomUUID(), title: "", description: "", skills: [], materials: [emptyBlock()] });
const validUrl = (value: string) => {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
};
const validMediaUrl = (value: string) => /^\/api\/platform\/section-media\/[a-f0-9-]{36}$/i.test(value);
function errorText(error: unknown) {
  if (typeof error === "object" && error && "status" in error) {
    const status = Number((error as { status: unknown }).status);
    if (status === 409) return "يوجد تعارض في بيانات هذا القسم.";
    if (status === 401 || status === 403) return "ليست لديك صلاحية لهذا الإجراء.";
    if (status === 400 || status === 422) return "راجع بيانات القسم والروابط ثم حاول مجددًا.";
  }
  return "تعذّر إكمال العملية. حاول مرة أخرى.";
}
const formatDate = (value: string) => new Date(value).toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });

export function SectionsAdminPanel({ onOpenModuleSettings }: { onOpenModuleSettings: () => void }) {
  const queryClient = useQueryClient();
  const query = useListAdminSections({ query: { queryKey: getListAdminSectionsQueryKey() } });
  const create = useCreateAdminSection();
  const update = useUpdateAdminSection();
  const remove = useDeleteAdminSection();
  const [editing, setEditing] = useState<{ id?: string; form: SectionInput } | null>(null);
  const [formError, setFormError] = useState("");
  const [rowError, setRowError] = useState("");
  const [toDelete, setToDelete] = useState<PlatformSection | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const busy = create.isPending || update.isPending;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListAdminSectionsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetPlatformContentQueryKey() });
    void queryClient.invalidateQueries({ queryKey: ["/api/admin/audit"] });
  };
  const setField = <K extends keyof SectionInput>(key: K, value: SectionInput[K]) => {
    setFormError("");
    setEditing(current => current && { ...current, form: { ...current.form, [key]: value } });
  };
  const setBlock = (index: number, patch: Partial<SectionBlock>) => {
    setFormError("");
    setEditing(current => current && ({
      ...current,
      form: { ...current.form, blocks: current.form.blocks.map((block, i) => i === index ? { ...block, ...patch } : block) },
    }));
  };
  const replaceBlocksWithBatch = (index: number, blocks: SectionBlock[]) => {
    setFormError("");
    setEditing(current => current && ({
      ...current,
      form: {
        ...current.form,
        blocks: [...current.form.blocks.slice(0, index), ...blocks, ...current.form.blocks.slice(index + 1)],
      },
    }));
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    const blocks = editing?.form.blocks;
    if (!blocks || nextIndex < 0 || nextIndex >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setField("blocks", reordered);
  };
  const setCourse = (index: number, patch: Partial<SectionCourse>) => {
    const courses = editing?.form.courses ?? [];
    setField("courses", courses.map((course, i) => i === index ? { ...course, ...patch } : course));
  };
  const moveCourse = (index: number, direction: -1 | 1) => {
    const courses = [...(editing?.form.courses ?? [])];
    const next = index + direction;
    if (next < 0 || next >= courses.length) return;
    [courses[index], courses[next]] = [courses[next], courses[index]];
    setField("courses", courses);
  };
  const setCourseMaterial = (courseIndex: number, materialIndex: number, patch: Partial<SectionBlock>) => {
    const courses = (editing?.form.courses ?? []).map((course, i) => i === courseIndex
      ? { ...course, materials: course.materials.map((block, j) => j === materialIndex ? { ...block, ...patch } : block) }
      : course);
    setField("courses", courses);
  };
  const replaceCourseMaterialWithBatch = (courseIndex: number, materialIndex: number, blocks: SectionBlock[]) => {
    setFormError("");
    setEditing(current => current && ({
      ...current,
      form: {
        ...current.form,
        courses: (current.form.courses ?? []).map((course, index) => index === courseIndex
          ? { ...course, materials: [...course.materials.slice(0, materialIndex), ...blocks, ...course.materials.slice(materialIndex + 1)] }
          : course),
      },
    }));
  };
  const moveCourseMaterial = (courseIndex: number, materialIndex: number, direction: -1 | 1) => {
    const courses = [...(editing?.form.courses ?? [])];
    const course = courses[courseIndex];
    const next = materialIndex + direction;
    if (!course || next < 0 || next >= course.materials.length) return;
    const materials = [...course.materials];
    [materials[materialIndex], materials[next]] = [materials[next], materials[materialIndex]];
    courses[courseIndex] = { ...course, materials };
    setField("courses", courses);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const form: SectionInput = {
      ...editing.form,
      title: editing.form.title.trim(),
      description: editing.form.description.trim(),
      blocks: editing.form.blocks.map(block => ({
        ...block, title: block.title.trim(), body: block.body.trim(), url: block.url.trim(),
      })),
      courses: (editing.form.courses ?? []).map(course => ({
        ...course, title: course.title.trim(), description: course.description.trim(),
        skills: [...new Set((course.skills ?? []).map(skill => skill.trim()).filter(Boolean))],
        materials: course.materials.map(block => ({ ...block, title: block.title.trim(), body: block.body.trim(), url: block.url.trim() })),
      })),
    };
    if (form.title.length < 2) return setFormError("اكتب اسمًا واضحًا للقسم.");
    if (form.blocks.length < 1 || form.blocks.length > 20) return setFormError("أضف من عنصر واحد إلى 20 عنصرًا.");
    if (form.blocks.some(block => !block.title || (block.type === "link" && !validUrl(block.url)) ||
      (block.type === "text" && block.url) || (block.type === "media" && (!validMediaUrl(block.url) || !block.mediaType)))) {
      return setFormError("أكمل عناوين المحتوى، واستخدم رابطًا صحيحًا يبدأ بـ http:// أو https://.");
    }
    if ((form.courses?.length ?? 0) > 20) return setFormError("يمكن إضافة 20 دورة كحد أقصى للقسم.");
    if ((form.courses ?? []).some(course => course.title.length < 2 || course.title.length > 120 ||
      course.description.length > 600 || course.materials.length < 1 || course.materials.length > 20 ||
      (course.skills ?? []).length > 20 || (course.skills ?? []).some(skill => !skill.trim() || skill.trim().length > 60) ||
      course.materials.some(block => !block.title || (block.type === "text" && !block.body) ||
        (block.type === "link" && !validUrl(block.url)) || (block.type === "text" && block.url) ||
        (block.type === "media" && (!validMediaUrl(block.url) || !block.mediaType))))) {
      return setFormError("أكمل عنوان كل دورة وأضف من مادة واحدة إلى 20 مادة صالحة لكل دورة.");
    }
    setFormError("");
    const done = {
      onSuccess: () => { refresh(); setEditing(null); },
      onError: (error: unknown) => setFormError(errorText(error)),
    };
    if (editing.id) update.mutate({ id: editing.id, data: form }, done);
    else create.mutate({ data: form }, done);
  };
  const startEdit = (section: PlatformSection) => {
    setFormError("");
    setEditing({ id: section.id, form: sectionForm(section) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const togglePublish = (section: PlatformSection) => {
    setRowError("");
    update.mutate({ id: section.id, data: { ...sectionForm(section), published: !section.published } }, {
      onSuccess: refresh, onError: error => setRowError(errorText(error)),
    });
  };
  const deleteSection = () => {
    if (!toDelete) return;
    setDeleteError("");
    remove.mutate({ id: toDelete.id }, {
      onSuccess: () => { refresh(); setToDelete(null); },
      onError: error => setDeleteError(errorText(error)),
    });
  };

  return <section className="adm-sections-panel" aria-labelledby="adm-sections-title">
    <div className="adm-section-head">
      <div><h2 id="adm-sections-title">إدارة الأقسام ومحتواها</h2><p className="adm-note">أنشئ صفحات ووحدات، أو أضف محتوى للأقسام الأساسية، ثم انشر التغييرات للطلاب.</p></div>
      <div className="adm-user-actions">
        <button type="button" className="button button-outline button-compact" disabled={Boolean(editing)} onClick={onOpenModuleSettings}><Settings2 size={15}/> الأقسام الأساسية</button>
        <button type="button" className="button button-primary button-compact" onClick={() => { setFormError(""); setEditing({ form: blankSection() }); }}><Plus size={15}/> قسم جديد</button>
      </div>
    </div>
    {rowError && <p className="adm-form-error" role="alert">{rowError}</p>}
    {editing && <form className="adm-editor adm-section-editor" onSubmit={submit} aria-label={editing.id ? "تعديل قسم" : "إنشاء قسم"}>
      <div className="adm-section-editor-title"><h3>{editing.id ? "تعديل القسم" : "إضافة قسم"}</h3><button type="button" className="icon-button" aria-label="إغلاق نموذج القسم" onClick={() => setEditing(null)}><X size={17}/></button></div>
      <fieldset className="adm-kind">
        <legend>نوع القسم</legend>
        <label className={editing.form.kind === "content_page" ? "on" : ""}><input type="radio" name="section-kind" checked={editing.form.kind === "content_page"} onChange={() => setField("kind", "content_page")}/><FileText size={15}/> صفحة محتوى</label>
        <label className={editing.form.kind === "module" ? "on" : ""}><input type="radio" name="section-kind" checked={editing.form.kind === "module"} onChange={() => setField("kind", "module")}/><BookOpen size={15}/> وحدة جديدة</label>
      </fieldset>
      <div className="adm-section-meta-fields">
        <label className="adm-field"><span>اسم القسم <RequiredMark/></span><input required minLength={2} maxLength={100} value={editing.form.title} onChange={e => setField("title", e.target.value)}/></label>
        <label className="adm-field"><span>الترتيب على لوحة الطالب</span><input type="number" min={0} max={999} value={editing.form.sortOrder} onChange={e => setField("sortOrder", Math.min(999, Math.max(0, Number(e.target.value) || 0)))}/></label>
      </div>
      <label className="adm-field"><span>وصف مختصر</span><textarea rows={2} maxLength={400} value={editing.form.description} onChange={e => setField("description", e.target.value)}/></label>
      <SectionAppearanceFields
        iconKey={editing.form.iconKey ?? "book"}
        accentKey={editing.form.accentKey ?? "teal"}
        cardStyle={editing.form.cardStyle ?? "soft"}
        onIconChange={iconKey => setField("iconKey", iconKey)}
        onAccentChange={accentKey => setField("accentKey", accentKey)}
        onCardStyleChange={cardStyle => setField("cardStyle", cardStyle)}
        previewTitle={editing.form.title}
      />
       <div className="adm-section-block-heading"><div><h4>محتوى القسم</h4><p>اجمع النصوص والروابط والفيديوهات والملفات في قائمة واحدة، وأضف أكثر من ملف دفعة واحدة.</p></div><button type="button" className="button button-outline button-compact" disabled={editing.form.blocks.length >= 20} onClick={() => setField("blocks", [...editing.form.blocks, { type: "text", title: "", body: "", url: "" }])}><Plus size={14}/> إضافة عنصر</button></div>
      <div className="adm-section-block-list">{editing.form.blocks.map((block, index) => <article className="adm-section-block" key={index}>
        <div className="adm-section-block-top"><b>عنصر {index + 1}</b><div className="adm-section-block-tools">
           <button type="button" className="icon-button" aria-label={`تحريك العنصر ${index + 1} لأعلى`} disabled={index === 0} onClick={() => moveBlock(index, -1)}><ArrowUp size={15}/></button>
           <button type="button" className="icon-button" aria-label={`تحريك العنصر ${index + 1} لأسفل`} disabled={index === editing.form.blocks.length - 1} onClick={() => moveBlock(index, 1)}><ArrowDown size={15}/></button>
          {editing.form.blocks.length > 1 && <button type="button" className="icon-button danger-icon" aria-label={`حذف العنصر ${index + 1}`} onClick={() => setField("blocks", editing.form.blocks.filter((_, i) => i !== index))}><Trash2 size={15}/></button>}
        </div></div>
         <SectionContentBlockEditor
           block={block}
           name={`block-kind-${index}`}
           testIdPrefix={`section-block-${index}`}
           maxBatchFileCount={21 - editing.form.blocks.length}
           onChange={patch => setBlock(index, patch)}
           onUploadMany={blocks => replaceBlocksWithBatch(index, blocks)}
         />
      </article>)}</div>
      <div className="adm-course-heading"><div><h4>الدورات التعليمية</h4><p>قسّم المحتوى إلى دورات قصيرة، ولكل دورة موادها المرتبة.</p></div>
        <button type="button" className="button button-outline button-compact" data-testid="button-add-section-course" disabled={(editing.form.courses?.length ?? 0) >= 20} onClick={() => setField("courses", [...(editing.form.courses ?? []), newCourse()])}><Plus size={14}/> إضافة دورة</button>
      </div>
      {(editing.form.courses ?? []).map((course, courseIndex) => <article className="adm-course-editor" key={course.id} data-testid={`admin-course-${course.id}`}>
        <div className="adm-course-top"><b>دورة {courseIndex + 1}</b><div className="adm-section-block-tools">
          <button type="button" className="icon-button" aria-label={`تحريك الدورة ${courseIndex + 1} لأعلى`} data-testid={`button-course-up-${course.id}`} disabled={courseIndex === 0} onClick={() => moveCourse(courseIndex, -1)}><ArrowUp size={15}/></button>
          <button type="button" className="icon-button" aria-label={`تحريك الدورة ${courseIndex + 1} لأسفل`} data-testid={`button-course-down-${course.id}`} disabled={courseIndex === (editing.form.courses?.length ?? 0) - 1} onClick={() => moveCourse(courseIndex, 1)}><ArrowDown size={15}/></button>
          <button type="button" className="icon-button danger-icon" aria-label={`حذف الدورة ${course.title || courseIndex + 1}`} data-testid={`button-course-remove-${course.id}`} onClick={() => setField("courses", (editing.form.courses ?? []).filter((_, i) => i !== courseIndex))}><Trash2 size={15}/></button>
        </div></div>
        <div className="adm-section-meta-fields">
          <label className="adm-field"><span>عنوان الدورة <RequiredMark/></span><input required minLength={2} maxLength={120} value={course.title} data-testid={`input-course-title-${course.id}`} onChange={e => setCourse(courseIndex, { title: e.target.value })}/></label>
          <label className="adm-field"><span>وصف الدورة</span><textarea rows={2} maxLength={600} value={course.description} data-testid={`input-course-description-${course.id}`} onChange={e => setCourse(courseIndex, { description: e.target.value })}/></label>
        </div>
        <label className="adm-field"><span>المهارات التي تثبتها الدورة</span><input maxLength={1400} value={(course.skills ?? []).join("، ")} placeholder="مثال: تحليل البيانات، إعداد التقارير" data-testid={`input-course-skills-${course.id}`} onChange={e => setCourse(courseIndex, { skills: e.target.value.split(/[،,]/).map(skill => skill.trim()).filter(Boolean).slice(0, 20) })}/><small className="adm-note">تُضاف هذه المهارات إلى سيرة الطالب بعد إكمال الدورة فقط.</small></label>
         <div className="adm-section-block-heading"><div><h5>مواد الدورة</h5><p>أضف روابط وملفات وفيديوهات معًا، ورتّبها كما تظهر للطالب.</p></div><button type="button" className="button button-outline button-compact" data-testid={`button-course-add-material-${course.id}`} disabled={course.materials.length >= 20} onClick={() => setCourse(courseIndex, { materials: [...course.materials, emptyBlock()] })}><Plus size={14}/> إضافة مادة</button></div>
        <div className="adm-section-block-list">{course.materials.map((block, materialIndex) => <article className="adm-section-block adm-course-material" key={`${course.id}-${materialIndex}`}>
          <div className="adm-section-block-top"><b>مادة {materialIndex + 1}</b><div className="adm-section-block-tools">
            <button type="button" className="icon-button" aria-label={`تحريك المادة ${materialIndex + 1} لأعلى`} data-testid={`button-course-material-up-${course.id}-${materialIndex}`} disabled={materialIndex === 0} onClick={() => moveCourseMaterial(courseIndex, materialIndex, -1)}><ArrowUp size={15}/></button>
            <button type="button" className="icon-button" aria-label={`تحريك المادة ${materialIndex + 1} لأسفل`} data-testid={`button-course-material-down-${course.id}-${materialIndex}`} disabled={materialIndex === course.materials.length - 1} onClick={() => moveCourseMaterial(courseIndex, materialIndex, 1)}><ArrowDown size={15}/></button>
            {course.materials.length > 1 && <button type="button" className="icon-button danger-icon" aria-label={`حذف المادة ${materialIndex + 1}`} data-testid={`button-course-material-remove-${course.id}-${materialIndex}`} onClick={() => setCourse(courseIndex, { materials: course.materials.filter((_, i) => i !== materialIndex) })}><Trash2 size={15}/></button>}
          </div></div>
          <SectionContentBlockEditor
            block={block}
            name={`course-${course.id}-material-kind-${materialIndex}`}
            testIdPrefix={`course-${course.id}-material-${materialIndex}`}
            maxBatchFileCount={21 - course.materials.length}
            onChange={patch => setCourseMaterial(courseIndex, materialIndex, patch)}
            onUploadMany={blocks => replaceCourseMaterialWithBatch(courseIndex, materialIndex, blocks)}
          />
        </article>)}</div>
      </article>)}
      <label className="adm-switch"><input type="checkbox" checked={editing.form.published} onChange={e => setField("published", e.target.checked)}/><span>{editing.form.published ? "منشور ويظهر للطلاب" : "مسودة — لا يظهر للطلاب"}</span></label>
      {formError && <p className="adm-form-error" role="alert">{formError}</p>}
      <div className="adm-dialog-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => setEditing(null)}>إلغاء</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ القسم"}</button></div>
    </form>}
    {query.isLoading ? <div className="adm-skeleton" role="status"><span/><span/><span/></div>
      : query.isError || !query.data ? <div className="adm-state adm-error" role="alert"><p>{errorText(query.error)}</p><button type="button" className="button button-outline button-compact" onClick={() => query.refetch()}>إعادة المحاولة</button></div>
      : query.data.items.length === 0 ? <div className="adm-empty-sections"><div className="adm-state"><Layers3 size={22}/><b>لم تضف أقسامًا بعد</b><p>أنشئ أول صفحة أو وحدة لتظهر في لوحة الطالب بعد نشرها.</p></div></div>
      : <ul className="adm-section-list">{query.data.items.map(section => {
        const SectionIcon = getSectionIcon(section.iconKey ?? (section.kind === "module" ? "book" : "file"));
        const accent = getSectionAccent(section.accentKey);
        return <li className="adm-section-row" key={section.id}>
        <span className={`adm-section-row-icon ${section.kind}`} style={{ "--feature-accent": accent.color, "--feature-soft": accent.soft } as CSSProperties}><SectionIcon size={18}/></span>
        <div className="adm-section-row-copy"><b>{section.title}</b>{section.description && <p>{section.description}</p>}
          <span className="adm-chips"><em className="adm-chip">{section.kind === "module" ? "وحدة" : "صفحة محتوى"}</em><em className={`adm-chip ${section.published ? "adm-chip-ok" : "adm-chip-warn"}`}>{section.published ? "منشور" : "مسودة"}</em><small>الترتيب {section.sortOrder} · {formatDate(section.updatedAt)}</small></span>
        </div>
        {section.published && <Link className="icon-button" href={`/sections/${section.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`معاينة ${section.title}`}><ExternalLink size={15}/></Link>}
        <div className="adm-user-actions">
          <button type="button" className="button button-outline button-compact" disabled={update.isPending} onClick={() => togglePublish(section)}>{section.published ? "إيقاف النشر" : "نشر"}</button>
          <button type="button" className="icon-button" aria-label={`تعديل ${section.title}`} onClick={() => startEdit(section)}><Pencil size={15}/></button>
          <button type="button" className="icon-button danger-icon" aria-label={`حذف ${section.title}`} onClick={() => { setDeleteError(""); setToDelete(section); }}><Trash2 size={15}/></button>
        </div>
      </li>;
      })}</ul>}
    {toDelete && <div className="adm-section-delete" role="group" aria-label="تأكيد حذف القسم">
      <div><b>حذف «{toDelete.title}»؟</b><p>سيختفي القسم فورًا عن الطلاب ولن يمكن استعادته.</p></div>
      {deleteError && <span className="adm-form-error" role="alert">{deleteError}</span>}
      <div className="adm-dialog-actions"><button type="button" className="button button-outline button-compact" disabled={remove.isPending} onClick={() => setToDelete(null)}>إلغاء</button><button type="button" className="button adm-danger button-compact" disabled={remove.isPending} onClick={deleteSection}>{remove.isPending ? "جارٍ الحذف…" : "حذف نهائي"}</button></div>
    </div>}
  </section>;
}
