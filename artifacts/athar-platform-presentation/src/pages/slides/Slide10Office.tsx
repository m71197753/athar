const base = import.meta.env.BASE_URL;
export default function Slide10Office() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame">
    <div className="content-head"><h1 className="slide-title">مستندات وجداول داخل المنصة</h1></div>
    <div className="feature-layout">
      <div className="feature-copy accent-panel"><ul className="bullet-list">
        <li>أنشئ مستندات وجداول في مساحة الطالب</li>
        <li>نسّق النصوص والعناوين والقوائم</li>
        <li>استخدم صيغًا حسابية ومراجع خلايا أساسية</li>
        <li>احفظ تلقائيًا وصدّر إلى DOCX أو XLSX</li>
      </ul></div>
      <img src={base + "ai-office.png"} crossOrigin="anonymous" className="office-art" alt="مستند نصي وجدول بيانات على شاشة حاسوب" />
    </div>
  </div>;
}