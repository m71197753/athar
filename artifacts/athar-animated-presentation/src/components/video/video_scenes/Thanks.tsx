import { motion } from 'framer-motion';
import { IMG } from '../data';
import { BLOB, EASE, Shell, Words } from '../Kit';
import { Credits, Logos } from './Cover';

export function Thanks() {
  return (
    <Shell bg="#191c45">
      <motion.div initial={{ scale: 0.5, opacity: 0, rotate: 20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ delay: 0.2, duration: 1.2, ease: EASE }}
        style={{ position: 'absolute', left: '5%', top: '10%', height: '80%', aspectRatio: '1', clipPath: BLOB }}>
        <img src={IMG('ai-thanks.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </motion.div>
      <div style={{ position: 'absolute', right: '6%', top: '9%', width: '48%' }}>
        <motion.img src={IMG('athar-wordmark-3d.png')} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 13 }} style={{ height: '13vmin', display: 'block' }} />
        <Words text="شكرًا لكم" delay={0.6} step={0.2} className="disp" style={{ fontSize: '16vmin', color: '#e9a23b' }} />
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.6 }}
          style={{ fontSize: '3.6vmin', color: '#f3ecdf', margin: '1vmin 0 0' }}>أثر | تعلّم، وثّق، وانطلق</motion.p>
        <Credits delay={2.1} color="#c9c3d8" />
        <Logos delay={2.9} />
      </div>
    </Shell>
  );
}
