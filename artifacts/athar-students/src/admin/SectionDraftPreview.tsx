import type { CSSProperties } from "react";
import { CheckCircle2, Download, ExternalLink, EyeOff, FolderOpen, X } from "lucide-react";
import type { SectionBlock, SectionInput } from "@workspace/api-client-react";
import { getSectionAccent, getSectionIcon } from "../lib/section-appearance";
import { adminPreviewMediaUrl, groupCourseMaterials, safeSectionLink, type IndexedLesson } from "../lib/section-units";
import "../sections/custom-sections.css";
import "./section-builder.css";

function PreviewBlock({ block, heading }: { block: SectionBlock; heading: "h3" | "h4" }) {
  const H = heading;
  const title = block.title.trim() || <span className="sb-ph">عنوان لم يُكتب بعد</span>;
  if (block.type === "link") return <a className="custom-section-link" href={safeSectionLink(block.url)} aria-disabled={!safeSectionLink(block.url)} target="_blank" rel="noopener noreferrer">
    <span className="custom-section-link-copy"><b>{title}</b>{block.body ? <span>{block.body}</span> : !block.url && <span className="sb-ph">رابط لم يُضف بعد</span>}</span><ExternalLink size={17} aria-hidden="true"/>
  </a>;
  if (block.type === "media") {
    const src = block.url ? adminPreviewMediaUrl(block.url) : "";
    return <section className="custom-section-media">
      <H>{title}</H>{block.body && <p>{block.body}</p>}
      {!src ? <p className="sb-ph sb-ph-box">لم يُرفع ملف بعد</p>
        : block.mediaType === "image" ? <img src={src} alt={block.title} loading="lazy"/>
        : block.mediaType === "video" ? <video src={src} controls playsInline preload="metadata"/>
        : block.mediaType === "audio" ? <audio src={src} controls preload="metadata"/>
        : <div className="tracked-section-document"><iframe src={`${src}?preview=1`} title={`معاينة ${block.title}`} loading="lazy"/><a href={src} target="_blank" rel="noopener noreferrer"><Download size={16}/> فتح الملف</a></div>}
    </section>;
  }
  return <section className="custom-section-text"><H>{title}</H>{block.body ? <p>{block.body}</p> : <p className="sb-ph">نص لم يُكتب بعد</p>}</section>;
}

const lessonList = (lessons: IndexedLesson[]) => lessons.length === 0
  ? <p className="sb-ph sb-ph-box">لا توجد دروس في هذه الوحدة بعد</p>
  : <ol className="sb-preview-lessons">{lessons.map(({ block, index }) => <li key={index}><PreviewBlock block={block} heading="h4"/></li>)}</ol>;

export function SectionDraftPreview({ form, onClose }: { form: SectionInput; onClose: () => void }) {
  const isModule = form.kind === "module";
  const Icon = getSectionIcon(form.iconKey ?? (isModule ? "book" : "file"));
  const accent = getSectionAccent(form.accentKey);
  const courses = form.courses ?? [];
  return <div className="sb-preview" role="region" aria-label="معاينة المسودة قبل الحفظ" data-testid="section-draft-preview">
    <div className="sb-preview-bar">
      <span><EyeOff size={15}/> معاينة غير منشورة — مسودة لم تُحفظ بعد. لا يُسجَّل فيها أي تقدم أو إكمال.</span>
      <button type="button" className="button button-outline button-compact" onClick={onClose} data-testid="button-close-preview"><X size={14}/> العودة للتحرير</button>
    </div>
    <main className={`page-wrap custom-section-wrap custom-course-page custom-section-style-${form.cardStyle ?? "soft"} ${isModule ? "custom-section-module" : "custom-section-reading"}`} dir="rtl" style={{ "--section-accent": accent.color, "--section-soft": accent.soft } as CSSProperties}>
      <header className="custom-section-header custom-course-hero">
        <div className="custom-course-hero-copy">
          <span className="custom-section-kicker"><Icon size={15}/> {isModule ? "وحدة من أثر" : "صفحة من أثر"} · {form.published ? "سيُنشر عند الحفظ" : "مسودة"}</span>
          <h1>{form.title.trim() || <span className="sb-ph">اسم القسم</span>}</h1>
          <p>{form.description.trim() || "تعلّم على مهل، وافتح المواد، وسجّل ما أنجزته في سجل تعلّمك."}</p>
        </div>
        <span className="custom-course-hero-mark" aria-hidden="true" style={{ color: accent.color, background: accent.soft }}><Icon size={31} strokeWidth={1.6}/></span>
      </header>
      <div className="custom-section-blocks">
        {form.blocks.length ? form.blocks.map((b, i) => <PreviewBlock key={i} block={b} heading="h3"/>) : <p className="sb-ph sb-ph-box">لا يوجد محتوى للقسم بعد</p>}
      </div>
      <section className="custom-section-courses">
        <header className="custom-courses-heading"><h2>الدورات</h2></header>
        {courses.length === 0 ? <p className="sb-ph sb-ph-box">لم تُضف دورات بعد</p> : courses.map((course, ci) => {
          const { groups, loose } = groupCourseMaterials(course);
          return <article className="sb-preview-course" key={course.id}>
            <span className="custom-course-number">دورة {String(ci + 1).padStart(2, "0")}</span>
            <h3>{course.title.trim() || <span className="sb-ph">عنوان الدورة</span>}</h3>
            {course.description && <p>{course.description}</p>}
            {groups.map(({ unit, lessons }, ui) => <section className="sb-preview-unit" key={unit.id}>
              <h4 className="sb-preview-unit-title"><FolderOpen size={15}/> الوحدة {(ui + 1).toLocaleString("ar")}: {unit.title.trim() || <span className="sb-ph">بلا عنوان</span>}</h4>
              {unit.description && <p>{unit.description}</p>}
              {lessonList(lessons)}
            </section>)}
            {(loose.length > 0 || groups.length === 0) && <section className="sb-preview-unit sb-preview-loose">
              {groups.length > 0 && <h4 className="sb-preview-unit-title">دروس أخرى</h4>}
              {lessonList(loose)}
            </section>}
            <button type="button" className="button button-primary" disabled title="معطّل في المعاينة"><CheckCircle2 size={16}/> سجّل إكمال الدورة (معطّل في المعاينة)</button>
          </article>;
        })}
      </section>
    </main>
  </div>;
}
