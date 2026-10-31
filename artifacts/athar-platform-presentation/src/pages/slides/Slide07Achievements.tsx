const base = import.meta.env.BASE_URL;
export default function Slide07Achievements() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame">
    <div className="content-head"><h1 className="slide-title">إنجازات موثّقة وخصوصية واضحة</h1></div>
    <div className="feature-layout">
      <img src={base + "ai-achievement.png"} crossOrigin="anonymous" className="feature-art" alt="ملف إنجاز رقمي يضم مستندات وصورًا وروابط مع حماية" />
      <div className="feature-copy">
        <ul className="bullet-list">
          <li>سجّل إنجازك وأضف وصفًا أو رابطًا أو مرفقًا</li>
          <li>احتفظ بأدلتك في مساحة مرتبطة بحسابك</li>
          <li>يراجع الطالب والإدارة الأدلة؛ لا تظهر لبقية الطلاب</li>
        </ul>
      </div>
    </div>
  </div>;
}