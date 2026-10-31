import { motion } from 'framer-motion';
import { IMG } from '../data';
import { EASE, Figure, GOLD, Logos, MUTED, NAVY, PAPER, Rule, Title } from '../Kit';

export function Credits({ delay, color, label }: { delay: number; color: string; label: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.7, ease: EASE }}
      style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.2vmin 3vmin', fontSize: '2.6vmin', color, marginTop: '4vmin' }}>
      <span style={{ color: GOLD }}>{label}</span><span>محمد الجرايحي محمد الإمام</span>
      <span style={{ color: GOLD }}>إشراف</span><span>Taha Mahmoud Metwally Nour El-Dein</span>
    </motion.div>
  );
}

export function Cover() {
  return (
    <motion.div dir="rtl" className="absolute inset-0 grain" style={{ background: PAPER, overflow: 'hidden' }} exit={{ opacity: 0, transition: { duration: 0.6 } }}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '1.2vmin', background: GOLD }} />
      <Figure src={IMG('ai-cover.png')} delay={0.5} style={{ left: '7%', top: '12%', width: '36%', height: '76%' }} />
      <div style={{ position: 'absolute', right: '7%', top: '12%', width: '48%' }}>
        <motion.img src={IMG('athar-wordmark-3d.png')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }} style={{ height: '13vmin', display: 'block' }} />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ color: MUTED, fontSize: '2vmin', letterSpacing: '0.05em', margin: '2vmin 0 0.5vmin' }}>عرض مشروع للمناقشة</motion.div>
        <Title text="أثر | من التعلّم إلى الإنجاز" delay={0.7} size={6.8} />
        <Rule delay={1.4} width="26%" />
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7, duration: 0.7 }} style={{ fontSize: '3.2vmin', color: NAVY, margin: 0 }}>منصة تجمع التعلّم والإنجازات والاستعداد المهني</motion.p>
        <Credits delay={2.4} color={NAVY} label="إعداد" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.4, duration: 0.7 }} style={{ marginTop: '4vmin' }}><Logos height={3.6} /></motion.div>
      </div>
    </motion.div>
  );
}
