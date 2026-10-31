import { motion } from 'framer-motion';
import { IMG } from '../data';
import { EASE, Line, Shell, Words } from '../Kit';

export function Solution() {
  return (
    <Shell bg="#f3ecdf">
      <motion.div initial={{ clipPath: 'circle(0% at 50% 50%)', scale: 1.3 }} animate={{ clipPath: 'circle(50% at 50% 50%)', scale: 1 }} transition={{ delay: 0.15, duration: 1.1, ease: EASE }}
        style={{ position: 'absolute', left: '5%', top: '12%', width: '76vmin', height: '76vmin' }}>
        <img src={IMG('ai-solution.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </motion.div>
      <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.5, duration: 1.4, ease: EASE }}
        style={{ position: 'absolute', left: 'calc(5% - 2vmin)', top: 'calc(12% - 2vmin)', width: '80vmin', height: '80vmin', borderRadius: '50%', border: '0.5vmin dashed #e9a23b' }} />
      <div style={{ position: 'absolute', right: '6%', top: '20%', width: '46%' }}>
        <Words text="الحل: مساحة واحدة باسم أثر" delay={0.4} className="disp" style={{ fontSize: '8vmin', color: '#191c45' }} />
        <div style={{ marginTop: '4vmin', display: 'flex', flexDirection: 'column', gap: '2vmin' }}>
          {['يجمع أثر التعلّم والإنجازات والسيرة والخطة المهنية', 'يساعد الطالب على توثيق تقدّمه في مكان واحد', 'يربط التعلّم بخطوات مهنية قابلة للمتابعة'].map((t, i) => (
            <Line key={i} delay={1.3 + i * 0.85} color="#191c45" dot="#e0603f">{t}</Line>
          ))}
        </div>
      </div>
    </Shell>
  );
}
