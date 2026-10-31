import nordpointsLogo from '@assets/nordpoints-logo_1793472713140.svg';
import replitMark from '@assets/تنزيل_1793472713137.png';

const base = import.meta.env.BASE_URL;
export default function Slide01Cover() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame cover">
    <div className="cover-grid">
      <div className="cover-copy">
        <img src={base + "athar-wordmark-3d.png"} crossOrigin="anonymous" className="athar-mark" alt="أثر" />
        <h1 className="cover-title">أثر | من التعلّم إلى الإنجاز</h1>
        <p className="cover-subtitle">منصة تجمع التعلّم والإنجازات والاستعداد المهني</p>
        <div className="credits"><p>إعداد: محمد الجرايحي محمد الإمام</p><p>إشراف: Taha Mahmoud Metwally Nour El-Dein</p></div>
        <div className="logo-row">
          <span className="logo-surface replit-lockup"><img src={replitMark} crossOrigin="anonymous" alt="Replit"/><span>Replit</span></span>
          <span className="logo-surface nordpoints-lockup"><img src={nordpointsLogo} crossOrigin="anonymous" alt="Nordpoints"/></span>
        </div>
      </div>
      <img src={base + "ai-cover.png"} crossOrigin="anonymous" className="cover-art" alt="طالب يستخدم الهاتف والحاسوب في مساحة تعلم مهنية" />
    </div>
  </div>;
}