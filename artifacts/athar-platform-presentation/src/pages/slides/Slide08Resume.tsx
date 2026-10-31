const base = import.meta.env.BASE_URL;
export default function Slide08Resume() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame">
    <div className="content-head"><h1 className="slide-title">سيرة ذاتية تناسب هدفك</h1></div>
    <div className="resume-layout">
      <img src={base + "ai-resume.png"} crossOrigin="anonymous" className="resume-banner" alt="محرر سيرة ذاتية من عمود واحد مع أدوات تخصيص" />
      <div className="resume-points">
        <p className="resume-point">اختر قالبًا موجّهًا لـ ATS أو قالبًا مهنيًا</p>
        <p className="resume-point">خصّص الخط والحجم والألوان من داخل السيرة</p>
        <p className="resume-point">قارن مهاراتك بمتطلبات وظيفة مستهدفة</p>
        <p className="resume-point">راجع المحتوى بنفسك؛ التوافق لا يضمن القبول</p>
      </div>
    </div>
  </div>;
}