// Source-grounded snapshot of the course card JSX from
// artifacts/athar-students/src/sections/CustomSectionPage.tsx before the
// dedicated learning room was introduced. Media rendered inside a collapsed
// <details> of a ~320px grid card, which made uploaded videos tiny.
const course = {
  id: "c1",
  title: "مدخل إلى تحليل البيانات",
  description: "أساسيات التعامل مع الجداول والمخططات.",
  skills: ["Excel", "التحليل", "العرض"],
  materials: [{ title: "المحاضرة الأولى" }, { title: "ملخص الوحدة" }],
};

export function Current() {
  return <main dir="rtl" style={{ maxWidth: 380, margin: 24, fontFamily: "Cairo, sans-serif" }}>
    <article style={{ border: "1px solid #DFE3EE", borderRadius: 20, overflow: "hidden", background: "#FFFFFF" }}>
      <div style={{ minHeight: 138, padding: 16, color: "#fff", background: "linear-gradient(130deg,#4338CA,#2E2A7A)" }}>
        <span>دورة 01</span> · <span>ابدأ التعلّم</span>
        <div style={{ fontSize: 9, marginTop: 70 }}>أثر · القسم</div>
      </div>
      <div style={{ padding: "14px 15px" }}>
        <small>{course.materials.length} مواد · دورة تعليمية</small>
        <h3 style={{ margin: "10px 0 4px" }}>{course.title}</h3>
        <p style={{ fontSize: 10 }}>{course.description}</p>
        <div style={{ display: "flex", gap: 5 }}>{course.skills.map(s => <span key={s} style={{ fontSize: 8 }}>{s}</span>)}</div>
      </div>
      <details style={{ borderTop: "1px solid #DFE3EE" }}>
        <summary style={{ padding: "10px 16px" }}>ابدأ الدورة — عرض المحتوى المتاح · فتح</summary>
        <div style={{ padding: 15 }}>{course.materials.map(m => <section key={m.title}>
          <h3>{m.title}</h3>
          <div style={{ aspectRatio: "16/9", background: "#0b1820", borderRadius: 12 }}/>
        </section>)}</div>
      </details>
      <footer style={{ padding: "12px 20px", borderTop: "1px solid #DFE3EE" }}><button type="button">سجّل إكمال الدورة</button></footer>
    </article>
  </main>;
}

export default Current;
