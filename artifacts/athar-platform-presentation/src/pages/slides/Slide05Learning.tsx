const base = import.meta.env.BASE_URL;
export default function Slide05Learning() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame">
    <div className="content-head"><h1 className="slide-title">تعلّم منظّم ودورات تفاعلية</h1></div>
    <div className="feature-layout">
      <img src={base + "ai-courses.png"} crossOrigin="anonymous" className="feature-art tall" alt="طالب يشاهد درسًا مرئيًا ويتابع وحدات الدورة" />
      <div className="feature-copy accent-panel"><ul className="bullet-list">
        <li>قسّم المحتوى إلى دورات ووحدات ودروس</li>
        <li>تابع الدروس المرئية وموضع تقدّمك</li>
        <li>تدرب بالاختبارات والأنشطة، وراجع نتائجك</li>
      </ul></div>
    </div>
  </div>;
}