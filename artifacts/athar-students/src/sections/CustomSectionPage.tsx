import { useEffect, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Check, CheckCircle2, ChevronLeft, Download, ExternalLink, FileText, LoaderCircle, Search, X } from "lucide-react";
import { Link } from "wouter";
import { getSectionAccent, getSectionIcon } from "../lib/section-appearance";
import {
  getGetPlatformContentQueryKey, getGetSectionMediaProgressQueryKey, getListLearningItemsQueryKey,
  useCompletePlatformSectionCourse, useGetPlatformContent, useListLearningItems,
  useGetSectionMediaProgress,
} from "@workspace/api-client-react";
import type { SectionBlock } from "@workspace/api-client-react";
import { TrackedSectionMedia } from "./TrackedSectionMedia";
import { CourseLearningRoom } from "./CourseLearningRoom";
import "./custom-sections.css";
import "../admin/section-builder.css";

type CourseFilter = "all" | "incomplete" | "completed";
const sectionMediaId = (url: string) => /^\/api\/platform\/section-media\/([a-f0-9-]{36})$/i.exec(url)?.[1];

export function CustomSectionPage({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const query = useGetPlatformContent({ query: { queryKey: getGetPlatformContentQueryKey(), staleTime: 30_000 } });
  const mediaProgressQuery = useGetSectionMediaProgress(slug, {
    query: { queryKey: getGetSectionMediaProgressQueryKey(slug), staleTime: 30_000 },
  });
  const learningQuery = useListLearningItems({ kind: "course" }, { query: { queryKey: getListLearningItemsQueryKey({ kind: "course" }), enabled: true } });
  const completeCourse = useCompletePlatformSectionCourse();
  const [completionError, setCompletionError] = useState("");
  const [completionNotice, setCompletionNotice] = useState("");
  const [justCompleted, setJustCompleted] = useState<Set<string>>(() => new Set());
  const [courseSearch, setCourseSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<CourseFilter>("all");
  const readHashCourse = () => /^#course-(.+)$/.exec(window.location.hash)?.[1] ?? null;
  const [openCourseId, setOpenCourseId] = useState<string | null>(readHashCourse);
  useEffect(() => {
    const sync = () => setOpenCourseId(readHashCourse());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => { window.removeEventListener("hashchange", sync); window.removeEventListener("popstate", sync); };
  }, []);
  const openCourse = (courseId: string) => {
    window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#course-${courseId}`);
    setOpenCourseId(courseId);
    window.scrollTo({ top: 0 });
  };
  const closeCourse = () => {
    const id = openCourseId;
    window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
    setOpenCourseId(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="button-open-course-${id}"]`)?.focus());
  };

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
    const searchableText = `${course.title} ${course.description} ${(course.skills ?? []).join(" ")} ${(course.units ?? []).map(unit => `${unit.title} ${unit.description}`).join(" ")} ${course.materials.map(material => `${material.title} ${material.body}`).join(" ")}`.toLocaleLowerCase("ar");
    return matchesFilter && (!normalizedSearch || searchableText.includes(normalizedSearch));
  });
  const highlightedCourse = courses.find(course => !isCourseCompleted(course.id, course.title)) ?? courses[0];
  const highlightedCourseCompleted = highlightedCourse
    ? isCourseCompleted(highlightedCourse.id, highlightedCourse.title)
    : false;
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
  const renderMedia = (block: SectionBlock, contextKey: string, key: string, heading: "h2" | "h3") => {
    const mediaId = sectionMediaId(block.url);
    return <section className="custom-section-media" key={key} data-testid={`course-material-media-${key}`}>
      {heading === "h2" ? <h2>{block.title}</h2> : <h3>{block.title}</h3>}{block.body && <p>{block.body}</p>}
      {block.mediaType === "image" && <img src={block.url} alt={block.title} loading="lazy"/>}
      {mediaId && (block.mediaType === "audio" || block.mediaType === "video" || block.mediaType === "file")
        ? <TrackedSectionMedia
            progressReady={mediaProgressQuery.isSuccess}
            progressError={mediaProgressQuery.isError}
            onRetryProgress={() => void mediaProgressQuery.refetch()}
            sectionSlug={slug}
            contextKey={contextKey}
            mediaAssetId={mediaId}
            mediaType={block.mediaType}
            url={block.url}
            title={block.title}
            savedProgress={mediaProgressQuery.data?.find(row => row.contextKey === contextKey && row.mediaAssetId === mediaId)}
          />
        : block.mediaType === "video" ? <video src={block.url} controls playsInline preload="metadata"/>
          : block.mediaType === "audio" ? <audio src={block.url} controls preload="metadata"/>
              : block.mediaType === "file" ? <div className="tracked-section-document"><iframe src={`${block.url}?preview=1`} title={`معاينة ${block.title}`} loading="lazy"/><a href={block.url} download><Download size={16}/> تنزيل الملف</a></div>
              : null}
    </section>;
  };
  const roomCourse = openCourseId ? courses.find(course => course.id === openCourseId) : undefined;
  const pageStyle = { "--section-accent": accent.color, "--section-soft": accent.soft } as CSSProperties;
  if (openCourseId) {
    const roomIndex = roomCourse ? courses.findIndex(item => item.id === roomCourse.id) : -1;
    return <main className={`page-wrap custom-section-wrap custom-course-page is-room custom-section-style-${section.cardStyle ?? "soft"}`} dir="rtl" style={pageStyle}>
      {roomCourse ? <CourseLearningRoom
        key={roomCourse.id}
        sectionSlug={slug}
        sectionTitle={section.title}
        course={roomCourse}
        courseNumber={roomIndex + 1}
        completed={isCourseCompleted(roomCourse.id, roomCourse.title)}
        completionPending={completeCourse.isPending && completeCourse.variables?.courseId === roomCourse.id}
        completionDisabled={completeCourse.isPending || learningQuery.isLoading || learningQuery.isError}
        completionKnown={completionKnown}
        onComplete={() => recordCompletion(roomCourse.id)}
        onBack={closeCourse}
        progressRows={mediaProgressQuery.data}
        progressReady={mediaProgressQuery.isSuccess}
        progressError={mediaProgressQuery.isError}
        onRetryProgress={() => void mediaProgressQuery.refetch()}
      /> : <section className="custom-section-state" role="alert">
        <h1>الدورة غير متاحة</h1><p>ربما أُزيلت هذه الدورة أو لم تُنشر بعد.</p>
        <button className="button button-primary" type="button" onClick={closeCourse} data-testid="button-back-to-courses">العودة إلى الدورات</button>
      </section>}
      {learningQuery.isError && <div className="custom-course-status custom-course-error" role="alert"><span>تعذّر تحميل حالة الإنجاز.</span><button type="button" className="button button-outline" onClick={() => learningQuery.refetch()}>إعادة المحاولة</button></div>}
      {completionError && <p className="custom-course-feedback error" role="alert" data-testid="course-completion-error">{completionError}</p>}
      {completionNotice && <p className="custom-course-feedback success" role="status" data-testid="course-completion-success">{completionNotice}</p>}
    </main>;
  }
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
        : block.type === "media" ? renderMedia(block, "section", `${block.type}-${index}`, "h2")
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
      <div className="custom-course-browse-layout">
        <aside className="custom-course-sidebar" aria-label="استكشاف الدورات">
          {highlightedCourse && <article className="custom-course-next-card" data-testid="course-next-step">
            <span className="custom-course-next-eyebrow"><BookOpen size={14} aria-hidden="true"/> خطوتك التالية</span>
            <h3>{highlightedCourseCompleted ? "راجع ما تعلمته" : "ابدأ التعلّم الآن"}</h3>
            <p>{highlightedCourse.title}</p>
            <button
              type="button"
              onClick={() => openCourse(highlightedCourse.id)}
              aria-label={`${highlightedCourseCompleted ? "راجع" : "ابدأ"} دورة ${highlightedCourse.title}`}
            >
              {highlightedCourseCompleted ? "مراجعة الدورة" : "تابع الدورة"} <ChevronLeft size={16} aria-hidden="true"/>
            </button>
          </article>}
          <section className="custom-course-discovery" aria-labelledby="custom-course-discovery-title">
            <span className="custom-course-discovery-kicker">ابحث واكتشف</span>
            <h3 id="custom-course-discovery-title">دورات تناسب مسارك</h3>
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
          </section>
        </aside>
        <div className="custom-course-results">
          <div className="custom-course-count" aria-live="polite">
            <span>{visibleCourses.length.toLocaleString("ar")} من {courses.length.toLocaleString("ar")} دورة</span>
            {courseSearch && <span>نتائج البحث عن «{courseSearch}»</span>}
          </div>
          {visibleCourses.length > 0 ? <div className="custom-course-list">{visibleCourses.map(course => {
        const completed = isCourseCompleted(course.id, course.title);
        const pending = completeCourse.isPending && completeCourse.variables?.courseId === course.id;
        const courseIndex = courses.findIndex(item => item.id === course.id);
        const cardAccents = [accent.color, "#167D78", "#A77A37"];
        const courseAccent = cardAccents[courseIndex % cardAccents.length];
        const materialCount = course.materials.length;
        const materialCountLabel = materialCount === 1
          ? "مادة واحدة"
          : materialCount === 2
            ? "مادتان"
            : `${materialCount.toLocaleString("ar")} ${materialCount >= 3 && materialCount <= 10 ? "مواد" : "مادة"}`;
        return <article
          className={`custom-course-card custom-course-card-v3 ${completed ? "is-completed" : ""}`}
          key={course.id}
          data-testid={`course-card-${course.id}`}
          style={{ "--course-accent": courseAccent } as CSSProperties}
        >
          <div className="custom-course-cover">
            <span className="custom-course-number">دورة {String(courseIndex + 1).padStart(2, "0")}</span>
            {completed
              ? <span className="custom-course-complete-badge" data-testid={`course-completed-${course.id}`}><Check size={14}/> مكتملة</span>
              : <span className="custom-course-start-badge">ابدأ التعلّم</span>}
            <span className="custom-course-cover-icon" aria-hidden="true"><SectionIcon size={28} strokeWidth={1.7}/></span>
            <span className="custom-course-cover-caption">أثر · {section.title}</span>
          </div>
          <div className="custom-course-title custom-course-copy">
            <div className="custom-course-meta">
              <span><FileText size={14} aria-hidden="true"/> {materialCountLabel}</span>
              <span>دورة تعليمية</span>
            </div>
            <h3 data-testid={`course-title-${course.id}`}>{course.title}</h3>
            {course.description && <p>{course.description}</p>}
            {!!course.skills?.length && <div className="custom-course-skills" aria-label="المهارات التي تتناولها الدورة">
              {course.skills.slice(0, 3).map(skill => <span key={skill}>{skill}</span>)}
              {course.skills.length > 3 && <span className="custom-course-extra-skills">+{(course.skills.length - 3).toLocaleString("ar")}</span>}
            </div>}
          </div>
          <button type="button" className="custom-course-open" onClick={() => openCourse(course.id)} data-testid={`button-open-course-${course.id}`} aria-label={`${completed ? "راجع" : "ابدأ"} دورة ${course.title}`}>
            <span className="custom-course-material-icon"><FileText size={16} aria-hidden="true"/></span>
            <span className="custom-course-material-copy"><b>{completed ? "راجع مواد الدورة" : "تابع التعلّم"}</b><small>افتح قاعة الدرس بعرض كامل</small></span>
            <span className="custom-course-material-cta">فتح</span>
            <ChevronLeft size={17} aria-hidden="true"/>
          </button>
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
        </div>
      </div>
      <footer className="custom-course-page-foot" aria-label="شعار أثر"><span/>كل تجربة تصنع فرقًا<span/></footer>
    </section>}
  </main>;
}
