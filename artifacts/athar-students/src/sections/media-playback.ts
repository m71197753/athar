export function playbackSeconds(elapsed: number, advanced: number, rate: number): number {
  if (!Number.isFinite(elapsed) || !Number.isFinite(advanced) || elapsed <= 0 ||
    elapsed > 20 || advanced <= 0 || !Number.isFinite(rate) || rate <= 0) return 0;
  const speed = rate;
  // A jump in the timeline is not time spent studying.
  if (advanced > elapsed * speed + 0.75) return 0;
  return Math.min(elapsed, advanced / speed, 15);
}

export function resumePosition(position: number, duration: number): number {
  const bounded = Math.max(0, Math.min(86400, Number.isFinite(position) ? Math.floor(position) : 0));
  return duration > 0 ? Math.min(bounded, Math.floor(duration)) : bounded;
}
