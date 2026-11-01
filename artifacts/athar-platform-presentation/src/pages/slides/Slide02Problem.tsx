const base = import.meta.env.BASE_URL;
export default function Slide02Problem() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame motif-scatter">
    <div className="content-head"><h1 className="slide-title">المشكلة: رحلة الطالب متفرقة</h1></div>
    <div className="problem-points">
      <p className="problem-point">التعلّم والإنجازات والسيرة موزعة بين أدوات مختلفة</p>
      <p className="problem-point">صعب متابعة التقدم وتحويل الخبرات إلى قصة مهنية واضحة</p>
      <p className="problem-point">ملفات الطالب وأدلته تحتاج تنظيمًا وخصوصية</p>
    </div>
    <img src={base + "ai-problem.png"} crossOrigin="anonymous" className="problem-art" alt="أوراق وملفات طالب غير منظمة" />
  </div>;
}