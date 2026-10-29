import { getCareerPushConfig } from '@workspace/api-client-react';
import { registerAppWorker } from './app-service-worker';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function pushSupported() {
  return window.isSecureContext && 'serviceWorker' in navigator &&
    'PushManager' in window && 'Notification' in window;
}

export async function prepareRoadmapPush() {
  if (!pushSupported()) throw new Error('هذا المتصفح لا يدعم الإشعارات. جرّب متصفحاً مدعوماً، وعلى iPhone أضف أثر إلى الشاشة الرئيسية أولاً.');
  // This must run from the explicit Save click, not a mount effect.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('لم يُمنح إذن الإشعارات. يمكنك السماح بها من إعدادات المتصفح أو اختيار التذكير داخل التطبيق.');
  const config = await getCareerPushConfig();
  const registration = await registerAppWorker();
  const bytes = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  const currentKey = subscription?.options.applicationServerKey;
  if (subscription && (!currentKey ||
      Array.from(new Uint8Array(currentKey)).join() !== Array.from(bytes).join())) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  const data = subscription.toJSON();
  if (!data.endpoint || !data.keys?.p256dh || !data.keys.auth) throw new Error('تعذّر إعداد اشتراك الإشعارات. حاول مرة أخرى.');
  return {
    endpoint: data.endpoint,
    keys: { p256dh: data.keys.p256dh, auth: data.keys.auth },
    roadmapPath: `${base}/roadmap`,
  };
}
