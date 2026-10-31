const base = import.meta.env.BASE_URL;
export default function Slide06Languages() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame language-slide">
    <img src={base + "ai-language.png"} crossOrigin="anonymous" className="fullbleed-img" alt="طالب يتدرب على لغة جديدة باستخدام بطاقات وسماعات" />
    <div className="fullbleed-overlay" aria-hidden="true"></div>
    <div className="language-content">
      <h1 className="slide-title">تعلّم اللغات بالممارسة</h1>
      <ul className="bullet-list">
        <li>تدرب على المفردات والاستماع والمحادثة</li>
        <li>راجع ما تعلمته وتابع تقدمك</li>
        <li>اجعل الممارسة جزءًا ثابتًا من رحلتك التعليمية</li>
      </ul>
    </div>
  </div>;
}