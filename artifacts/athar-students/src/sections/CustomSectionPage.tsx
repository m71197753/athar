import { useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Check, CheckCircle2, ChevronDown, Download, ExternalLink, FileText, LoaderCircle, Search, X } from "lucide-react";
import { Link } from "wouter";
import { getSectionAccent, getSectionIcon } from "../lib/section-appearance";
import {
  getGetPlatformContentQueryKey, getListLearningItemsQueryKey,
  useCompletePlatformSectionCourse, useGetPlatformContent, useListLearningItems,
} from "@workspace/api-client-react";
import type { SectionBlock } from "@workspace/api-client-react";
import "./custom-sections.css";

type CourseFilter = "all" | "incomplete" | "completed";

export function CustomSectionPage({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const query = useGetPlatformContent({ query: { queryKey: getGetPlatformContentQueryKey(), staleTime: 30_000 } });
  const learningQuery = useListLearningItems({ kind: "course" }, { query: { queryKey: getListLearningItemsQueryKey({ kind: "course" }), enabled: true } });
  const completeCourse = useCompletePlatformSectionCourse();
  const [completionError, setCompletionError] = useState("");
  const [completionNotice, setCompletionNotice] = useState("");
  const [justCompleted, setJustCompleted] = useState<Set<string>>(() => new Set());
  const [courseSearch, setCourseSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<CourseFilter>("all");

  if (query.isLoading) {
    return <main className="page-wrap custom-section-wrap" dir="rtl" aria-live="polite">
      <div className="custom-section-skeleton"/><div className="custom-section-skeleton short"/>
    </main>;
  }
  if (query.isError) {
    return <main className="page-wrap custom-section-wrap" dir="rtl">
      <section className="custom-section-state" role="alert">
        <h1>تعذّر تحميل القسم</h1><p>تحقق من اتصالك ثم حاول مرة أخرى.</p>
        <button className="button button-outline" type="button" onClick={() => query.refetch()}>إعادة المحاولة</button>
      </section>
    </main>;
  }

  const section = query.data?.sections.find(item => item.slug === slug);
  if (!section) {
    return <main className="page-wrap custom-section-wrap" dir="rtl">
      <section className="custom-section-state">
        <h1>القسم غير متاح</h1><p>ربما أخفته الإدارة أو نقلته.</p>
        <Link className="button button-primary" href="/dashboard">العودة لمساحة الطالب</Link>
      </section>
    </main>;
  }

  const isModule = section.kind === "module";
  const SectionIcon = getSectionIcon(section.iconKey ?? (isModule ? "book" : "file"));
  const accent = getSectionAccent(section.accentKey);
  const courses = section.published ? section.courses ?? [] : [];
  const courseTitleCounts = new Map<string, number>();
  courses.forEach(course => courseTitleCounts.set(course.title, (courseTitleCounts.get(course.title) ?? 0) + 1));
  const isCourseCompleted = (courseId: string, title: string) => justCompleted.has(courseId) || (learningQuery.data ?? []).some(item =>
    item.kind === "course" && item.status === "completed" &&
    (item.url?.endsWith(`#course-${courseId}`) ||
      (courseTitleCounts.get(title) === 1 && item.title === title && item.subject === section.title && item.source === "أثر")),
  );
  const completionKnown = !learningQuery.isLoading && !learningQuery.isError;
  const completedCount = courses.filter(course => isCourseCompleted(course.id, course.title)).length;
  const activeFilter = completionKnown ? courseFilter : "all";
  const normalizedSearch = courseSearch.trim().toLocaleLowerCase("ar");
  const visibleCourses = courses.filter(course => {
    const isCompleted = isCourseCompleted(course.id, course.title);
    const matchesFilter = activeFilter === "all" ||
      (activeFilter === "completed" && isCompleted) ||
      (activeFilter === "incomplete" && !isCompleted);
    const searchableText = `${course.title} ${course.description} ${course.materials.map(material => `${material.title} ${material.body}`).join(" ")}`.toLocaleLowerCase("ar");
    return matchesFilter && (!normalizedSearch || searchableText.includes(normalizedSearch));
  });
  const recordCompletion = (courseId: string) => {
    setCompletionError("");
    setCompletionNotice("");
    completeCourse.mutate({ slug, courseId }, {
      onSuccess: item => {
        setJustCompleted(current => new Set(current).add(courseId));
        queryClient.setQueryData<NonNullable<typeof learningQuery.data>>(
          getListLearningItemsQueryKey({ kind: "course" }),
          current => current ? [item, ...current.filter(existing => existing.id !== item.id)] : [item],
        );
        void queryClient.invalidateQueries({ queryKey: getListLearningItemsQueryKey({ kind: "course" }) });
        void queryClient.invalidateQueries({ queryKey: getGetPlatformContentQueryKey() });
        setCompletionNotice("تم حفظ إنجازك كسجل تعلّم مكتمل.");
      },
      onError: () => setCompletionError("تعذّر تسجيل إكمال الدورة. حاول مرة أخرى."),
    });
  };
  const renderMaterial = (block: SectionBlock, index: number, courseId: string) => block.type === "link"
    ? <a className="custom-section-link" key={`${courseId}-${index}`} href={block.url} target="_blank" rel="noopener noreferrer" data-testid={`course-material-link-${courseId}-${index}`}>
        <span className="custom-section-link-copy"><b>{block.title}</b>{block.body && <span>{block.body}</span>}</span><ExternalLink size={17} aria-hidden="true"/>
      </a>
    : block.type === "media" ? <section className="custom-section-media" key={`${courseId}-${index}`} data-testid={`course-material-media-${courseId}-${index}`}>
        <h3>{block.title}</h3>{block.body && <p>{block.body}</p>}
        {block.mediaType === "image" && <img src={block.url} alt={block.title} loading="lazy"/>}
        {block.mediaType === "video" && <video src={block.url} controls preload="metadata"/>}
        {block.mediaType === "file" && <a href={block.url} download><Download size={16}/> فتح الملف</a>}
      </section>
    : <section className="custom-section-text" key={`${courseId}-${index}`} data-testid={`course-material-text-${courseId}-${index}`}>
        <h3>{block.title}</h3>{block.body && <p>{block.body}</p>}
      </section>;
  return <main className={`page-wrap custom-section-wrap custom-course-page custom-section-style-${section.cardStyle ?? "soft"} ${isModule ? "custom-section-module" : "custom-section-reading"}`} dir="rtl" style={{ "--section-accent": accent.color, "--section-soft": accent.soft } as CSSProperties}>
    <Link className="custom-section-back" href="/dashboard"><ArrowLeft size={16}/> العودة لمساحة الطالب</Link>
    <header className="custom-section-header custom-course-hero">
      <div className="custom-course-hero-copy">
        <span className="custom-section-kicker"><SectionIcon size={15}/> {isModule ? "وحدة من أثر" : "صفحة من أثر"}</span>
        <h1>{section.title}</h1>
        <p>{section.description || "تعلّم على مهل، وافتح المواد، وسجّل ما أنجزته في سجل تعلّمك."}</p>
      </div>
      <span className="custom-course-hero-mark" aria-hidden="true" style={{ color: accent.color, background: accent.soft }}><SectionIcon size={31} strokeWidth={1.6}/></span>
    </header>
    <div className="custom-section-blocks">
      {section.blocks.map((block, index) => block.type === "link"
        ? <a className="custom-section-link" key={`${block.type}-${index}`} href={block.url} target="_blank" rel="noopener noreferrer">
            <span className="custom-section-link-copy"><b>{block.title}</b>{block.body && <span>{block.body}</span>}</span>
            <ExternalLink size={17} aria-hidden="true"/>
          </a>
        : block.type === "media" ? <section className="custom-section-media" key={`${block.type}-${index}`}>
            <h2>{block.title}</h2>{block.body && <p>{block.body}</p>}
            {block.mediaType === "image" && <img src={block.url} alt={block.title} loading="lazy"/>}
            {block.mediaType === "video" && <video src={block.url} controls preload="metadata"/>}
            {block.mediaType === "file" && <a href={block.url} download><Download size={16}/> فتح الملف</a>}
          </section>
        : <section className="custom-section-text" key={`${block.type}-${index}`}>
            <h2>{block.title}</h2>{block.body && <p>{block.body}</p>}
          </section>)}
    </div>
    {courses.length > 0 && <section className="custom-section-courses" aria-labelledby="custom-courses-title" data-testid="published-courses">
      <header className="custom-courses-heading custom-courses-heading-v2">
        <div className="custom-courses-heading-copy">
          <span className="custom-section-kicker"><BookOpen size={15}/> مسارك الدراسي</span>
          <h2 id="custom-courses-title">الدورات</h2>
          <p>افتح المواد، ثم سجّل ما أتممته في سجل تعلّمك.</p>
        </div>
        <div className="custom-course-completion-summary" aria-label={completionKnown ? `الدورات المكتملة: ${completedCount} من ${courses.length}` : "جارٍ تحميل سجل التعلّم"}>
          {completionKnown
            ? <><strong>{completedCount.toLocaleString("ar")}</strong><small>مكتملة</small></>
            : <><span className="custom-course-summary-skeleton" aria-hidden="true"/><small>جارٍ التحقق</small></>}
        </div>
      </header>
      {learningQuery.isLoading ? <div className="custom-course-status" role="status" data-testid="courses-loading"><span className="custom-section-skeleton short"/> جارٍ التحقق من سجل التعلّم</div>
        : learningQuery.isError ? <div className="custom-course-status custom-course-error" role="alert" data-testid="courses-error"><span>تعذّر تحميل حالة الإنجاز.</span><button type="button" className="button button-outline" onClick={() => learningQuery.refetch()}>إعادة المحاولة</button></div>
        : null}
      {completionError && <p className="custom-course-feedback error" role="alert" data-testid="course-completion-error">{completionError}</p>}
      {completionNotice && <p className="custom-course-feedback success" role="status" data-testid="course-completion-success">{completionNotice}</p>}
      <div className="custom-course-tools">
        <label className="custom-course-search">
          <Search size={17} aria-hidden="true"/>
          <input
            type="search"
            value={courseSearch}
            onChange={event => setCourseSearch(event.target.value)}
            placeholder="ابحث في دوراتك وموادها"
            aria-label="ابحث في دوراتك وموادها"
            data-testid="course-search"
          />
          {courseSearch && <button type="button" onClick={() => setCourseSearch("")} aria-label="مسح البحث" data-testid="clear-course-search"><X size={15}/></button>}
        </label>
        <div className="custom-course-filters" role="group" aria-label="تصفية الدورات">
          {([
            ["all", "الكل"],
            ["incomplete", "غير مكتملة"],
            ["completed", "مكتملة"],
          ] as [CourseFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={activeFilter === value ? "is-active" : ""}
              aria-pressed={activeFilter === value}
              disabled={value !== "all" && !completionKnown}
              onClick={() => setCourseFilter(value)}
              data-testid={`course-filter-${value}`}
            >{label}</button>
          ))}
        </div>
      </div>
      <div className="custom-course-count" aria-live="polite">
        <span>{visibleCourses.length.toLocaleString("ar")} من {courses.length.toLocaleString("ar")} دورة</span>
        {courseSearch && <span>نتائج البحث عن «{courseSearch}»</span>}
      </div>
      {visibleCourses.length > 0 ? <div className="custom-course-list">{visibleCourses.map(course => {
        const completed = isCourseCompleted(course.id, course.title);
        const pending = completeCourse.isPending && completeCourse.variables?.courseId === course.id;
        return <article className={`custom-course-card ${completed ? "is-completed" : ""}`} key={course.id} data-testid={`course-card-${course.id}`}>
          <div className="custom-course-card-topline">
            <span className="custom-course-number">{String(courses.findIndex(item => item.id === course.id) + 1).padStart(2, "0")}</span>
            <span className="custom-course-context">دورة تعلّم</span>
            {completed && <span className="custom-course-complete-badge" data-testid={`course-completed-${course.id}`}><Check size={14}/> مكتملة</span>}
          </div>
          <div className="custom-course-title custom-course-copy"><h3 data-testid={`course-title-${course.id}`}>{course.title}</h3>{course.description && <p>{course.description}</p>}</div>
          <details className="custom-course-details custom-course-details-v2" data-testid={`course-details-${course.id}`}>
            <summary><span className="custom-course-material-icon"><FileText size={16}/></span><span className="custom-course-material-copy"><b>استكشف مواد الدورة</b><small>{course.materials.length.toLocaleString("ar")} {course.materials.length === 1 ? "مادة" : "مواد"}</small></span><ChevronDown size={17} aria-hidden="true"/></summary>
            <div className="custom-course-materials">{course.materials.map((material, index) => renderMaterial(material, index, course.id))}</div>
          </details>
          <footer className="custom-course-actions custom-course-actions-v2">
            {completed ? <span className="custom-course-record"><CheckCircle2 size={16}/> أُضيفت إلى سجلّ تعلّمك</span>
              : <button type="button" className="button button-primary" data-testid={`button-complete-course-${course.id}`} disabled={pending || completeCourse.isPending || learningQuery.isLoading || learningQuery.isError}
                  onClick={() => recordCompletion(course.id)}>{pending ? <><LoaderCircle size={16} className="custom-course-spinner"/> جارٍ التسجيل…</> : <><CheckCircle2 size={16}/> سجّل إكمال الدورة</>}</button>}
          </footer>
        </article>;
      })}</div> : <section className="custom-course-empty" role="status" data-testid="course-empty-state">
        <span className="custom-course-empty-icon"><Search size={20}/></span>
        <h3>لا توجد دورات هنا</h3>
        <p>{courseSearch ? "جرّب عبارة بحث أخرى أو غيّر التصفية." : "لا توجد دورات مطابقة لهذا الاختيار."}</p>
        <button type="button" onClick={() => { setCourseSearch(""); setCourseFilter("all"); }}>عرض كل الدورات</button>
      </section>}
      <footer className="custom-course-page-foot" aria-label="شعار أثر"><span/>كل تجربة تصنع فرقًا<span/></footer>
    </section>}
  </main>;
}
