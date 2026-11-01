import nordpointsLogo from '@assets/nordpoints-logo_1793472713140.svg';
import replitMark from '@assets/تنزيل_1793472713137.png';
import closingArtwork from '@assets/generated_images/athar-thanks.png';

const base = import.meta.env.BASE_URL;
export default function Slide12Thanks() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame motif-rise closing">
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
      <img src={closingArtwork} crossOrigin="anonymous" className="closing-art" alt="خريج عربي يستعد للانطلاق إلى مساره المهني" />
    </div>
  </div>;
}