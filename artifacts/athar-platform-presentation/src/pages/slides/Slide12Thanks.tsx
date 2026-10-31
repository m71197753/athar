import nordpointsLogo from '@assets/0_nordpoints-logo_1793462640171.svg';
import replitMark from '@assets/1_تنزيل_1793462640171.png';

const base = import.meta.env.BASE_URL;
export default function Slide12Thanks() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame closing">
    <div className="closing-grid">
      <div className="closing-copy">
        <img src={base + "athar-wordmark-3d.png"} crossOrigin="anonymous" className="athar-mark" alt="أثر" />
        <h1 className="closing-title">شكرًا لكم</h1>
        <p className="closing-tagline">أثر | تعلّم، وثّق، وانطلق</p>
        <div className="credits"><p>إعداد: محمد الجرايحي محمد الإمام</p><p>إشراف: Taha Mahmoud Metwally Nour El-Dein</p></div>
        <div className="logo-row">
          <span className="logo-surface replit-lockup"><img src={replitMark} crossOrigin="anonymous" alt="Replit"/><span>Replit</span></span>
          <span className="logo-surface nordpoints-lockup"><img src={nordpointsLogo} crossOrigin="anonymous" alt="Nordpoints"/></span>
        </div>
      </div>
      <img src={base + "ai-cover.png"} crossOrigin="anonymous" className="closing-art" alt="طالب يستعد لرحلته التعليمية والمهنية" />
    </div>
  </div>;
}