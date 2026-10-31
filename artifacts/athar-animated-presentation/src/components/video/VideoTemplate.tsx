import { useEffect, useRef, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { VideoCanvas, VideoPausedContext, type VideoAspectRatio, useVideoPlayer } from '@/lib/video';
import { Cover } from './video_scenes/Cover';
import { Problem } from './video_scenes/Problem';
import { Solution } from './video_scenes/Solution';
import { Steps } from './video_scenes/Steps';
import { FeatureScene } from './video_scenes/FeatureScene';
import { Thanks } from './video_scenes/Thanks';

export const SCENE_DURATIONS = {
  cover: 6000, problem: 6000, solution: 4800, steps: 7200, courses: 4800, languages: 4800,
  achievements: 6000, resume: 6000, career: 6000, office: 6600, admin: 6300, thanks: 5500,
};
const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
const F = (id: string) => () => <FeatureScene id={id} />;
const SCENE_COMPONENTS: Record<string, ComponentType> = {
  cover: Cover, problem: Problem, solution: Solution, steps: Steps, courses: F('courses'), languages: F('languages'),
  achievements: F('achievements'), resume: F('resume'), career: F('career'), office: F('office'), admin: F('admin'), thanks: Thanks,
};
const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {}; let c = 0;
  for (const [k, ms] of Object.entries(SCENE_DURATIONS)) { out[k] = c / 1000; c += ms; }
  return out;
})();

export default function VideoTemplate({ durations = SCENE_DURATIONS, loop = true, paused = false, muted = false, onSceneChange }: {
  durations?: Record<string, number>; loop?: boolean; paused?: boolean; muted?: boolean; onSceneChange?: (k: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  useEffect(() => { onSceneChange?.(currentSceneKey); }, [currentSceneKey, onSceneChange]);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const Scene = SCENE_COMPONENTS[baseSceneKey];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    a.volume = 0.35;
    if (paused) { a.pause(); return; }
    if (lastKey.current !== currentSceneKey) {
      lastKey.current = currentSceneKey;
      const t = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(a.currentTime - t) > 0.18) a.currentTime = t;
    }
    a.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted, paused]);
  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} style={{ backgroundColor: '#14213d' }}>
        <motion.div className="absolute inset-0" >
          <AnimatePresence mode="sync">{Scene && <Scene key={currentSceneKey} />}</AnimatePresence>
        </motion.div>
        <div className="absolute" style={{ left: 0, right: 0, bottom: 0, height: '0.8vmin', background: 'rgba(20,33,61,.2)', zIndex: 30 }}>
          <motion.div animate={{ scaleX: (sceneIndex + 1) / 12 }} transition={{ duration: 0.8 }} style={{ height: '100%', background: '#b8893a', transformOrigin: 'right' }} />
        </div>
        <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`} preload="auto" autoPlay muted={muted} />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
