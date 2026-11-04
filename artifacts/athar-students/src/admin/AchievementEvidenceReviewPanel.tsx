import { useEffect, useState, type FormEvent } from 'react';
import { useListAdminAchievementEvidence, getListAdminAchievementEvidenceQueryKey } from '@workspace/api-client-react';
import type { AdminAchievementEvidenceItem } from '@workspace/api-client-react';
import { Download, ExternalLink, FileImage, FileText, Film, Link2, Search, ShieldAlert, X } from 'lucide-react';

const numberArabic = (value: number) => value.toLocaleString('ar');
const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
};
const safeDownloadUrl = (value: string) => {
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (isHttpUrl(value)) {
    try { return new URL(value).origin === window.location.origin ? value : null; } catch { return null; }
  }
  return null;
};
const accessUrl = (value: string, access: 'preview' | 'download') => {
  const safe = safeDownloadUrl(value);
  if (!safe) return null;
  try {
    const url = new URL(safe, window.location.origin);
    if (!url.pathname.endsWith('/download')) return null;
    if (access === 'preview') url.pathname = `${url.pathname.slice(0, -'download'.length)}preview`;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
};
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'تاريخ غير متاح' : date.toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
};
const formatSize = (bytes: number | null) => {
  if (!bytes || bytes < 1) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('ar', { maximumFractionDigits: 0 })} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toLocaleString('ar', { maximumFractionDigits: 1 })} ميغابايت`;
};
const kindLabel = (kind: string) => ({
  text: 'نص', link: 'رابط', file: 'ملف', image: 'صورة', video: 'فيديو',
}[kind.toLowerCase()] ?? 'دليل');
const isPending = (item: AdminAchievementEvidenceItem) => /pending|uploading|processing/i.test(item.status);
const isImage = (item: AdminAchievementEvidenceItem) => item.mime?.toLowerCase().startsWith('image/') ?? false;
const isVideo = (item: AdminAchievementEvidenceItem) => ['video/mp4', 'video/webm'].includes(item.mime?.toLowerCase() ?? '');

function EvidenceCard({ item, onPreview }: { item: AdminAchievementEvidenceItem; onPreview: (item: AdminAchievementEvidenceItem) => void }) {
  const pending = isPending(item);
  const rawDownloadUrl = !pending ? item.downloadUrl : null;
  const downloadUrl = rawDownloadUrl ? accessUrl(rawDownloadUrl, 'download') : null;
  const previewable = isImage(item) || isVideo(item) || ['application/pdf', 'text/plain'].includes(item.mime?.toLowerCase() ?? '');
  const previewUrl = rawDownloadUrl && previewable ? accessUrl(rawDownloadUrl, 'preview') : null;
  const file = Boolean(item.mime || item.originalName || item.downloadUrl);
  const link = !file && item.url && isHttpUrl(item.url) ? item.url : null;
  const size = formatSize(item.size);
  return <article className="adm-evidence-card" data-testid={`card-evidence-${item.id}`}>
    <div className="adm-evidence-accent" aria-hidden/>
    <div className="adm-evidence-main">
      <header className="adm-evidence-head">
        <div className="adm-evidence-kind"><span className="adm-evidence-kind-icon" aria-hidden>{file ? <FileText size={17}/> : link ? <Link2 size={17}/> : <FileText size={17}/>}</span>
          <span>{kindLabel(item.kind)}</span>
          {pending && <span className="adm-evidence-status pending">قيد الرفع</span>}
        </div>
        <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
      </header>
      <div className="adm-evidence-copy">
        <h3>{item.title || 'دليل دون عنوان'}</h3>
        <p className="adm-evidence-achievement">{item.achievementTitle}</p>
      </div>
      <div className="adm-evidence-student">
        <span className="adm-evidence-avatar" aria-hidden>{(item.studentName || 'ط').trim().slice(0, 1)}</span>
        <div><b>{item.studentName || 'اسم غير متاح'}</b><span>{[item.studentMajor, item.studentUniversity].filter(Boolean).join(' · ') || 'لا توجد بيانات أكاديمية إضافية'}</span></div>
      </div>
      {item.content && <div className="adm-evidence-text"><span className="adm-sr">نص الدليل</span><p>{item.content}</p></div>}
      {link && <a className="adm-evidence-link" href={link} target="_blank" rel="noopener noreferrer" dir="ltr">
        <span>{new URL(link).hostname}</span><ExternalLink size={14} aria-hidden/><span className="adm-sr">يفتح في نافذة جديدة</span>
      </a>}
      {file && <div className="adm-evidence-file">
        <span className="adm-evidence-file-icon" aria-hidden>{isImage(item) ? <FileImage size={18}/> : isVideo(item) ? <Film size={18}/> : <FileText size={18}/>}</span>
        <span className="adm-evidence-file-name">{item.originalName || item.title || 'ملف مرفق'}{size && <small>{size}</small>}</span>
        {pending ? <span className="adm-evidence-pending-note">لن يتاح الملف قبل اكتمال الرفع</span>
          : downloadUrl && (isImage(item) || isVideo(item))
            ? <div className="adm-evidence-actions"><button type="button" className="button button-outline button-compact" onClick={() => onPreview(item)} aria-label={`معاينة ${item.originalName || item.title}`} data-testid={`button-preview-evidence-${item.id}`}>معاينة</button><a className="button button-outline button-compact adm-evidence-open" href={downloadUrl} download={item.originalName || undefined} aria-label={`تنزيل ${item.originalName || item.title}`} data-testid={`link-download-evidence-${item.id}`}><Download size={14}/> تنزيل</a></div>
            : downloadUrl && previewUrl
              ? <div className="adm-evidence-actions"><a className="button button-outline button-compact adm-evidence-open" href={previewUrl} target="_blank" rel="noopener noreferrer" aria-label={`فتح ${item.originalName || item.title}`} data-testid={`link-open-evidence-${item.id}`}><ExternalLink size={14}/> فتح الملف</a><a className="button button-outline button-compact adm-evidence-open" href={downloadUrl} download={item.originalName || undefined} aria-label={`تنزيل ${item.originalName || item.title}`} data-testid={`link-download-evidence-${item.id}`}><Download size={14}/> تنزيل</a></div>
              : downloadUrl
                ? <div className="adm-evidence-actions"><a className="button button-outline button-compact adm-evidence-open" href={downloadUrl} download={item.originalName || undefined} aria-label={`تنزيل ${item.originalName || item.title}`} data-testid={`link-download-evidence-${item.id}`}><Download size={14}/> تنزيل</a></div>
                : <span className="adm-evidence-pending-note">الملف غير متاح حالياً</span>}
      </div>}
      {!item.content && !link && !file && <p className="adm-evidence-no-content">لا يتوفر محتوى إضافي لهذا الدليل.</p>}
    </div>
  </article>;
}

function PreviewDialog({ item, onClose }: { item: AdminAchievementEvidenceItem; onClose: () => void }) {
  const src = item.downloadUrl ? accessUrl(item.downloadUrl, 'preview') : null;
  const downloadUrl = item.downloadUrl ? accessUrl(item.downloadUrl, 'download') : null;
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  if (!src || !downloadUrl) return null;
  const close = () => onClose();
  return <div className="adm-evidence-preview-scrim" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section className="adm-evidence-preview" role="dialog" aria-modal="true" aria-labelledby="adm-evidence-preview-title" dir="rtl">
      <header><div><span>معاينة خاصة</span><h2 id="adm-evidence-preview-title">{item.originalName || item.title}</h2></div>
        <button type="button" className="icon-button" onClick={close} aria-label="إغلاق المعاينة"><X size={19}/></button></header>
      <div className="adm-evidence-preview-stage">
        {isImage(item) ? <img src={src} alt={`معاينة الدليل: ${item.originalName || item.title}`} />
          : isVideo(item) ? <video src={src} controls playsInline preload="metadata" aria-label={`معاينة الفيديو: ${item.originalName || item.title}`}>يتعذر تشغيل هذا الفيديو في المتصفح.</video>
            : <p>نوع الملف غير مدعوم للمعاينة.</p>}
      </div>
      <footer><a href={src} target="_blank" rel="noopener noreferrer" className="button button-outline button-compact"><ExternalLink size={14}/> فتح الملف</a><a href={downloadUrl} download={item.originalName || undefined} className="button button-outline button-compact"><Download size={14}/> تنزيل</a></footer>
    </section>
  </div>;
}

export function AchievementEvidenceReviewPanel() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<AdminAchievementEvidenceItem | null>(null);
  const params = { search: search || undefined, page };
  const query = useListAdminAchievementEvidence(params, {
    query: { queryKey: getListAdminAchievementEvidenceQueryKey(params), staleTime: 0 },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim().slice(0, 100));
    setPage(1);
  };
  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / Math.max(1, query.data.pageSize))) : 1;
  return <section className="adm-evidence-review" aria-labelledby="adm-evidence-heading">
    <div className="adm-evidence-intro">
      <div><span className="adm-evidence-eyebrow"><ShieldAlert size={14}/> مراجعة خاصة</span><h2 id="adm-evidence-heading">أدلة الإنجاز</h2>
        <p>اطّلع على ما يرفقه الطلاب لتوثيق إنجازاتهم. هذه مساحة مراجعة للقراءة فقط.</p></div>
      <div className="adm-evidence-count" aria-live="polite"><strong>{query.data ? numberArabic(query.data.total) : '—'}</strong><span>دليلاً محفوظاً</span></div>
    </div>
    <form className="adm-search adm-evidence-search" role="search" onSubmit={submit}>
      <label htmlFor="adm-evidence-search" className="adm-sr">ابحث باسم الطالب أو الإنجاز أو عنوان الدليل</label>
      <Search size={17} aria-hidden/><input id="adm-evidence-search" type="search" maxLength={100} value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="اسم الطالب أو الإنجاز أو عنوان الدليل" data-testid="input-evidence-search"/>
      <button type="submit" className="button button-primary button-compact" data-testid="button-search-evidence">بحث</button>
    </form>
    {query.isLoading ? <div className="adm-evidence-skeleton" role="status" aria-label="جارٍ تحميل الأدلة">{[0, 1, 2].map(i => <span key={i}/>)}</div>
      : query.isError || !query.data
        ? <div className="adm-state adm-error" role="alert"><ShieldAlert size={20}/><p>تعذّر تحميل أدلة الإنجاز. حاول مرة أخرى.</p><button type="button" className="button button-outline button-compact" onClick={() => void query.refetch()}>إعادة المحاولة</button></div>
        : query.data.items.length === 0
          ? <div className="adm-evidence-empty"><span aria-hidden><FileText size={22}/></span><b>{search ? 'لا توجد أدلة مطابقة' : 'لا توجد أدلة بعد'}</b><p>{search ? `لم نعثر على نتائج لـ «${search}». جرّب كلمات أخرى.` : 'ستظهر هنا الأدلة التي يضيفها الطلاب إلى إنجازاتهم.'}</p></div>
          : <>
            {query.isFetching && <p className="adm-evidence-updating" role="status">يتم تحديث النتائج…</p>}
            <div className="adm-evidence-list">{query.data.items.map(item => <EvidenceCard key={item.id} item={item} onPreview={setPreview}/>)}</div>
            {query.data.total > query.data.pageSize && <nav className="adm-pager" aria-label="التنقل بين صفحات الأدلة">
              <button type="button" className="button button-outline button-compact" disabled={page <= 1 || query.isFetching} onClick={() => setPage(current => current - 1)} data-testid="button-evidence-previous">السابق</button>
              <span aria-live="polite">صفحة {numberArabic(page)} من {numberArabic(totalPages)} · {numberArabic(query.data.total)} دليلاً</span>
              <button type="button" className="button button-outline button-compact" disabled={page >= totalPages || query.isFetching} onClick={() => setPage(current => current + 1)} data-testid="button-evidence-next">التالي</button>
            </nav>}
          </>}
    {preview && !isPending(preview) && <PreviewDialog item={preview} onClose={() => setPreview(null)}/>}
  </section>;
}
