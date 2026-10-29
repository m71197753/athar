import { ArrowLeft, BookOpen, CheckCircle2, ChevronDown, FileText, Search } from "lucide-react";
import "./_group.css";
import "./course-cards.css";

export function Current() {
  return <main className="course-preview current-course-preview" dir="rtl">
    <a className="custom-section-back" href="#dashboard"><ArrowLeft size={16}/> العودة لمساحة الطالب</a>
    <header className="custom-section-header custom-course-hero">
      <div className="custom-course-hero-copy">
        <span className="custom-section-kicker"><BookOpen size={15}/> وحدة من أثر</span>
        <h1>كورسات</h1>
        <p>تعلم بعض المهارات المهمة من خلال مواد الدورات المضافة للقسم.</p>
      </div>
      <span className="custom-course-hero-mark"><BookOpen size={31}/></span>
    </header>
    <section className="current-courses">
      <header className="current-courses-heading">
        <div><span className="custom-section-kicker"><BookOpen size={15}/> مسارك الدراسي</span><h2>الدورات</h2><p>افتح المواد، ثم سجّل ما أتممته في سجل تعلّمك.</p></div>
        <div className="current-completion"><strong>٠</strong><small>مكتملة</small></div>
      </header>
      <div className="current-tools">
        <label><Search size={17}/><input placeholder="ابحث في دوراتك وموادها" aria-label="ابحث في دوراتك وموادها"/></label>
        <div className="current-filters"><button className="is-active">الكل</button><button>غير مكتملة</button><button>مكتملة</button></div>
      </div>
      <p className="current-count">١ من ١ دورة</p>
      <article className="custom-course-card current-course-card">
        <div className="current-card-topline"><span className="current-number">01</span><span>دورة تعلّم</span></div>
        <div className="current-card-copy"><h3>عمل برزنتيشن على كانفا</h3><p>استخدام كانفا لعمل برزنتيشن</p></div>
        <details className="current-materials">
          <summary><span className="current-material-icon"><FileText size={16}/></span><span><b>استكشف مواد الدورة</b><small>١ مادة</small></span><ChevronDown size={17}/></summary>
          <a href="#file">ملف التطبيق <span>فتح الملف ↗</span></a>
        </details>
        <footer className="current-course-action"><button><CheckCircle2 size={16}/> سجّل إكمال الدورة</button></footer>
      </article>
    </section>
  </main>;
}
