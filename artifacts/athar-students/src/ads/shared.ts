import type { CSSProperties } from 'react';
import type { AdInput, AdPage, AdPlacement, AdSlot as AdSlotName, AdCreativeInputFormat, AdInputStatus, AdEnquiryStatus } from '@workspace/api-client-react';

export const PAGES: AdPage[] = ['home', 'dashboard', 'achievements', 'learning', 'academy', 'roadmap', 'resume', 'assistant', 'profile'];
export const SLOTS: AdSlotName[] = ['top', 'middle', 'bottom', 'side', 'floating-start', 'floating-end'];
export const pageNames: Record<AdPage, string> = {
  home: 'الصفحة الرئيسية', dashboard: 'لوحة الطالب', achievements: 'الإنجازات', learning: 'التعلّم', academy: 'المذاكرة',
  roadmap: 'الخطة المهنية', resume: 'السيرة المهنية', assistant: 'المساعد', profile: 'الملف الشخصي',
};
export const slotNames: Record<AdSlotName, string> = {
  top: 'أعلى الصفحة', middle: 'وسط المحتوى', bottom: 'أسفل الصفحة', side: 'العمود الجانبي',
  'floating-start': 'عائم — بداية الشاشة (يمين)', 'floating-end': 'عائم — نهاية الشاشة (يسار)',
};
export const formatNames: Record<AdCreativeInputFormat, string> = {
  image_link: 'صورة + رابط', video_link: 'فيديو + رابط', code: 'كود HTML/CSS/JS', image_code: 'صورة + كود', text_link: 'نص + رابط',
};
export const statusNames: Record<AdInputStatus, string> = { draft: 'مسودة', active: 'نشط', paused: 'متوقف مؤقتاً', archived: 'مؤرشف' };
export const enquiryNames: Record<AdEnquiryStatus, string> = { new: 'جديد', contacted: 'تم التواصل', converted: 'تحوّل لعميل', closed: 'مغلق' };

export type Creative = Pick<AdInput, 'title' | 'format' | 'mediaUrl' | 'code' | 'destination' | 'cta'> & { id?: string };

export const isFloating = (s: AdSlotName) => s === 'floating-start' || s === 'floating-end';
export const isHttpUrl = (v: string) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };
export const isUploadedMedia = (v: string) => /^\/api\/ads\/media\/[A-Za-z0-9_-]+$/.test(v);
export const isSafeMedia = (v: string) => isUploadedMedia(v) || isHttpUrl(v);
export const needsMedia = (f: AdCreativeInputFormat) => f === 'image_link' || f === 'video_link' || f === 'image_code';
export const needsCode = (f: AdCreativeInputFormat) => f === 'code' || f === 'image_code';

/** Returns a privacy-friendly HTTPS embed URL for YouTube/Vimeo, or null. */
export function videoEmbed(url: string): string | null {
  let u: URL; try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname.replace(/^www\.|^m\./, '');
  let id = '';
  if (h === 'youtu.be') id = u.pathname.slice(1);
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') ?? '';
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/); if (m) id = m[1];
  }
  if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&mute=1&playsinline=1`;
  if (h === 'vimeo.com' || h === 'player.vimeo.com') {
    const m = u.pathname.match(/(\d{5,12})/);
    if (m) return `https://player.vimeo.com/video/${m[1]}?muted=1&dnt=1`;
  }
  return null;
}

export function statusOf(err: unknown): number | undefined {
  return typeof err === 'object' && err && 'status' in err ? Number((err as { status: unknown }).status) : undefined;
}
export function errText(err: unknown) {
  const s = statusOf(err);
  if (s === 401 || s === 403) return 'ليست لديك صلاحية لتنفيذ هذا الإجراء.';
  if (s === 400 || s === 422) return 'البيانات المرسلة غير صالحة. راجع الحقول وحاول مجدداً.';
  if (s === 404) return 'العنصر غير موجود أو أُزيل.';
  if (s === 413) return 'الملف أكبر من الحد المسموح.';
  if (s === 429) return 'طلبات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة.';
  return 'تعذّر إكمال العملية. حاول مرة أخرى.';
}
export const num = (n: number) => n.toLocaleString('ar');
/** Server CTR is already a percentage (0..100+). */
export const pct = (n: number) => `${n.toLocaleString('ar', { maximumFractionDigits: 2 })}٪`;
export const linkRequired = (f: AdCreativeInputFormat) => f !== 'code' && f !== 'image_code';
export const fmtDate = (d: string) => new Date(d).toLocaleString('ar', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Shared box geometry for slots: used by public AdSlot and admin placement preview. */
export function inlineBox(p: AdPlacement): CSSProperties {
  const offset = `min(${p.offsetX}px, max(0px, calc(100% - 180px)))`;
  return { width: `min(calc(100% - ${offset}), ${p.width}px)`, height: p.height, marginInlineStart: offset, marginTop: p.offsetY };
}
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? Math.round(v) : lo));
