import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import nordpoints from '@assets/nordpoints-logo_1793472713140.svg';
import replit from '@assets/تنزيل_1793472713137.png';
import { IMG } from './data';
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const NAVY = '#14213d';
export const PAPER = '#f6f3ec';
export const GOLD = '#b8893a';
export const MUTED = '#4b5468';

export function Title({ text, delay = 0.3, color = NAVY, size = 6.2 }: { text: string; delay?: number; color?: string; size?: number }) {
  return (
    <div style={{ overflow: 'hidden', marginBlock: '-0.25em' }}>
      <motion.h1 className="disp" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ delay, duration: 0.8, ease: EASE }}
        style={{ margin: 0, fontSize: `${size}vmin`, color, lineHeight: 1.6, letterSpacing: 0 }}>{text}</motion.h1>
    </div>
  );
}

export function Rule({ delay = 0.8, width = '18%' }: { delay?: number; width?: string }) {
  return <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay, duration: 0.8, ease: EASE }}
    style={{ height: '0.35vmin', width, background: GOLD, transformOrigin: 'right', margin: '2.4vmin 0 3.2vmin' }} />;
}

export function Line({ children, delay, color = NAVY, n }: { children: ReactNode; delay: number; color?: string; n?: number }) {
  return (
    <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.6, ease: EASE }}
      style={{ display: 'flex', alignItems: 'baseline', gap: '1.8vmin', fontSize: '3.5vmin', fontWeight: 500, color, lineHeight: 1.5,
        paddingBlock: '1.1vmin', borderBottom: '0.15vmin solid rgba(20,33,61,.12)' }}>
      <span style={{ color: GOLD, fontWeight: 600, fontSize: '2.7vmin', minWidth: '3vmin' }}>{n !== undefined ? `٠${'١٢٣٤٥'[n]}` : '•'}</span>
      <span>{children}</span>
    </motion.div>
  );
}

export function Logos({ height = 3.2, dark = false }: { height?: number; dark?: boolean }) {
  const chip = { background: dark ? '#f6f3ec' : 'transparent', borderRadius: '0.8vmin', padding: dark ? '0.8vmin 1.4vmin' : 0, display: 'flex', alignItems: 'center', gap: '0.8vmin' };
  return (
    <div style={{ display: 'flex', gap: '2.4vmin', alignItems: 'center' }}>
      <span style={{ ...chip, fontWeight: 600, fontSize: `${height * 0.75}vmin`, color: NAVY, fontFamily: 'sans-serif' }}><img src={replit} style={{ height: `${height}vmin` }} />Replit</span>
      <span style={chip}><img src={nordpoints} style={{ height: `${height * 1.9}vmin` }} /></span>
    </div>
  );
}

/** Formal slide frame: header with mark + section number, footer with presenter line and partner logos. */
export function Frame({ num, section, children, dark = false }: { num: string; section: string; children: ReactNode; dark?: boolean }) {
  const fg = dark ? PAPER : NAVY;
  return (
    <motion.div dir="rtl" className="absolute inset-0 grain" style={{ background: dark ? NAVY : PAPER, overflow: 'hidden' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }} transition={{ duration: 0.6 }}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '1.2vmin', background: GOLD }} />
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}
        style={{ position: 'absolute', top: '5%', right: '6%', left: '6%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `0.15vmin solid ${dark ? 'rgba(246,243,236,.2)' : 'rgba(20,33,61,.15)'}`, paddingBottom: '1.6vmin' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2vmin', color: fg, fontSize: '2.4vmin', fontWeight: 500 }}>
          <img src={IMG('athar-wordmark-3d.png')} style={{ height: '5vmin' }} />
          <span>{section}</span>
        </div>
        <span className="disp" style={{ color: GOLD, fontSize: '3vmin' }}>{num} / ١٢</span>
      </motion.div>
      {children}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}
        style={{ position: 'absolute', bottom: '5%', right: '6%', left: '6%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: dark ? '#c3c8d4' : MUTED, fontSize: '2.1vmin' }}>
        <span>إعداد: محمد الجرايحي محمد الإمام · إشراف: Taha Mahmoud Metwally Nour El-Dein</span>
        <Logos height={2.6} dark={dark} />
      </motion.div>
    </motion.div>
  );
}

export function Figure({ src, delay = 0.4, style }: { src: string; delay?: number; style: CSSProperties }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 1.1, ease: EASE }}
      style={{ position: 'absolute', ...style }}>
      <div style={{ position: 'absolute', inset: 0, transform: 'translate(-1.6vmin, 1.6vmin)', border: `0.25vmin solid ${GOLD}`, borderRadius: '1vmin' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '1vmin', overflow: 'hidden', boxShadow: '0 2vmin 5vmin rgba(20,33,61,.18)' }}>
        <motion.img src={src} animate={{ scale: [1, 1.05] }} transition={{ duration: 7, ease: 'linear' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </motion.div>
  );
}
