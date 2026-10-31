import { motion } from 'framer-motion';
import nordpoints from '@assets/nordpoints-logo_1793472713140.svg';
import replit from '@assets/تنزيل_1793472713137.png';
import { IMG } from '../data';
import { BLOB, EASE, Words } from '../Kit';

export function Logos({ delay }: { delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.6, ease: EASE }}
      style={{ display: 'flex', gap: '1.6vmin', marginTop: '3vmin' }}>
      <span style={{ background: '#fbf6ee', borderRadius: '1.4vmin', padding: '1.2vmin 2vmin', display: 'flex', alignItems: 'center', gap: '1vmin', fontWeight: 600, fontSize: '2.6vmin', color: '#191c45', fontFamily: 'sans-serif' }}>
        <img src={replit} style={{ height: '3.6vmin' }} />Replit</span>
      <span style={{ background: '#fbf6ee', borderRadius: '1.4vmin', padding: '1.2vmin 2vmin', display: 'flex', alignItems: 'center' }}>
        <img src={nordpoints} style={{ height: '3.6vmin' }} /></span>
    </motion.div>
  );
}

export function Credits({ delay, color }: { delay: number; color: string }) {
  return (
    <div style={{ fontSize: '2.6vmin', color, marginTop: '3vmin', lineHeight: 1.6 }}>
      <motion.p initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.5, ease: EASE }} style={{ margin: 0 }}>إعداد: محمد الجرايحي محمد الإمام</motion.p>
      <motion.p initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + 0.4, duration: 0.5, ease: EASE }} style={{ margin: 0 }}>إشراف: Taha Mahmoud Metwally Nour El-Dein</motion.p>
    </div>
  );
}

export function Cover() {
  return (
    <motion.div dir="rtl" className="absolute inset-0 grain" style={{ background: '#f3ecdf', overflow: 'hidden' }}
      exit={{ opacity: 0, scale: 1.15, filter: 'blur(12px)', transition: { duration: 0.55 } }}>
      <motion.div initial={{ scale: 0.3, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 1.2, ease: EASE }}
        style={{ position: 'absolute', left: '4%', top: '8%', width: '44%', height: '84%' }}>
        <motion.div animate={{ scale: [1, 1.06] }} transition={{ duration: 6, ease: 'linear' }} style={{ width: '100%', height: '100%', clipPath: BLOB, background: '#e9a23b' }}>
          <img src={IMG('ai-cover.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </motion.div>
      </motion.div>
      <div style={{ position: 'absolute', right: '6%', top: '10%', width: '46%' }}>
        <motion.img src={IMG('athar-wordmark-3d.png')} initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 13 }}
          style={{ height: '17vmin', display: 'block' }} />
        <Words text="أثر | من التعلّم إلى الإنجاز" delay={0.7} className="disp" style={{ fontSize: '7.4vmin', color: '#191c45', marginTop: '2vmin' }} />
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.5, duration: 0.7, ease: EASE }}
          style={{ height: '0.7vmin', width: '30%', background: '#e0603f', transformOrigin: 'right', marginTop: '2vmin', borderRadius: 9 }} />
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8, duration: 0.6 }}
          style={{ fontSize: '3.3vmin', color: '#4a4c6e', margin: '2vmin 0 0' }}>منصة تجمع التعلّم والإنجازات والاستعداد المهني</motion.p>
        <Credits delay={2.6} color="#191c45" />
        <Logos delay={3.6} />
      </div>
    </motion.div>
  );
}
