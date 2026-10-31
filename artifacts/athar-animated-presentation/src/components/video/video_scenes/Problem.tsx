import { motion } from 'framer-motion';
import { IMG } from '../data';
import { EASE, Shell, Words } from '../Kit';

const CARDS = [
  { t: 'التعلّم والإنجازات والسيرة موزعة بين أدوات مختلفة', x: '6%', y: '30%', r: -7, d: 1.4 },
  { t: 'صعب متابعة التقدم وتحويل الخبرات إلى قصة مهنية واضحة', x: '20%', y: '52%', r: 5, d: 2.5 },
  { t: 'ملفات الطالب وأدلته تحتاج تنظيمًا وخصوصية', x: '4%', y: '74%', r: -3, d: 3.6 },
];
export function Problem() {
  return (
    <Shell bg="#191c45">
      <motion.img src={IMG('ai-problem.png')} initial={{ opacity: 0, scale: 1.3, rotate: 8 }} animate={{ opacity: 1, scale: 1, rotate: 4 }} transition={{ delay: 0.3, duration: 1.2, ease: EASE }}
        style={{ position: 'absolute', right: '6%', bottom: '8%', width: '34%', borderRadius: '3vmin', border: '1vmin solid #e9a23b' }} />
      <div style={{ position: 'absolute', right: '6%', top: '9%', width: '60%' }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ color: '#e9a23b', fontSize: '2.2vmin', letterSpacing: '0.2em' }}>٠٢</motion.div>
        <Words text="المشكلة: رحلة الطالب متفرقة" delay={0.3} className="disp" style={{ fontSize: '9vmin', color: '#f3ecdf' }} />
      </div>
      {CARDS.map((c, i) => (
        <motion.div key={i} initial={{ opacity: 0, scale: 0.6, rotate: c.r * 3, y: 60 }}
          animate={{ opacity: 1, scale: 1, rotate: [c.r * 3, c.r, c.r, 0], y: 0 }}
          transition={{ delay: c.d, duration: 0.7, ease: EASE, rotate: { delay: c.d, duration: 5 - c.d, times: [0, 0.2, 0.75, 1] } }}
          style={{ position: 'absolute', left: c.x, top: c.y, maxWidth: '44%', background: i === 1 ? '#e0603f' : '#f3ecdf', color: i === 1 ? '#fff8ef' : '#191c45',
            padding: '2vmin 3vmin', borderRadius: '2vmin', fontSize: '3.2vmin', fontWeight: 600, boxShadow: '0 2vmin 4vmin rgba(5,6,30,.35)' }}>{c.t}</motion.div>
      ))}
    </Shell>
  );
}
