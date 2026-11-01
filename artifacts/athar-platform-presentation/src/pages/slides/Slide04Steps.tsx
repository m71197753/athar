const base = import.meta.env.BASE_URL;
const steps = [
  ["١", "athar-step-profile.png", "أنشئ حسابك وأكمل ملفك الشخصي"],
  ["٢", "athar-step-learning.png", "اختر دورة أو مسارًا وواصل التعلّم"],
  ["٣", "athar-step-evidence.png", "أضف إنجازاتك وارفق الأدلة المناسبة"],
  ["٤", "athar-step-career.png", "أنشئ سيرتك وخطّط لخطوتك المهنية التالية"],
];
export default function Slide04Steps() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame motif-path">
    <div className="content-head"><h1 className="slide-title">خطوات الحل داخل أثر</h1></div>
    <div className="journey">
      <div className="journey-line" />
      {steps.map(([n, img, t]) => <div className="station" key={n}>
        <img src={base + img} crossOrigin="anonymous" className="station-art" alt={t} />
        <span className="station-num">{n}</span>
        <p className="station-text">{t}</p>
      </div>)}
    </div>
  </div>;
}
