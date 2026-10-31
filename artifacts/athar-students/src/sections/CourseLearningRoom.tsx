import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, FileText, FolderOpen, Headphones, Image as ImageIcon, Link2, LoaderCircle, PlayCircle } from "lucide-react";
import type { SectionBlock, SectionCourse, SectionMediaProgress } from "@workspace/api-client-react";
import { TrackedSectionMedia } from "./TrackedSectionMedia";
import { groupCourseMaterials } from "../lib/section-units";
import "./course-learning-room.css";

const sectionMediaId = (url: string) => /^\/api\/platform\/section-media\/([a-f0-9-]{36})$/i.exec(url)?.[1];

type LessonEntry = { block: SectionBlock; index: number; unitLabel: string };

export type CourseLearningRoomProps = {
  sectionSlug: string;
  sectionTitle: string;
  course: SectionCourse;
  courseNumber: number;
  completed: boolean;
  completionPending: boolean;
  completionDisabled: boolean;
  completionKnown: boolean;
  onComplete: () => void;
  onBack: () => void;
  progressRows?: SectionMediaProgress[];
  progressReady: boolean;
  progressError: boolean;
  onRetryProgress: () => void;
};

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return `${h.toLocaleString("ar")} س ${m.toLocaleString("ar")} د`;
  if (m) return `${m.toLocaleString("ar")} د`;
  return `${s.toLocaleString("ar")} ث`;
}

function lessonIcon(block: SectionBlock) {
  if (block.type === "link") return <Link2 size={15} aria-hidden="true"/>;
  if (block.type === "text") return <FileText size={15} aria-hidden="true"/>;
  if (block.mediaType === "video") return <PlayCircle size={15} aria-hidden="true"/>;
  if (block.mediaType === "audio") return <Headphones size={15} aria-hidden="true"/>;
  if (block.mediaType === "image") return <ImageIcon size={15} aria-hidden="true"/>;
  return <FileText size={15} aria-hidden="true"/>;
}

function lessonKind(block: SectionBlock) {
  if (block.type === "link") return "رابط";
  if (block.type === "text") return "قراءة";
  return block.mediaType === "video" ? "فيديو" : block.mediaType === "audio" ? "صوت" : block.mediaType === "image" ? "صورة" : "ملف";
}

export function CourseLearningRoom(props: CourseLearningRoomProps) {
  const { sectionSlug, sectionTitle, course, courseNumber, completed, completionPending, completionDisabled, completionKnown,
    onComplete, onBack, progressRows, progressReady, progressError, onRetryProgress } = props;
  const contextKey = `course:${course.id}`;
  const { groups, lessons } = useMemo(() => {
    const grouped = groupCourseMaterials(course);
    const list: LessonEntry[] = [];
    const visibleGroups = grouped.groups.filter(group => group.lessons.length).map((group, unitIndex) => {
      const label = `الوحدة ${(unitIndex + 1).toLocaleString("ar")}`;
      group.lessons.forEach(lesson => list.push({ ...lesson, unitLabel: label }));
      return { ...group, label };
    });
    grouped.loose.forEach(lesson => list.push({ ...lesson, unitLabel: grouped.groups.length ? "دروس أخرى" : "" }));
    return { groups: visibleGroups, lessons: list, loose: grouped.loose };
  }, [course]);
  const loose = useMemo(() => lessons.filter(l => !groups.some(g => g.lessons.some(x => x.index === l.index))), [lessons, groups]);

  const [activeIndex, setActiveIndex] = useState(() => lessons[0]?.index ?? 0);
  const position = Math.max(0, lessons.findIndex(l => l.index === activeIndex));
  const active = lessons[position];
  const prev = lessons[position - 1];
  const next = lessons[position + 1];
  const stageRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    stageRef.current?.focus({ preventScroll: true });
    stageRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [activeIndex]);

  const trackableIds = new Set(lessons.flatMap(({ block }) => {
    if (block.type !== "media" || (block.mediaType !== "audio" && block.mediaType !== "video")) return [];
    const id = sectionMediaId(block.url);
    return id ? [id] : [];
  }));
  const courseRows = (progressRows ?? []).filter(row => row.contextKey === contextKey && trackableIds.has(row.mediaAssetId));
  const studySeconds = courseRows.reduce((sum, row) => sum + row.watchedSeconds, 0);
  const startedMedia = new Set(courseRows.filter(row => row.watchedSeconds > 0).map(row => row.mediaAssetId));
  const trackableCount = trackableIds.size;

  const renderStage = (block: SectionBlock) => {
    const mediaId = block.type === "media" ? sectionMediaId(block.url) : undefined;
    if (block.type === "media" && mediaId && (block.mediaType === "audio" || block.mediaType === "video" || block.mediaType === "file")) {
      return <TrackedSectionMedia
        progressReady={progressReady}
        progressError={progressError}
        onRetryProgress={onRetryProgress}
        sectionSlug={sectionSlug}
        contextKey={contextKey}
        mediaAssetId={mediaId}
        mediaType={block.mediaType}
        url={block.url}
        title={block.title}
        savedProgress={progressRows?.find(row => row.contextKey === contextKey && row.mediaAssetId === mediaId)}
      />;
    }
    if (block.type === "media") {
      if (block.mediaType === "image") return <img className="clr-image" src={block.url} alt={block.title}/>;
      if (block.mediaType === "video") return <video src={block.url} controls playsInline preload="metadata"/>;
      if (block.mediaType === "audio") return <audio src={block.url} controls preload="metadata"/>;
      if (block.mediaType === "file") return <div className="tracked-section-document"><iframe src={`${block.url}?preview=1`} title={`معاينة ${block.title}`} loading="lazy"/><a href={block.url} download><Download size={16}/> تنزيل الملف</a></div>;
      return null;
    }
    if (block.type === "link") return <div className="clr-paper-stage">
      <span className="clr-paper-icon"><ExternalLink size={22}/></span>
      <h3>{block.title}</h3>
      {block.body && <p>{block.body}</p>}
      <a className="button button-primary" href={block.url} target="_blank" rel="noopener noreferrer" data-testid={`link-open-lesson-${course.id}-${activeIndex}`}>فتح الرابط في نافذة جديدة <ExternalLink size={15}/></a>
    </div>;
    return <div className="clr-paper-stage clr-reading">
      <span className="clr-paper-icon"><FileText size={22}/></span>
      <h3>{block.title}</h3>
      {block.body ? <p>{block.body}</p> : <p className="clr-muted">لا يوجد نص لهذا الدرس.</p>}
    </div>;
  };

  const isPlayer = active?.block.type === "media" && (active.block.mediaType === "video" || active.block.mediaType === "image");

  const lessonButton = (lesson: LessonEntry, n: number) => {
    const isActive = lesson.index === activeIndex;
    const mediaId = lesson.block.type === "media" ? sectionMediaId(lesson.block.url) : undefined;
    const started = mediaId ? startedMedia.has(mediaId) : false;
    return <li key={lesson.index}>
      <button type="button" className={`clr-lesson ${isActive ? "is-active" : ""}`} aria-current={isActive ? "true" : undefined}
        onClick={() => setActiveIndex(lesson.index)} data-testid={`button-lesson-${course.id}-${lesson.index}`}>
        <span className="clr-lesson-num">{n.toLocaleString("ar")}</span>
        <span className="clr-lesson-copy"><b>{lesson.block.title}</b><small>{lessonIcon(lesson.block)} {lessonKind(lesson.block)}{started ? " · بدأت الاستماع/المشاهدة" : ""}</small></span>
      </button>
    </li>;
  };
  let counter = 0;

  return <section className="clr" aria-labelledby="clr-title" data-testid={`course-room-${course.id}`}>
    <div className="clr-topbar">
      <button type="button" className="clr-back" onClick={onBack} data-testid="button-back-to-courses"><ArrowRight size={16}/> العودة إلى الدورات</button>
      <span className="clr-crumb">{sectionTitle} · دورة {String(courseNumber).padStart(2, "0")}</span>
    </div>
    <header className="clr-head">
      <div>
        <h2 id="clr-title" data-testid="text-room-course-title">{course.title}</h2>
        {course.description && <p>{course.description}</p>}
      </div>
      {completed
        ? <span className="clr-done" data-testid={`course-completed-${course.id}`}><CheckCircle2 size={16}/> مكتملة في سجلّ تعلّمك</span>
        : <button type="button" className="button button-primary clr-complete" disabled={completionDisabled} onClick={onComplete} data-testid={`button-complete-course-${course.id}`}>
            {completionPending ? <><LoaderCircle size={16} className="custom-course-spinner"/> جارٍ التسجيل…</> : <><CheckCircle2 size={16}/> سجّل إكمال الدورة</>}
          </button>}
    </header>

    <div className="clr-layout">
      <div className="clr-main">
        {active ? <>
          <div ref={stageRef} tabIndex={-1} className={`clr-stage ${isPlayer ? "is-player" : ""} ${active.block.type === "media" ? `is-${active.block.mediaType}` : `is-${active.block.type}`}`} aria-label={`الدرس الحالي: ${active.block.title}`} data-testid={`course-stage-${course.id}`}>
            {renderStage(active.block)}
          </div>
          <div className="clr-lesson-head">
            <span className="clr-eyebrow">{active.unitLabel ? `${active.unitLabel} · ` : ""}الدرس {(position + 1).toLocaleString("ar")} من {lessons.length.toLocaleString("ar")}</span>
            <h3 data-testid="text-active-lesson-title">{active.block.title}</h3>
            {active.block.type === "media" && active.block.body && <p>{active.block.body}</p>}
          </div>
          <nav className="clr-pager" aria-label="التنقل بين الدروس">
            <button type="button" disabled={!prev} onClick={() => prev && setActiveIndex(prev.index)} data-testid="button-previous-lesson">
              <ChevronRight size={17}/><span><small>السابق</small><b>{prev?.block.title ?? "لا يوجد"}</b></span>
            </button>
            <button type="button" disabled={!next} onClick={() => next && setActiveIndex(next.index)} data-testid="button-next-lesson">
              <span><small>التالي</small><b>{next?.block.title ?? "نهاية الدورة"}</b></span><ChevronLeft size={17}/>
            </button>
          </nav>
        </> : <div className="clr-stage clr-empty" role="status">لا توجد مواد منشورة في هذه الدورة بعد.</div>}
      </div>

      <aside className="clr-side" aria-label="محتوى الدورة">
        <div className="clr-stats" data-testid="course-study-stats">
          <div><Clock3 size={16} aria-hidden="true"/><span><small>وقت الدراسة المسجّل</small>
            <b data-testid="text-study-time">{progressError ? "تعذّر التحميل" : !progressReady ? "جارٍ التحميل…" : formatDuration(studySeconds)}</b></span></div>
          <div><PlayCircle size={16} aria-hidden="true"/><span><small>مقاطع بدأتها</small>
            <b>{progressReady ? `${startedMedia.size.toLocaleString("ar")} من ${trackableCount.toLocaleString("ar")}` : "—"}</b></span></div>
          <p className="clr-note">الوقت يحسب التشغيل الفعلي فقط، ولا يعني إكمال الدورة. الإكمال يُسجَّل بزر «سجّل إكمال الدورة»{completionKnown ? "" : " بعد تحميل سجلّك"}.</p>
          {progressError && <button type="button" className="clr-retry" onClick={onRetryProgress} data-testid="button-retry-room-progress">إعادة المحاولة</button>}
        </div>
        <div className="clr-units">
          {groups.map(group => <section key={group.unit.id} className="clr-unit" data-testid={`course-unit-${group.unit.id}`}>
            <h4><FolderOpen size={14} aria-hidden="true"/> {group.label}: {group.unit.title}</h4>
            {group.unit.description && <p>{group.unit.description}</p>}
            <ol>{group.lessons.map(lesson => lessonButton({ ...lesson, unitLabel: group.label }, ++counter))}</ol>
          </section>)}
          {loose.length > 0 && <section className="clr-unit" data-testid={`course-loose-${course.id}`}>
            {groups.length > 0 && <h4>دروس أخرى</h4>}
            <ol>{loose.map(lesson => lessonButton(lesson, ++counter))}</ol>
          </section>}
        </div>
      </aside>
    </div>
  </section>;
}
