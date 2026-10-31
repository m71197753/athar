import { motion } from 'framer-motion';
import { EASE, Frame, GOLD, NAVY, MUTED, Rule, Title } from '../Kit';

const STEPS = ['أنشئ حسابك وأكمل ملفك الشخصي', 'اختر دورة أو مسارًا وواصل التعلّم', 'أضف إنجازاتك وارفق الأدلة المناسبة', 'أنشئ سيرتك وخطّط لخطوتك المهنية التالية'];
export function Steps() {
  return (
    <Frame num="٠٤" section="منهجية الاستخدام">
      <div style={{ position: 'absolute', right: '7%', top: '21%', left: '7%' }}>
        <Title text="خطوات الحل داخل أثر" />
        <Rule />
      </div>
      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1, duration: 4.4, ease: 'easeInOut' }}
        style={{ position: 'absolute', right: '9%', left: '9%', top: '52.5%', height: '0.25vmin', background: GOLD, transformOrigin: 'right' }} />
      {STEPS.map((s, i) => (
        <div key={i} style={{ position: 'absolute', right: `${7 + i * 22}%`, top: '47%', width: '19%' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2 + i * 1.2, duration: 0.6, ease: EASE }}
            className="disp" style={{ width: '10vmin', height: '10vmin', borderRadius: '50%', background: NAVY, color: '#f6f3ec', border: `0.4vmin solid ${GOLD}`,
              display: 'grid', placeItems: 'center', fontSize: '5vmin' }}>{'١٢٣٤'[i]}</motion.div>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 + i * 1.2, duration: 0.6, ease: EASE }}
            style={{ fontSize: '3.2vmin', fontWeight: 600, color: NAVY, marginTop: '3vmin', lineHeight: 1.5 }}>{s}
            <span style={{ display: 'block', color: MUTED, fontSize: '2.1vmin', fontWeight: 400, marginTop: '1vmin' }}>الخطوة {'١٢٣٤'[i]}</span></motion.p>
        </div>
      ))}
    </Frame>
  );
}
