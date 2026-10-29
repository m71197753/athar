import { useState, type CSSProperties, type MouseEvent } from 'react';
import { ExternalLink, ImageOff, MessageSquareText } from 'lucide-react';
import { type Creative, isHttpUrl, isSafeMedia, isUploadedMedia, videoEmbed } from './shared';
import './ads.css';

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; img-src https: data: blob:; media-src https:; font-src https: data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'";
const srcDoc = (code: string) => `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden}</style></head><body>${code}</body></html>`;

function CodeFrame({ code, title }: { code: string; title: string }) {
  return <iframe className="adc-code" title={`محتوى إعلاني: ${title}`} sandbox="allow-scripts" referrerPolicy="no-referrer" loading="lazy" srcDoc={srcDoc(code)}/>;
}

function MediaFallback({ label }: { label: string }) {
  return <div className="adc-fallback" role="img" aria-label={label}><ImageOff size={20} aria-hidden/><span>{label}</span></div>;
}

function Media({ ad }: { ad: Creative }) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = ad.mediaUrl.trim();
  if (!url || !isSafeMedia(url)) return <MediaFallback label="لا توجد وسائط صالحة"/>;
  if (failed === url) return <MediaFallback label="تعذّر تحميل الوسائط"/>;
  if (ad.format === 'video_link') {
    const embed = videoEmbed(url);
    if (embed) return <iframe className="adc-media" src={embed} title={`فيديو: ${ad.title}`} sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="no-referrer" loading="lazy"/>;
    if (!isUploadedMedia(url) && !/\.(mp4|webm)(?:[?#]|$)/i.test(new URL(url, location.origin).pathname)) return <MediaFallback label="رابط الفيديو غير مدعوم"/>;
    return <video className="adc-media" src={url} controls muted playsInline preload="metadata" onError={() => setFailed(url)} aria-label={ad.title}/>;
  }
  return <img className="adc-media" src={url} alt={ad.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(url)}/>;
}

/**
 * The single creative renderer, shared by the admin preview and published slots.
 * preview=true never emits events, never navigates, and hides the enquiry action.
 */
export function AdCreative({ ad, preview = false, onCta, onEnquire, style, className = '' }: {
  ad: Creative; preview?: boolean; onCta?: () => void; onEnquire?: () => void; style?: CSSProperties; className?: string;
}) {
  const dest = ad.destination.trim();
  const linkOk = isHttpUrl(dest);
  const click = (e: MouseEvent) => { if (preview) { e.preventDefault(); return; } onCta?.(); };
  const showMedia = ad.format === 'image_link' || ad.format === 'video_link' || ad.format === 'image_code';
  return <article className={`adc adc-${ad.format} ${className}`} style={style} dir="rtl" aria-label={`إعلان: ${ad.title}`}>
    <div className="adc-body">
      {showMedia && (linkOk && ad.format !== 'video_link'
        ? <a className="adc-media-wrap adc-media-link" href={dest} target="_blank" rel="noopener noreferrer sponsored" onClick={click} aria-label={`${ad.title} — ${ad.cta}`} aria-disabled={preview || undefined}><Media key={ad.mediaUrl} ad={ad}/></a>
        : <div className="adc-media-wrap"><Media key={ad.mediaUrl} ad={ad}/></div>)}
      {(ad.format === 'code' || ad.format === 'image_code') && <div className="adc-code-wrap">{ad.code.trim() ? <CodeFrame code={ad.code} title={ad.title}/> : <MediaFallback label="لا يوجد كود"/>}</div>}
      {ad.format === 'text_link' && <div className="adc-text"><b>{ad.title || 'عنوان الإعلان'}</b></div>}
    </div>
    <footer className="adc-bar">
      <span className="adc-tag">إعلان</span>
      {ad.format !== 'text_link' && <span className="adc-title">{ad.title}</span>}
      <span className="adc-actions">
        {!preview && onEnquire && <button type="button" className="adc-enq" onClick={onEnquire}><MessageSquareText size={13} aria-hidden/> استفسار</button>}
        {linkOk
          ? <a className="adc-cta" href={dest} target="_blank" rel="noopener noreferrer sponsored" onClick={click} aria-disabled={preview || undefined}>{ad.cta || 'المزيد'} <ExternalLink size={12} aria-hidden/><span className="ads-sr">(يفتح في نافذة جديدة)</span></a>
          : dest ? <span className="adc-cta adc-cta-off">{ad.cta || 'المزيد'}</span> : null}
      </span>
    </footer>
  </article>;
}
