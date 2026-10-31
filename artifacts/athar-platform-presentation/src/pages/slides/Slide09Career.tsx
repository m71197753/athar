const base = import.meta.env.BASE_URL;
export default function Slide09Career() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame">
    <div className="content-head"><h1 className="slide-title">خطة مهنية بخطوات قابلة للتنفيذ</h1></div>
    <img src={base + "ai-career.png"} crossOrigin="anonymous" className="career-visual" alt="خريج يراجع أهدافًا وخطوات مهنية على جهاز لوحي" />
    <div className="career-path">
      <p className="career-step">حدّد هدفك المهني والمدة المناسبة</p>
      <p className="career-step">حوّل الهدف إلى مهام ومتابعة أسبوعية</p>
      <p className="career-step">استخدم التذكيرات للعودة إلى خطتك</p>
      <p className="career-step">استكشف مساحة الخريجين والفرص المهنية</p>
    </div>
  </div>;
}