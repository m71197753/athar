const base = import.meta.env.BASE_URL;
export default function Slide03Solution() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame">
    <div className="content-head"><h1 className="slide-title">الحل: مساحة واحدة باسم أثر</h1></div>
    <div className="split-layout">
      <div className="accent-panel"><ul className="bullet-list">
        <li>يجمع أثر التعلّم والإنجازات والسيرة والخطة المهنية</li>
        <li>يساعد الطالب على توثيق تقدّمه في مكان واحد</li>
        <li>يربط التعلّم بخطوات مهنية قابلة للمتابعة</li>
      </ul></div>
      <img src={base + "ai-solution.png"} crossOrigin="anonymous" className="solution-art" alt="مساحة رقمية موحدة للتعلم والإنجاز والسيرة" />
    </div>
  </div>;
}