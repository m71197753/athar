type AnalyticsData = Record<string, string | number | boolean>;
export type ExperimentKey = 'language_cta_copy' | 'streak_reminder_timing';
export type ExperimentVariant = 'direct' | 'encouraging' | 'early' | 'late';

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

const experimentVariants: Record<ExperimentKey, readonly ExperimentVariant[]> = {
  language_cta_copy: ['direct', 'encouraging'],
  streak_reminder_timing: ['early', 'late'],
};

function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;
  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never affect learning or account flows.
  }
}

export function getExperimentVariant(key: ExperimentKey): ExperimentVariant {
  const variants = experimentVariants[key];
  const storageKey = `athar:experiment:${key}`;
  if (typeof window === 'undefined') return variants[0];

  try {
    const saved = window.localStorage.getItem(storageKey) as ExperimentVariant | null;
    if (saved && variants.includes(saved)) return saved;
    const variant = variants[Math.floor(Math.random() * variants.length)];
    window.localStorage.setItem(storageKey, variant);
    trackEvent('experiment_assigned', { experiment: key, variant });
    return variant;
  } catch {
    return variants[Math.floor(Math.random() * variants.length)];
  }
}

export function trackNextDayReturn(surface: string): void {
  if (typeof window === 'undefined') return;
  try {
    const today = localDay();
    const key = 'athar:learning:last-active-day';
    const previous = window.localStorage.getItem(key);
    if (previous) {
      const previousDay = new Date(`${previous}T00:00:00`);
      const currentDay = new Date(`${today}T00:00:00`);
      const daysBetween = Math.round((currentDay.getTime() - previousDay.getTime()) / 86_400_000);
      if (daysBetween === 1) trackEvent('learning_next_day_return', { surface });
    }
    window.localStorage.setItem(key, today);
  } catch {
    // Returning-visit measurement is optional when local storage is unavailable.
  }
}

export function trackDailyEventOnce(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `athar:tracked:${name}:${localDay()}`;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, '1');
  } catch {
    // The event is still useful when storage is blocked; duplicate prevention is best-effort.
  }
  trackEvent(name, data);
}
