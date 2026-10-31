import { motion } from 'framer-motion';
import { EASE, Shell, Words } from '../Kit';

const STEPS = ['أنشئ حسابك وأكمل ملفك الشخصي', 'اختر دورة أو مسارًا وواصل التعلّم', 'أضف إنجازاتك وارفق الأدلة المناسبة', 'أنشئ سيرتك وخطّط لخطوتك المهنية التالية'];
const NUMS = ['١', '٢', '٣', '٤'];
export function Steps() {
  return (
    <Shell bg="#e9a23b">
      <div style={{ position: 'absolute', right: '6%', top: '10%' }}>
        <Words text="خطوات الحل داخل أثر" delay={0.3} className="disp" style={{ fontSize: '9vmin', color: '#191c45' }} />
      </div>
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ position: 'absolute', left: '5%', width: '90%', top: '44%', height: '14%' }}>
        <motion.path d="M1000 100 C 850 20, 700 180, 520 100 S 180 20, 0 100" fill="none" stroke="#191c45" strokeWidth="5" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 4.4, ease: 'easeInOut' }} />
      </svg>
      {STEPS.map((s, i) => (
        <div key={i} style={{ position: 'absolute', right: `${7 + i * 23}%`, top: '42%', width: '20%' }}>
          <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 1.2 + i * 1.2, type: 'spring', stiffness: 280, damping: 13 }}
            className="disp" style={{ width: '13vmin', height: '13vmin', borderRadius: '50%', background: i % 2 ? '#e0603f' : '#191c45', color: '#f3ecdf', display: 'grid', placeItems: 'center', fontSize: '7vmin' }}>{NUMS[i]}</motion.div>
          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.45 + i * 1.2, duration: 0.6, ease: EASE }}
            style={{ fontSize: '3vmin', fontWeight: 600, color: '#191c45', marginTop: '3vmin', lineHeight: 1.45 }}>{s}</motion.p>
        </div>
      ))}
    </Shell>
  );
}
