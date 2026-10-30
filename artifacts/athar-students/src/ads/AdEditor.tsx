import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Monitor, Plus, Smartphone, Tablet, Trash2, Upload } from 'lucide-react';
import { RequiredMark } from '../components/RequiredMark';
import { useRequestAdAssetUpload, useConfirmAdAsset } from '@workspace/api-client-react';
import type { AdInput, AdPlacement, AdCustomer, AdAssetInputMime, AdCreativeInputFormat, AdInputStatus } from '@workspace/api-client-react';
import { AdCreative } from './AdCreative';
import {
  PAGES, SLOTS, pageNames, slotNames, formatNames, statusNames, clamp, errText, inlineBox, isFloating, isHttpUrl, isSafeMedia, linkRequired, needsCode, needsMedia, videoEmbed,
} from './shared';

export const blankPlacement = (): AdPlacement => ({ page: 'dashboard', slot: 'top', offsetX: 0, offsetY: 0, width: 728, height: 180 });
export const blankAd = (): AdInput => ({ title: '', format: 'image_link', status: 'draft', mediaUrl: '', code: '', destination: '', cta: 'اعرف المزيد', customerId: null, placements: [blankPlacement()], startsAt: null, endsAt: null });

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const toLocal = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(+d)) return ''; const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocal = (v: string) => { if (!v) return null; const d = new Date(v); return isNaN(+d) ? null : d.toISOString(); };

const VIEWPORTS = [{ id: 'desktop', w: 1280, h: 760, label: 'سطح المكتب', icon: Monitor }, { id: 'tablet', w: 820, h: 900, label: 'جهاز لوحي', icon: Tablet }, { id: 'mobile', w: 390, h: 780, label: 'جوال', icon: Smartphone }] as const;

function NumberRange({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return <label className="ads-range"><span>{label}</span>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(clamp(+e.target.value, min, max))}/>
    <input type="number" min={min} max={max} value={value} onChange={e => onChange(clamp(+e.target.value, min, max))} aria-label={`${label} بالبكسل`}/>
  </label>;
}

function PlacementPreview({ ad, placement }: { ad: AdInput; placement: AdPlacement }) {
  const [vp, setVp] = useState<(typeof VIEWPORTS)[number]>(VIEWPORTS[0]);
  const box = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(600);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width)); ro.observe(el); return () => ro.disconnect();
  }, []);
  const scale = Math.min(1, cw / vp.w);
  const mobile = vp.w < 860;
  const creative = <AdCreative ad={ad} preview/>;
  const inline = (s: AdPlacement['slot']) => placement.slot === s ? <div className="adp-hit" style={inlineBox(placement)}>{creative}</div> : null;
  const floatStyle = { width: `min(${placement.width}px, calc(100% - 24px - ${placement.offsetX}px))`, height: Math.min(placement.height, vp.h * 0.45), bottom: placement.offsetY + 16 + (mobile ? 84 : 0), [placement.slot === 'floating-start' ? 'right' : 'left']: placement.offsetX + 12 };
  return <div className="adp">
    <div className="adp-tools" role="radiogroup" aria-label="عرض المعاينة">
      {VIEWPORTS.map(v => { const I = v.icon; return <button key={v.id} type="button" role="radio" aria-checked={vp.id === v.id} className={vp.id === v.id ? 'on' : ''} onClick={() => setVp(v)}><I size={14}/> {v.label} <small dir="ltr">{v.w}px</small></button>; })}
    </div>
    <div ref={box} className="adp-box" style={{ height: vp.h * scale }}>
      <div className="adp-stage" style={{ width: vp.w, height: vp.h, transform: `scale(${scale})` }} dir="rtl">
        <div className="adp-top"><span/><i/></div>
        <div className={`adp-page ${mobile ? 'adp-m' : ''}`}>
          <div className="adp-main">
            {inline('top')}
            <div className="adp-block"/><div className="adp-block adp-short"/>
            {inline('middle')}
            <div className="adp-block"/>
            {mobile && inline('side')}
            <div className="adp-block adp-short"/>
            {inline('bottom')}
          </div>
          {!mobile && <div className="adp-side"><div className="adp-block adp-short"/>{inline('side')}</div>}
        </div>
        {mobile && <div className="adp-nav"/>}
        {isFloating(placement.slot) && <div className="adp-float" style={floatStyle}>{creative}</div>}
      </div>
    </div>
    <p className="ads-hint">المعاينة لا تسجّل أي ظهور أو نقرة، وزر الإجراء معطّل فيها. القصّ هنا يطابق ما يراه الطالب على هذا العرض.</p>
  </div>;
}

export function AdEditor({ initial, customers, busy, error, onSave, onCancel }: {
  initial: AdInput; customers: AdCustomer[]; busy: boolean; error: string; onSave: (a: AdInput) => void; onCancel: () => void;
}) {
  // Local draft initialised once; server refetches never overwrite unsaved edits.
  const [ad, setAd] = useState<AdInput>(initial);
  const [active, setActive] = useState(0);
  const [localErr, setLocalErr] = useState('');
  const [upload, setUpload] = useState<{ state: 'idle' | 'busy' | 'ok' | 'err'; text: string }>({ state: 'idle', text: '' });
  const requestUpload = useRequestAdAssetUpload();
  const confirmAsset = useConfirmAdAsset();
  const set = <K extends keyof AdInput>(k: K, v: AdInput[K]) => { setLocalErr(''); setAd(a => ({ ...a, [k]: v })); };
  const setP = (i: number, patch: Partial<AdPlacement>) => setAd(a => ({ ...a, placements: a.placements.map((p, j) => j === i ? { ...p, ...patch } : p) }));
  const placement = ad.placements[Math.min(active, ad.placements.length - 1)] ?? blankPlacement();
  const isVideo = ad.format === 'video_link';

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const allowed = isVideo ? VIDEO_TYPES : IMAGE_TYPES;
    if (!allowed.includes(file.type)) return setUpload({ state: 'err', text: isVideo ? 'الفيديو يجب أن يكون MP4 أو WebM.' : 'الصورة يجب أن تكون JPG أو PNG أو WebP أو GIF.' });
    if (!Number.isSafeInteger(file.size) || file.size < 1) return setUpload({ state: 'err', text: 'اختر ملفًا غير فارغ بحجم صالح.' });
    setUpload({ state: 'busy', text: 'جارٍ الرفع…' });
    try {
      const slot = await requestUpload.mutateAsync({ data: { mime: file.type as AdAssetInputMime, size: file.size } });
      const res = await fetch(slot.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!res.ok) throw new Error('upload');
      const ready = await confirmAsset.mutateAsync({ id: slot.id });
      setAd(a => ({ ...a, mediaUrl: ready.url }));
      setUpload({ state: 'ok', text: 'رُفع الملف. سيُحفظ رابطه عند حفظ الإعلان.' });
    } catch (e) {
      setUpload({ state: 'err', text: e instanceof Error && e.message === 'upload' ? 'فشل رفع الملف إلى التخزين.' : errText(e) });
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a: AdInput = { ...ad, title: ad.title.trim(), cta: ad.cta.trim(), destination: ad.destination.trim(), mediaUrl: ad.mediaUrl.trim() };
    if (!needsMedia(a.format)) a.mediaUrl = '';
    if (!needsCode(a.format)) a.code = '';
    const fail = (t: string) => setLocalErr(t);
    if (!a.title) return fail('العنوان مطلوب.');
    if (!a.cta) return fail('نص زر الإجراء مطلوب.');
    if (linkRequired(a.format) && !a.destination) return fail('رابط الوجهة مطلوب لهذا النوع.');
    if (a.destination && !isHttpUrl(a.destination)) return fail('رابط الوجهة يجب أن يبدأ بـ http:// أو https://');
    if (needsMedia(a.format)) {
      if (!a.mediaUrl) return fail('أضف رابط الوسائط أو ارفع ملفاً.');
      if (a.mediaUrl.startsWith('data:') || !isSafeMedia(a.mediaUrl)) return fail('رابط الوسائط غير صالح. استخدم http(s) أو ملفاً مرفوعاً.');
      if (isVideo && /youtube|youtu\.be|vimeo/i.test(a.mediaUrl) && !videoEmbed(a.mediaUrl)) return fail('رابط الفيديو غير صالح أو يجب أن يستخدم اتصالاً آمناً.');
    }
    if (needsCode(a.format) && !a.code.trim()) return fail('أضف الكود.');
    if (!a.placements.length) return fail('أضف موضع عرض واحداً على الأقل.');
    const keys = a.placements.map(p => `${p.page}:${p.slot}`);
    if (new Set(keys).size !== keys.length) return fail('يوجد موضعان متطابقان (نفس الصفحة والموضع).');
    if (a.startsAt && a.endsAt && new Date(a.endsAt) <= new Date(a.startsAt)) return fail('تاريخ الانتهاء يجب أن يكون بعد البداية.');
    setLocalErr('');
    onSave(a);
  };

  return <form className="ads-editor" onSubmit={submit} noValidate aria-label={initial.title ? `تعديل ${initial.title}` : 'إعلان جديد'}>
    <div className="ads-editor-cols">
      <div className="ads-editor-form">
        <fieldset className="ads-group"><legend>المادة الإعلانية</legend>
          <label className="ads-field"><span>العنوان <RequiredMark/></span><input maxLength={160} value={ad.title} onChange={e => set('title', e.target.value)} required/></label>
          <div className="ads-seg" role="radiogroup" aria-label="نوع الإعلان">
            {(Object.keys(formatNames) as AdCreativeInputFormat[]).map(f => <label key={f} className={ad.format === f ? 'on' : ''}><input type="radio" name="ad-format" checked={ad.format === f} onChange={() => { set('format', f); setUpload({ state: 'idle', text: '' }); }}/>{formatNames[f]}</label>)}
          </div>
          {needsMedia(ad.format) && <div className="ads-media-row">
            <label className="ads-field"><span>{isVideo ? 'رابط فيديو مباشر أو صفحة فيديو آمنة' : 'رابط الصورة'}</span>
              <input dir="ltr" type="url" maxLength={2000} placeholder="https://" value={ad.mediaUrl} onChange={e => { set('mediaUrl', e.target.value); setUpload({ state: 'idle', text: '' }); }}/></label>
            <label className={`button button-outline button-compact ads-upload ${upload.state === 'busy' ? 'is-busy' : ''}`}>
              <Upload size={14}/> {upload.state === 'busy' ? 'جارٍ الرفع…' : 'رفع ملف'}
              <input type="file" className="ads-sr" accept={(isVideo ? VIDEO_TYPES : IMAGE_TYPES).join(',')} disabled={upload.state === 'busy'} onChange={e => { void onFile(e.target.files?.[0]); e.target.value = ''; }}/>
            </label>
            <small className="ads-hint">{isVideo ? 'MP4 أو WebM. يظل الحجم خاضعًا للتخزين والاتصال.' : 'JPG/PNG/WebP/GIF. يظل الحجم خاضعًا للتخزين والاتصال.'}</small>
            {upload.text && <small role="status" className={upload.state === 'err' ? 'ads-err' : upload.state === 'ok' ? 'ads-ok' : 'ads-hint'}>{upload.text}</small>}
          </div>}
          {needsCode(ad.format) && <label className="ads-field"><span>الكود (HTML / CSS / JS)</span>
            <textarea dir="ltr" className="ads-code" rows={8} maxLength={100000} spellCheck={false} value={ad.code} onChange={e => set('code', e.target.value)}/>
            <small className="ads-hint">الكود معزول عن حسابات الطلاب. يسمح بـ HTML/CSS وJavaScript المضمّن، ولا يسمح بالبرامج الخارجية أو اتصالات البيانات أو النماذج أو النوافذ. الروابط داخل الكود لا تُحتسب؛ استخدم رابط الوجهة للصورة أو زر الإجراء.</small></label>}
          <div className="ads-two">
            <label className="ads-field"><span>رابط الوجهة {linkRequired(ad.format) ? '' : '(اختياري)'}</span><input dir="ltr" type="url" maxLength={2000} placeholder="https://" value={ad.destination} onChange={e => set('destination', e.target.value)}/></label>
            <label className="ads-field"><span>نص زر الإجراء</span><input maxLength={60} value={ad.cta} onChange={e => set('cta', e.target.value)}/></label>
          </div>
        </fieldset>

        <fieldset className="ads-group"><legend>الحالة والجدولة</legend>
          <div className="ads-two">
            <label className="ads-field"><span>الحالة</span><select value={ad.status} onChange={e => set('status', e.target.value as AdInputStatus)}>{(Object.keys(statusNames) as AdInputStatus[]).map(s => <option key={s} value={s}>{statusNames[s]}</option>)}</select></label>
            <label className="ads-field"><span>المعلن</span><select value={ad.customerId ?? ''} onChange={e => set('customerId', e.target.value || null)}>
              <option value="">بلا معلن</option>
              {ad.customerId && !customers.some(c => c.id === ad.customerId) && <option value={ad.customerId}>معلن غير متاح</option>}
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="ads-field"><span>يبدأ (اختياري)</span><input type="datetime-local" value={toLocal(ad.startsAt)} onChange={e => set('startsAt', fromLocal(e.target.value))}/></label>
            <label className="ads-field"><span>ينتهي (اختياري)</span><input type="datetime-local" value={toLocal(ad.endsAt)} onChange={e => set('endsAt', fromLocal(e.target.value))}/></label>
          </div>
          <small className="ads-hint">يظهر الإعلان للطلاب فقط عندما تكون حالته «نشط» وضمن فترة الجدولة.</small>
        </fieldset>

        <fieldset className="ads-group"><legend>مواضع العرض ({ad.placements.length.toLocaleString('ar')}/30)</legend>
          <ol className="ads-places">{ad.placements.map((p, i) => <li key={i} className={i === active ? 'on' : ''}>
            <button type="button" className="ads-place-pick" onClick={() => setActive(i)} aria-pressed={i === active}>{(i + 1).toLocaleString('ar')}</button>
            <div className="ads-place-body" onFocusCapture={() => setActive(i)}>
              <div className="ads-two">
                <label className="ads-field"><span>الصفحة</span><select value={p.page} onChange={e => setP(i, { page: e.target.value as AdPlacement['page'] })}>{PAGES.map(pg => <option key={pg} value={pg}>{pageNames[pg]}</option>)}</select></label>
                <label className="ads-field"><span>الموضع</span><select value={p.slot} onChange={e => setP(i, { slot: e.target.value as AdPlacement['slot'] })}>{SLOTS.map(s => <option key={s} value={s}>{slotNames[s]}</option>)}</select></label>
              </div>
              {i === active && <div className="ads-ranges">
                <NumberRange label="العرض" value={p.width} min={180} max={1200} onChange={n => setP(i, { width: n })}/>
                <NumberRange label="الارتفاع" value={p.height} min={100} max={800} onChange={n => setP(i, { height: n })}/>
                <NumberRange label="إزاحة أفقية" value={p.offsetX} min={0} max={200} onChange={n => setP(i, { offsetX: n })}/>
                <NumberRange label="إزاحة رأسية" value={p.offsetY} min={0} max={200} onChange={n => setP(i, { offsetY: n })}/>
              </div>}
            </div>
            <button type="button" className="icon-button danger-icon" disabled={ad.placements.length <= 1} aria-label={`حذف الموضع ${i + 1}`} onClick={() => { setAd(a => ({ ...a, placements: a.placements.filter((_, j) => j !== i) })); setActive(0); }}><Trash2 size={15}/></button>
          </li>)}</ol>
          <button type="button" className="button button-outline button-compact" disabled={ad.placements.length >= 30} onClick={() => { setAd(a => ({ ...a, placements: [...a.placements, { ...blankPlacement(), page: PAGES.find(pg => !a.placements.some(x => x.page === pg && x.slot === 'top')) ?? 'home' }] })); setActive(ad.placements.length); }}><Plus size={14}/> إضافة موضع</button>
        </fieldset>
      </div>

      <div className="ads-editor-preview">
        <div className="ads-preview-head"><b>معاينة الموضع {(Math.min(active, ad.placements.length - 1) + 1).toLocaleString('ar')}</b><span>{pageNames[placement.page]} · {slotNames[placement.slot]}</span></div>
        <PlacementPreview ad={ad} placement={placement}/>
      </div>
    </div>
    {(localErr || error) && <p className="ads-err" role="alert">{localErr || error}</p>}
    <div className="ads-actions ads-sticky">
      <button type="button" className="button button-outline" onClick={() => { setAd(initial); setLocalErr(''); setUpload({ state: 'idle', text: '' }); }} disabled={busy}>استعادة القيم</button>
      <button type="button" className="button button-outline" onClick={onCancel} disabled={busy}>إلغاء</button>
      <button type="submit" className="button button-primary" disabled={busy || upload.state === 'busy'}>{busy ? 'جارٍ الحفظ…' : 'حفظ الإعلان'}</button>
    </div>
  </form>;
}
