import { motion } from 'framer-motion';
import { FEATURES, FIELDS, IMG } from '../data';
import { BLOB, EASE, Line, Shell, Words } from '../Kit';

export function FeatureScene({ id }: { id: string }) {
  const f = FEATURES[id];
  const c = FIELDS[f.field];
  const full = f.variant === 'full';
  const imgLeft = f.variant === 'left';
  return (
    <Shell bg={c.bg}>
      {full ? (
        <motion.div initial={{ scale: 1.35, filter: 'blur(12px)' }} animate={{ scale: [1.35, 1.04, 1], filter: 'blur(0px)' }} transition={{ duration: 6, times: [0, 0.2, 1], ease: EASE }}
          style={{ position: 'absolute', inset: 0 }}>
          <img src={IMG(f.img)} style={{ position: 'absolute', left: 0, top: 0, width: '62%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to left, ${c.bg} 38%, ${c.bg}cc 50%, transparent 72%)` }} />
        </motion.div>
      ) : (
        <motion.div initial={{ scale: 0.4, rotate: imgLeft ? -25 : 25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 1.1, ease: EASE }}
          style={{ position: 'absolute', top: '9%', height: '82%', aspectRatio: '1', ...(imgLeft ? { left: '4%' } : { right: '4%' }) }}>
          <div style={{ position: 'absolute', inset: '-3%', clipPath: BLOB, background: c.accent, transform: 'rotate(12deg)' }} />
          <motion.div animate={{ scale: [1, 1.07] }} transition={{ duration: 6, ease: 'linear' }} style={{ position: 'absolute', inset: 0, clipPath: BLOB }}>
            <img src={IMG(f.img)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </motion.div>
        </motion.div>
      )}
      <div style={{ position: 'absolute', top: '14%', width: '48%', ...(imgLeft || full ? { right: '6%' } : { left: '6%' }) }}>
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="disp" style={{ fontSize: '2.2vmin', color: c.accent, letterSpacing: '0.2em', marginBottom: '1.5vmin' }}>{f.tag} — أثر</motion.div>
        <Words text={f.title} delay={0.35} className="disp" style={{ fontSize: '7.6vmin', color: c.fg }} />
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1, duration: 0.6, ease: EASE }}
          style={{ height: '0.6vmin', width: '22%', background: c.accent, transformOrigin: 'right', margin: '3vmin 0', borderRadius: 9 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8vmin' }}>
          {f.lines.map((t, i) => <Line key={i} delay={1.3 + i * 0.85} color={c.fg} dot={c.accent}>{t}</Line>)}
        </div>
      </div>
    </Shell>
  );
}
