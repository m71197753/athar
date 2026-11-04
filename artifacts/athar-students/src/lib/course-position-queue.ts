const pending = new Map<string, Promise<unknown>>();

// Keep ordering across room unmount/remount, not only within one component.
export function enqueueCoursePosition<T>(key: string, save: () => Promise<T>): Promise<T> {
  const next = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(save);
  pending.set(key, next);
  const cleanup = () => { if (pending.get(key) === next) pending.delete(key); };
  void next.then(cleanup, cleanup);
  return next;
}

export async function waitForCoursePosition(key: string) {
  // A later selection can join while we wait.
  while (pending.has(key)) await pending.get(key)?.catch(() => {});
}
