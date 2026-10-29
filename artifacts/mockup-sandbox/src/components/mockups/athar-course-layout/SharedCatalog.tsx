import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, CheckCircle2, ChevronDown, Clock3, FileText, Search, Sparkles } from "lucide-react";
import "./_group.css";
import "./course-cards.css";

const courses = [
  {
    id: "presentation",
    title: "أساسيات إعداد العرض التقديمي",
    description: "خطوات عملية لترتيب أفكارك وبناء عرض واضح يسهل متابعته.",
    skills: ["تنظيم الأفكار", "التواصل", "العرض التقديمي"],
    materials: ["ملف تخطيط العرض", "قائمة مراجعة قبل التقديم"],
    accent: "#4F46E5",
    completed: false,
  },
  {
    id: "canva",
    title: "تصميم عرضك على Canva",
    description: "حوّل محتواك إلى شرائح مرتبة باستخدام قوالب وأدوات التصميم.",
    skills: ["التصميم", "Canva", "إعداد العروض"],
    materials: ["دليل البدء", "ملف التطبيق"],
    accent: "#0F766E",
    completed: true,
  },
  {
    id: "speaking",
    title: "تقديم العرض بثقة",
    description: "تدرّب على افتتاح العرض، الانتقال بين الأفكار، والإجابة عن الأسئلة.",
    skills: ["التحدث أمام الجمهور", "إدارة الوقت"],
    materials: ["خطة تدريب قصيرة"],
    accent: "#B45309",
    completed: false,
  },
];

export function SharedCatalog() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("الكل");
  const filteredCourses = useMemo(() => courses.filter(course => {
    const matchesSearch = `${course.title} ${course.description} ${course.skills.join(" ")}`.toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar"));
    const matchesFilter = filter === "الكل" || (filter === "مكتملة" ? course.completed : !course.completed);
    return matchesSearch && matchesFilter;
  }), [filter, search]);

  return <main className="course-preview shared-course-preview" dir="rtl">
    <a className="custom-section-back" href="#dashboard"><ArrowLeft size={16}/> العودة لمساحة الطالب</a>
    <header className="shared-course-hero">
      <div className="shared-course-hero-copy">
        <span className="shared-kicker"><Sparkles size={15}/> تعلّم بخطوات واضحة</span>
        <h1>كورسات</h1>
        <p>مسار يجمع المهارات والمواد في مكان واحد. اختر دورة وابدأ من أول خطوة.</p>
      </div>
      <div className="shared-hero-stat"><strong>{courses.length.toLocaleString("ar")}</strong><span>دورات متاحة</span></div>
      <div className="shared-hero-mark"><BookOpen size={31}/></div>
    </header>

    <section className="shared-catalog" aria-label="كتالوج الدورات">
      <div className="shared-catalog-heading">
        <div><span className="shared-kicker">مسارك الدراسي</span><h2>ابدأ التعلّم</h2><p>المحتوى المنشور في هذا القسم، مرتب لتختار ما يناسبك.</p></div>
        <div className="shared-progress"><strong>١ <small>/ {courses.length.toLocaleString("ar")}</small></strong><span>دورة مكتملة</span></div>
      </div>
      <div className="shared-tools">
        <label className="shared-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث باسم الدورة أو المهارة" aria-label="ابحث باسم الدورة أو المهارة"/></label>
        <div className="shared-filters" role="group" aria-label="تصفية الدورات">
          {["الكل", "غير مكتملة", "مكتملة"].map(value => <button key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{value}</button>)}
        </div>
      </div>
      <div className="shared-result-count">{filteredCourses.length.toLocaleString("ar")} من {courses.length.toLocaleString("ar")} دورات</div>
      <div className="shared-course-grid">
        {filteredCourses.map((course, index) => <article className={`shared-course-card ${course.completed ? "is-completed" : ""}`} key={course.id} style={{ "--course-accent": course.accent } as React.CSSProperties}>
          <div className="shared-course-cover">
            <span className="shared-course-number">دورة {String(index + 1).padStart(2, "0")}</span>
            {course.completed && <span className="shared-complete"><Check size={13}/> مكتملة</span>}
            <span className="shared-cover-art"><BookOpen size={29}/></span>
            <span className="shared-cover-caption">أثر · مسار مهارات</span>
          </div>
          <div className="shared-course-body">
            <div className="shared-course-meta"><span><FileText size={14}/> {course.materials.length.toLocaleString("ar")} مواد</span><span><Clock3 size={14}/> تعلّم ذاتي</span></div>
            <h3>{course.title}</h3>
            <p className="shared-course-description">{course.description}</p>
            <div className="shared-skill-tags">{course.skills.slice(0, 3).map(skill => <span key={skill}>{skill}</span>)}</div>
            <details className="shared-course-materials">
              <summary><span><b>{course.completed ? "راجع مواد الدورة" : "ابدأ الدورة"}</b><small>عرض المحتوى المتاح</small></span><ChevronDown size={17}/></summary>
              <div>{course.materials.map((material, materialIndex) => <a key={material} href={`#${course.id}-${materialIndex}`}><span className="shared-material-icon"><FileText size={15}/></span><span><b>{material}</b><small>مادة تعليمية</small></span><ArrowLeft size={15}/></a>)}</div>
            </details>
            <footer className="shared-course-footer">
              {course.completed
                ? <span className="shared-finished"><CheckCircle2 size={16}/> أُضيفت إلى سجل تعلّمك</span>
                : <button><BookOpen size={16}/> استكشف الدورة</button>}
            </footer>
          </div>
        </article>)}
      </div>
    </section>
  </main>;
}
