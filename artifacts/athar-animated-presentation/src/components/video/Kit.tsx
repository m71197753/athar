import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const BLOB = 'polygon(50% 0%, 80% 8%, 97% 33%, 95% 66%, 76% 93%, 45% 100%, 16% 88%, 2% 60%, 6% 27%, 24% 6%)';

export function Words({ text, delay = 0, step = 0.12, style, className }: { text: string; delay?: number; step?: number; style?: CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ display: 'flex', flexWrap: 'wrap', gap: '0 0.28em', ...style }}>
      {text.split(' ').map((w, i) => (
        <span key={i} style={{ overflow: 'hidden', display: 'inline-block', paddingBlock: '0.12em', marginBlock: '-0.12em' }}>
          <motion.span style={{ display: 'inline-block' }} initial={{ y: '110%', rotate: 4 }} animate={{ y: '0%', rotate: 0 }}
            transition={{ delay: delay + i * step, duration: 0.6, ease: EASE }}>{w}</motion.span>
        </span>
      ))}
    </div>
  );
}

export function Line({ children, delay, color, dot }: { children: ReactNode; delay: number; color: string; dot: string }) {
  return (
    <motion.div initial={{ opacity: 0, x: -40, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ delay, duration: 0.55, ease: EASE }}
      style={{ display: 'flex', alignItems: 'center', gap: '1.6vmin', fontSize: '3.3vmin', fontWeight: 500, color, lineHeight: 1.45 }}>
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: delay + 0.1, type: 'spring', stiffness: 300, damping: 14 }}
        style={{ width: '1.5vmin', height: '1.5vmin', borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <span>{children}</span>
    </motion.div>
  );
}

export const sceneExit = { opacity: 0, scale: 1.08, filter: 'blur(10px)', transition: { duration: 0.5, ease: EASE } };

export function Shell({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <motion.div dir="rtl" className="absolute inset-0 grain"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }} animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      transition={{ duration: 0.75, ease: EASE }} exit={sceneExit} style={{ background: bg, overflow: 'hidden' }}>
      {children}
    </motion.div>
  );
}
