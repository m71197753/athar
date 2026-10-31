import { motion } from 'framer-motion';
import { IMG } from '../data';
import { Figure, GOLD, Logos, NAVY, Rule, Title } from '../Kit';
import { Credits } from './Cover';

export function Thanks() {
  return (
    <motion.div dir="rtl" className="absolute inset-0 grain" style={{ background: NAVY, overflow: 'hidden' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }} transition={{ duration: 0.6 }}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '1.2vmin', background: GOLD }} />
      <Figure src={IMG('ai-thanks.png')} style={{ left: '7%', top: '12%', width: '36%', height: '76%' }} />
      <div style={{ position: 'absolute', right: '7%', top: '14%', width: '48%' }}>
        <motion.img src={IMG('athar-wordmark-3d.png')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }} style={{ height: '11vmin', display: 'block' }} />
        <Title text="شكرًا لكم" delay={0.6} size={12} color="#f6f3ec" />
        <Rule delay={1.2} width="26%" />
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.7 }} style={{ fontSize: '3.4vmin', color: GOLD, margin: 0 }}>أثر | تعلّم، وثّق، وانطلق</motion.p>
        <Credits delay={2} color="#f6f3ec" label="إعداد" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.8, duration: 0.7 }} style={{ marginTop: '4vmin' }}><Logos height={3.4} dark /></motion.div>
      </div>
    </motion.div>
  );
}
