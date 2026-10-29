const base = import.meta.env.BASE_URL.replace(/\/$/, '');
let pending: Promise<ServiceWorkerRegistration> | undefined;

/** Install once per page, sharing the same active worker for offline and push. */
export function registerAppWorker(): Promise<ServiceWorkerRegistration> {
  pending ??= install().catch(error => {
    pending = undefined;
    throw error;
  });
  return pending;
}

async function install(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(`${base}/sw.js`, {
    scope: `${base}/`, updateViaCache: 'none',
  });
  // ready can resolve to the OLD active worker during an upgrade. Wait for
  // this installation so opt-in cannot subscribe before push handlers activate.
  const worker = registration.installing || registration.waiting;
  if (worker && worker.state !== 'activated') {
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        if (worker.state !== 'activated' && worker.state !== 'redundant') return;
        clearTimeout(timeout);
        worker.removeEventListener('statechange', finish);
        if (worker.state === 'activated') resolve();
        else reject(new Error('تعذّر تفعيل إشعارات المتصفح. أعد تحميل الصفحة وحاول مجدداً.'));
      };
      const timeout = setTimeout(() => {
        worker.removeEventListener('statechange', finish);
        reject(new Error('لم يكتمل تفعيل الإشعارات. أعد تحميل الصفحة وحاول مجدداً.'));
      }, 20_000);
      worker.addEventListener('statechange', finish);
      finish();
    });
  }
  if (!registration.active || registration.active.state !== 'activated') {
    throw new Error('تعذّر تفعيل إشعارات المتصفح. أعد تحميل الصفحة وحاول مجدداً.');
  }
  return registration;
}
