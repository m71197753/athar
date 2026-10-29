import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { RequiredMark } from '../components/RequiredMark';
import { useGetPublishedAds, getGetPublishedAdsQueryKey, useRecordAdEvent, useCreateAdEnquiry } from '@workspace/api-client-react';
import type { AdPage, AdSlot as AdSlotName, PublicAd, AdPlacement } from '@workspace/api-client-react';
import { AdCreative } from './AdCreative';
import { Modal } from './Modal';
import { errText, inlineBox, isFloating } from './shared';
import './ads.css';

/* In-memory per page view: at most one impression per ad. Reset when the route changes. */
const seen = new Set<string>();
let seenPath = typeof window !== 'undefined' ? window.location.pathname : '';
function claim(id: string) {
  if (window.location.pathname !== seenPath) { seen.clear(); seenPath = window.location.pathname; }
  if (seen.has(id)) return false;
  seen.add(id); return true;
}
const dismissed = new Set<string>();

/** Fires once after the element is >=50% visible for 1 continuous second while the tab is visible. */
function useMeasuredImpression(onSeen: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onSeen); cb.current = onSeen;
  useEffect(() => {
    const el = ref.current; if (!el || typeof IntersectionObserver === 'undefined') return;
    let timer: number | undefined; let inView = false; let done = false;
    const stop = () => { if (timer !== undefined) { clearTimeout(timer); timer = undefined; } };
    const evaluate = () => {
      if (done) return;
      if (inView && document.visibilityState === 'visible') {
        if (timer === undefined) timer = window.setTimeout(() => { timer = undefined; if (inView && document.visibilityState === 'visible') { done = true; io.disconnect(); cb.current(); } }, 1000);
      } else stop();
    };
    const io = new IntersectionObserver(es => { for (const e of es) inView = e.isIntersecting && e.intersectionRatio >= 0.5; evaluate(); }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    document.addEventListener('visibilitychange', evaluate);
    return () => { stop(); io.disconnect(); document.removeEventListener('visibilitychange', evaluate); };
  }, []);
  return ref;
}

function EnquiryForm({ ad, onClose }: { ad: PublicAd; onClose: () => void }) {
  const create = useCreateAdEnquiry();
  const [f, setF] = useState({ name: '', contact: '', message: '', consent: false });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const data = { name: f.name.trim(), contact: f.contact.trim(), message: f.message.trim(), consent: f.consent };
    if (!data.name) return setErr('الاسم مطلوب.');
    if (data.contact.length < 3) return setErr('أدخل بريداً أو رقماً للتواصل.');
    if (!data.consent) return setErr('يلزم موافقتك على مشاركة بياناتك للتواصل.');
    setErr('');
    create.mutate({ id: ad.id, data }, { onSuccess: () => setOk(true), onError: er => setErr(errText(er)) });
  };
  return <Modal title={`استفسار عن: ${ad.title}`} onClose={onClose} busy={create.isPending}>
    {ok ? <div className="ads-dialog-body"><p className="ads-ok" role="status">وصل طلبك. سيتواصل معك فريق أثر أو المعلن عبر بيانات التواصل التي أدخلتها.</p>
      <div className="ads-actions"><button type="button" className="button button-primary button-compact" onClick={onClose} autoFocus>تم</button></div></div>
      : <form className="ads-form" onSubmit={submit} noValidate>
        <label className="ads-field"><span>الاسم <RequiredMark/></span><input required maxLength={160} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoComplete="name"/></label>
        <label className="ads-field"><span>وسيلة التواصل (بريد أو هاتف) <RequiredMark/></span><input required minLength={3} maxLength={254} dir="ltr" value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })}/></label>
        <label className="ads-field"><span>رسالتك (اختياري)</span><textarea rows={3} maxLength={2000} value={f.message} onChange={e => setF({ ...f, message: e.target.value })}/></label>
        <label className="ads-check"><input type="checkbox" checked={f.consent} onChange={e => setF({ ...f, consent: e.target.checked })}/><span>أوافق على أن تُحفظ بياناتي أعلاه ويتواصل معي فريق أثر بخصوص هذا الإعلان فقط.</span></label>
        {err && <p className="ads-err" role="alert">{err}</p>}
        <div className="ads-actions"><button type="button" className="button button-outline button-compact" onClick={onClose} disabled={create.isPending}>إلغاء</button>
          <button type="submit" className="button button-primary button-compact" disabled={create.isPending}>{create.isPending ? 'جارٍ الإرسال…' : 'إرسال الطلب'}</button></div>
      </form>}
  </Modal>;
}

function PlacedAd({ ad, placement, page, slot, onDismiss }: { ad: PublicAd; placement: AdPlacement; page: AdPage; slot: AdSlotName; onDismiss?: () => void }) {
  const record = useRecordAdEvent();
  const send = useRef(record.mutate); send.current = record.mutate;
  const [enquiry, setEnquiry] = useState(false);
  const ref = useMeasuredImpression(() => { if (claim(ad.id)) send.current({ id: ad.id, data: { kind: 'impression', page, slot } }, { onError: () => undefined }); });
  const floating = isFloating(slot);
  const style = floating
    ? { width: `min(${placement.width}px, calc(100vw - 24px - ${placement.offsetX}px))`, height: `min(${placement.height}px, 45dvh)`, ['--ads-ox' as string]: `${placement.offsetX}px`, ['--ads-oy' as string]: `${placement.offsetY}px` }
    : inlineBox(placement);
  return <div ref={ref} className={floating ? `ads-float ads-float-${slot === 'floating-start' ? 'start' : 'end'}` : 'ads-inline'} style={style}>
    <AdCreative ad={ad} onCta={() => send.current({ id: ad.id, data: { kind: 'click', page, slot } }, { onError: () => undefined })} onEnquire={() => setEnquiry(true)}/>
    {onDismiss && <button type="button" className="ads-dismiss" onClick={onDismiss} aria-label="إخفاء الإعلان"><X size={14}/></button>}
    {enquiry && <EnquiryForm ad={ad} onClose={() => setEnquiry(false)}/>}
  </div>;
}

/** Public ad slot. Renders nothing until active ads for this page+slot are fetched. */
export function AdSlot({ page, slot }: { page: AdPage; slot: AdSlotName }) {
  const params = { page };
  const q = useGetPublishedAds(params, { query: { queryKey: getGetPublishedAdsQueryKey(params), staleTime: 10_000, refetchInterval: 15_000, retry: 1 } });
  const [, force] = useState(0);
  if (!q.data?.length) return null;
  const matches = q.data.flatMap(ad => ad.placements.filter(p => p.page === page && p.slot === slot).slice(0, 1).map(p => ({ ad, p })));
  if (!matches.length) return null;
  if (isFloating(slot)) {
    const first = matches.find(m => !dismissed.has(`${m.ad.id}:${slot}`));
    if (!first) return null;
    return <aside className="ads-slot ads-slot-floating" aria-label="إعلان">
      <PlacedAd key={first.ad.id} ad={first.ad} placement={first.p} page={page} slot={slot} onDismiss={() => { dismissed.add(`${first.ad.id}:${slot}`); force(n => n + 1); }}/>
    </aside>;
  }
  return <aside className={`ads-slot ads-slot-${slot}`} aria-label="إعلانات">
    {matches.map(m => <PlacedAd key={m.ad.id} ad={m.ad} placement={m.p} page={page} slot={slot}/>)}
  </aside>;
}

export default AdSlot;
