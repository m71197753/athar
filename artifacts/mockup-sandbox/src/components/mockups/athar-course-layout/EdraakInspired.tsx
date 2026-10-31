import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUpLeft, BookOpen, Check, CheckCircle2, ChevronDown, ChevronLeft,
  Clock3, FileText, GraduationCap, Play, Search, Sparkles, X,
} from "lucide-react";
import "./_group.css";
import "./edraak-inspired.css";

type Course = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  minutes: number;
  materials: { title: string; type: string }[];
  lesson: string;
  palette: "indigo" | "teal" | "amber";
};

const courses: Course[] = [
  {
    id: "ai",
    title: "مقدمة إلى الذكاء الاصطناعي",
    description: "افهم أساسيات الذكاء الاصطناعي، واكتشف كيف يغيّر طريقة تعلّمنا وعملنا.",
    skills: ["الذكاء الاصطناعي", "التفكير النقدي"],
    minutes: 45,
    materials: [{ title: "كيف يفكّر الذكاء الاصطناعي؟", type: "فيديو · ١٢ دقيقة" }, { title: "دليل المصطلحات الأساسية", type: "ملف قراءة" }, { title: "أسئلة للتأمل", type: "نشاط قصير" }],
    lesson: "تعرّف على الفكرة وراء الأنظمة الذكية، والفرق بين التعلّم الآلي والذكاء الاصطناعي.",
    palette: "indigo",
  },
  {
    id: "presentation",
    title: "عرضك التقديمي بثقة",
    description: "حوّل أفكارك إلى عرض واضح، وقدّمها بثقة أمام زملائك أو فريق العمل.",
    skills: ["التواصل", "العروض التقديمية"],
    minutes: 35,
    materials: [{ title: "من الفكرة إلى القصة", type: "فيديو · ٩ دقائق" }, { title: "قالب تخطيط العرض", type: "ملف تطبيق" }],
    lesson: "ابدأ بتحديد الفكرة الرئيسية، ثم رتّب نقاطك في قصة قصيرة يسهل تذكّرها.",
    palette: "teal",
  },
  {
    id: "career",
    title: "خطواتك الأولى نحو المسار المهني",
    description: "اكتشف نقاط قوتك، وحدّد خطوة عملية تقرّبك من مستقبلك المهني.",
    skills: ["التخطيط المهني", "معرفة الذات"],
    minutes: 50,
    materials: [{ title: "ما الذي يهمّك في العمل؟", type: "قراءة · ٨ دقائق" }, { title: "خريطة مهاراتي", type: "ورقة عمل" }, { title: "من أين أبدأ؟", type: "فيديو · ١١ دقيقة" }],
    lesson: "في هذا الدرس، ستربط بين ما تجيده وما ترغب في تعلّمه لتختار خطوتك التالية.",
    palette: "amber",
  },
];

type Filter = "all" | "incomplete" | "completed";

export function EdraakInspired() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [completed, setCompleted] = useState<string[]>(["presentation"]);
  const [openCourse, setOpenCourse] = useState<Course | null>(null);

  const visibleCourses = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("ar");
    return courses.filter(course => {
      const isDone = completed.includes(course.id);
      const matchesFilter = filter === "all" || (filter === "completed" ? isDone : !isDone);
      const matchesSearch = !normalized || `${course.title} ${course.description} ${course.skills.join(" ")} ${course.materials.map(item => item.title).join(" ")}`.toLocaleLowerCase("ar").includes(normalized);
      return matchesFilter && matchesSearch;
    });
  }, [search, filter, completed]);

  const toggleComplete = (id: string) => {
    setCompleted(current => current.includes(id) ? current : [...current, id]);
  };

  return (
    <main className="course-preview ei-page" dir="rtl">
      <nav className="ei-topbar" aria-label="التنقل">
        <a className="ei-brand" href="#catalog" aria-label="أثر">
          <span className="ei-brand-mark"><BookOpen size={18} strokeWidth={2.4} /></span>
          <span>أثر<small>تعلّم ينمّي أثرك</small></span>
        </a>
        <div className="ei-topbar-right">
          <span className="ei-nav-label">مساحة التعلّم</span>
          <span className="ei-avatar" aria-label="الطالب">م</span>
        </div>
      </nav>

      <a className="ei-back" href="#dashboard"><ArrowLeft size={15} /> العودة لمساحة الطالب</a>

      <header className="ei-hero" id="catalog">
        <div className="ei-hero-copy">
          <span className="ei-eyebrow"><span className="ei-eyebrow-dot" /> وحدة من أثر <span className="ei-eyebrow-sep">/</span> تعلّم مهارات للمستقبل</span>
          <h1>المهارات الرقمية</h1>
          <p>مساحة عملية لتكتشف أدوات جديدة، وتطوّر مهارات تساعدك في دراستك وخطوتك المهنية القادمة.</p>
          <div className="ei-hero-meta">
            <span><BookOpen size={15} /> {courses.length.toLocaleString("ar")} دورات مختارة</span>
            <span><Clock3 size={15} /> تعلّم على وقتك</span>
          </div>
        </div>
        <div className="ei-hero-art" aria-hidden="true">
          <span className="ei-art-orbit orbit-one" /><span className="ei-art-orbit orbit-two" />
          <span className="ei-art-spark"><Sparkles size={21} /></span>
          <span className="ei-art-book"><BookOpen size={41} strokeWidth={1.4} /></span>
          <span className="ei-art-dot dot-one" /><span className="ei-art-dot dot-two" />
          <span className="ei-art-caption">خطوة صغيرة<br />تفتح أفقًا جديدًا</span>
        </div>
      </header>

      <section className="ei-catalog" aria-labelledby="ei-catalog-title">
        <header className="ei-section-heading">
          <div>
            <span className="ei-section-kicker"><GraduationCap size={16} /> مسارك الدراسي</span>
            <h2 id="ei-catalog-title">دورات هذا القسم</h2>
            <p>اختر دورة تناسب خطوتك القادمة، وتابع التعلّم بالوتيرة التي تناسبك.</p>
          </div>
          <div className="ei-progress" aria-label={`أكملت ${completed.length} من ${courses.length} دورات`}>
            <span className="ei-progress-icon"><Check size={14} /></span>
            <strong>{completed.length.toLocaleString("ar")}<small> / {courses.length.toLocaleString("ar")}</small></strong>
            <span className="ei-progress-label">دورات مكتملة</span>
            <span className="ei-progress-track"><i style={{ width: `${completed.length / courses.length * 100}%` }} /></span>
          </div>
        </header>

        <div className="ei-toolbar">
          <label className="ei-search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث في الدورات والمواد..." aria-label="ابحث في الدورات والمواد" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="مسح البحث"><X size={15} /></button>}
          </label>
          <div className="ei-filters" role="group" aria-label="تصفية الدورات">
            {([["all", "كل الدورات"], ["incomplete", "قيد التعلّم"], ["completed", "مكتملة"]] as [Filter, string][]).map(([value, label]) =>
              <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>,
            )}
          </div>
        </div>
        <div className="ei-results" aria-live="polite">
          <span><b>{visibleCourses.length.toLocaleString("ar")}</b> من {courses.length.toLocaleString("ar")} دورات</span>
          {search && <span>نتائج البحث عن «{search}»</span>}
        </div>

        {visibleCourses.length ? <div className="ei-grid">
          {visibleCourses.map((course, index) => {
            const isDone = completed.includes(course.id);
            return <article className={`ei-card tone-${course.palette}`} key={course.id}>
              <div className="ei-cover">
                <span className="ei-course-index">دورة {String(index + 1).padStart(2, "0")}</span>
                <span className={`ei-status ${isDone ? "done" : ""}`}>{isDone ? <><Check size={12} /> مكتملة</> : "ابدأ التعلّم"}</span>
                <div className="ei-cover-art" aria-hidden="true">
                  {course.palette === "indigo" ? <><span className="ei-cover-sun" /><span className="ei-cover-stack"><i /><i /><i /></span><Sparkles size={19} className="cover-spark" /></>
                    : course.palette === "teal" ? <><span className="ei-cover-shape shape-a" /><span className="ei-cover-shape shape-b" /><span className="ei-cover-window"><i /><i /><i /></span></>
                      : <><span className="ei-cover-path" /><span className="ei-cover-star"><Sparkles size={28} /></span><span className="ei-cover-step step-a" /><span className="ei-cover-step step-b" /></>}
                </div>
                <span className="ei-cover-foot">أثر <i /> {course.title}</span>
              </div>
              <div className="ei-card-content">
                <div className="ei-card-meta"><span><FileText size={13} /> {course.materials.length.toLocaleString("ar")} مواد</span><span><Clock3 size={13} /> {course.minutes.toLocaleString("ar")} دقيقة</span></div>
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <div className="ei-tags">{course.skills.map(skill => <span key={skill}>{skill}</span>)}</div>
              </div>
              <button className="ei-open" type="button" onClick={() => setOpenCourse(course)} aria-label={`${isDone ? "راجع" : "تابع"} دورة ${course.title}`}>
                <span className="ei-open-icon"><Play size={15} fill="currentColor" /></span>
                <span className="ei-open-copy"><b>{isDone ? "راجع مواد الدورة" : "تابع التعلّم"}</b><small>افتح قاعة الدرس</small></span>
                <span className="ei-open-cta">فتح <ChevronLeft size={15} /></span>
              </button>
              <footer className="ei-card-footer">
                {isDone ? <span className="ei-record"><CheckCircle2 size={15} /> أُضيفت إلى سجلّ تعلّمك</span>
                  : <button type="button" className="ei-complete" onClick={() => toggleComplete(course.id)}><CheckCircle2 size={15} /> سجّل إكمال الدورة</button>}
              </footer>
            </article>;
          })}
        </div> : <section className="ei-empty" role="status">
          <span className="ei-empty-icon"><Search size={21} /></span>
          <h3>لا توجد دورات مطابقة</h3>
          <p>جرّب عبارة بحث أخرى أو غيّر التصفية لتجد ما تبحث عنه.</p>
          <button type="button" onClick={() => { setSearch(""); setFilter("all"); }}>عرض كل الدورات</button>
        </section>}
      </section>
      <footer className="ei-footer"><span />كل تجربة تعلّم تفتح لك بابًا<span /></footer>

      {openCourse && <div className="ei-modal-backdrop" role="presentation" onClick={() => setOpenCourse(null)}>
        <section className="ei-room" role="dialog" aria-modal="true" aria-labelledby="ei-room-title" onClick={event => event.stopPropagation()}>
          <header className="ei-room-head">
            <div><span className="ei-section-kicker"><BookOpen size={15} /> المهارات الرقمية · قاعة الدرس</span><h2 id="ei-room-title">{openCourse.title}</h2><p>{openCourse.description}</p></div>
            <button type="button" className="ei-close" onClick={() => setOpenCourse(null)} aria-label="إغلاق"><X size={19} /></button>
          </header>
          <div className="ei-room-body">
            <div className={`ei-lesson-stage tone-${openCourse.palette}`}>
              <span className="ei-stage-play"><Play size={27} fill="currentColor" /></span>
              <span className="ei-stage-label">الدرس الأول · مدخل إلى الموضوع</span>
            </div>
            <div className="ei-lesson-info"><span>الدرس ١ من {openCourse.materials.length.toLocaleString("ar")}</span><h3>{openCourse.materials[0]?.title}</h3><p>{openCourse.lesson}</p></div>
            <div className="ei-syllabus">
              <div className="ei-syllabus-title"><b>مواد الدورة</b><span>{openCourse.materials.length.toLocaleString("ar")} مواد <ChevronDown size={15} /></span></div>
              {openCourse.materials.map((material, itemIndex) => <div className={`ei-material ${itemIndex === 0 ? "selected" : ""}`} key={material.title}>
                <span className="ei-material-number">{(itemIndex + 1).toLocaleString("ar")}</span><span className="ei-material-copy"><b>{material.title}</b><small>{material.type}</small></span>{itemIndex === 0 && <Play size={14} />}
              </div>)}
            </div>
          </div>
          <footer className="ei-room-footer">
            <button type="button" className="ei-room-back" onClick={() => setOpenCourse(null)}><ArrowLeft size={15} /> العودة للدورات</button>
            {completed.includes(openCourse.id) ? <span className="ei-record"><CheckCircle2 size={16} /> مكتملة في سجلّ تعلّمك</span>
              : <button type="button" className="ei-complete" onClick={() => toggleComplete(openCourse.id)}><CheckCircle2 size={15} /> سجّل إكمال الدورة</button>}
          </footer>
        </section>
      </div>}
    </main>
  );
}
