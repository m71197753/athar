import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BadgeCheck, Bell, BookOpen, BriefcaseBusiness, ExternalLink, FileClock, Layers3, LayoutGrid, Link2Off, Megaphone, Paperclip,
  Languages, Palette, Pencil, Plus, RotateCcw, Search, Settings2, ShieldAlert, ShieldCheck, Trash2, Users, X,
} from 'lucide-react';
import {
  useGetPlatformAccess, useGetAdminOverview, useGetAdminOverviewDetails, useListAdminUsers, useUpdateAdminUser, useRevokeAdminUserShare,
  useGetAdminContent, useCreateAdminContent, useUpdateAdminContent, useDeleteAdminContent,
  useGetAdminSettings, useSaveAdminSettings, useListAdminAudit, useGetPlatformContent,
  useListAdminSections, useCreateAdminSection, useUpdateAdminSection, useDeleteAdminSection,
  getGetPlatformAccessQueryKey, getGetAdminOverviewQueryKey, getGetAdminOverviewDetailsQueryKey, getListAdminUsersQueryKey, getGetAdminContentQueryKey,
  getGetAdminSettingsQueryKey, getListAdminAuditQueryKey, getGetPlatformContentQueryKey,
  getListAdminSectionsQueryKey,
  getListAdminNotificationsQueryKey, useListAdminNotifications,
} from '@workspace/api-client-react';
import type { AdminNotification, AdminOverviewDetailsKind, AdminUser, AppearanceSettings, ContentEntry, ContentInput, ModuleSetting, PlatformSection, SectionBlock, SectionInput } from '@workspace/api-client-react';
import { ThemeToggle } from '../components/theme-toggle';
import { formatSectionMediaCleanupAuditTarget } from '../lib/section-media-cleanup-audit';
import { NamedColorPicker } from '../components/NamedColorPicker';
import { RequiredMark } from '../components/RequiredMark';
import { SectionAppearanceFields } from '../components/SectionAppearanceFields';
import './admin.css';
import AdsAdminPanel from '../ads/AdsAdminPanel';
import { AcademyAdminPanel } from '../academy';
import { APPEARANCE_PRESETS, DEFAULT_APPEARANCE, ICON_SHAPES, PLATFORM_FONTS, appearanceContrast, getAppearanceIconRadius, getAppearanceTextColor } from '../lib/platform-appearance';
import { SectionsAdminPanel } from './SectionsAdminPanel';
import { GraduatesAdminPanel } from './GraduatesAdminPanel';
import { SectionContentBlockEditor } from './SectionContentBlockEditor';
import { AdminNotificationsPanel } from './AdminNotificationsPanel';
import LanguageAdminPanel from './LanguageAdminPanel';
import { ModuleSubmissionsAdminPanel } from './ModuleSubmissionsAdminPanel';
import { AchievementEvidenceReviewPanel } from './AchievementEvidenceReviewPanel';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const validSectionMediaUrl = (value: string) => /^\/api\/platform\/section-media\/[a-f0-9-]{36}$/i.test(value);
type Tab = 'overview' | 'notifications' | 'users' | 'content' | 'sections' | 'module-submissions' | 'evidence-review' | 'academy' | 'languages' | 'graduates' | 'ads' | 'settings' | 'audit';
const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: LayoutGrid },
  { id: 'notifications', label: 'الإشعارات', icon: Bell },
  { id: 'users', label: 'الحسابات', icon: Users },
  { id: 'content', label: 'المحتوى', icon: Megaphone },
  { id: 'sections', label: 'إدارة الأقسام', icon: Layers3 },
  { id: 'module-submissions', label: 'ملفات الطلاب', icon: ShieldCheck },
  { id: 'evidence-review', label: 'أدلة الإنجاز', icon: Paperclip },
  { id: 'academy', label: 'المذاكرة', icon: BookOpen },
  { id: 'languages', label: 'تعلم اللغات', icon: Languages },
  { id: 'graduates', label: 'الخريجون', icon: BriefcaseBusiness },
  { id: 'ads', label: 'الإعلانات والعملاء', icon: Megaphone },
  { id: 'settings', label: 'الإعدادات', icon: Settings2 },
  { id: 'audit', label: 'سجل النشاط', icon: FileClock },
];

function statusOf(err: unknown): number | undefined {
  return typeof err === 'object' && err && 'status' in err ? Number((err as { status: unknown }).status) : undefined;
}
function errText(err: unknown) {
  const s = statusOf(err);
  if (s === 401 || s === 403) return 'ليست لديك صلاحية لتنفيذ هذا الإجراء.';
  if (s === 400 || s === 422) return 'البيانات المرسلة غير صالحة. راجع الحقول وحاول مجدداً.';
  if (s === 409) return 'لا يمكن تنفيذ هذا التغيير على حسابك الخاص.';
  return 'تعذّر إكمال العملية. حاول مرة أخرى.';
}
const isHttpUrl = (v: string) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };
const isSafeContentUrl = (value: string) => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } };
const fmtDate = (d: string) => new Date(d).toLocaleString('ar', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const num = (n: number) => n.toLocaleString('ar');

function Brand() { return <span className="brand-lockup brand-small"><img className="brand-image" src={`${basePath}/athar-wordmark-3d.png`} alt="أثر"/></span>; }

function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="adm-skeleton" role="status" aria-label="جارٍ التحميل">{Array.from({ length: rows }).map((_, i) => <span key={i}/>)}</div>;
}
function ErrorBox({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="adm-state adm-error" role="alert"><ShieldAlert size={20}/><p>{errText(error)}</p><button type="button" className="button button-outline button-compact" onClick={retry}>إعادة المحاولة</button></div>;
}
function Empty({ title, body }: { title: string; body: string }) {
  return <div className="adm-state"><b>{title}</b><p>{body}</p></div>;
}

function Confirm({ title, body, confirmLabel, danger, busy, error, onConfirm, onCancel }: { title: string; body: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; error?: string; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
      if (e.key === 'Tab') {
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) { e.preventDefault(); return; }
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onCancel, busy]);
  return <div className="adm-scrim" onMouseDown={e => { if (!busy && e.target === e.currentTarget) onCancel(); }}>
    <div className="adm-dialog" ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="adm-confirm-title" dir="rtl">
      <h2 id="adm-confirm-title">{title}</h2><div className="adm-dialog-body">{body}</div>
      {error && <p className="adm-form-error" role="alert">{error}</p>}
      <div className="adm-dialog-actions">
        <button type="button" className="button button-outline" ref={ref} onClick={onCancel} disabled={busy}>إلغاء</button>
        <button type="button" className={`button ${danger ? 'adm-danger' : 'button-primary'}`} onClick={onConfirm} disabled={busy}>{busy ? 'جارٍ التنفيذ…' : confirmLabel}</button>
      </div>
    </div>
  </div>;
}

function useRefreshAll() {
  const qc = useQueryClient();
  return (...keys: readonly (readonly unknown[])[]) => {
    for (const k of keys) qc.invalidateQueries({ queryKey: k as unknown[] });
    qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
    qc.invalidateQueries({ queryKey: ['/api/admin/audit'] });
  };
}

/* ---------- Overview ---------- */
const overviewKindLabels: Record<AdminOverviewDetailsKind, string> = {
  accounts: 'الحسابات',
  students: 'ملفات الطلاب',
  admins: 'المشرفون',
  suspended: 'الحسابات الموقوفة',
  achievements: 'الإنجازات',
  learningItems: 'عناصر التعلّم',
  careerPlans: 'الخطط المهنية',
  activeShares: 'الروابط العامة',
};
function OverviewDetails({ kind, onClose }: { kind: AdminOverviewDetailsKind; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const params = { kind, page };
  const query = useGetAdminOverviewDetails(params, {
    query: { queryKey: getGetAdminOverviewDetailsQueryKey(params), staleTime: 0 },
  });
  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return <div className="adm-details-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="adm-details-dialog" role="dialog" aria-modal="true" aria-labelledby="adm-details-title" dir="rtl">
      <header className="adm-details-head">
        <div><span>بيانات لوحة الإشراف</span><h2 id="adm-details-title">{overviewKindLabels[kind]}</h2>
          {query.data && <small>{num(query.data.total)} سجل</small>}</div>
        <button ref={closeRef} type="button" className="icon-button" aria-label="إغلاق التفاصيل" onClick={onClose}><X size={18}/></button>
      </header>
      {query.isLoading ? <Skeleton rows={4}/>
        : query.isError || !query.data ? <ErrorBox error={query.error} retry={() => query.refetch()}/>
          : query.data.items.length === 0 ? <div className="adm-details-empty">لا توجد بيانات في هذا القسم حتى الآن.</div>
            : <div className="adm-details-list">{query.data.items.map(item => <article className="adm-details-row" key={item.id}>
                <div className="adm-details-row-copy"><b>{item.title}</b><p>{item.subtitle || 'لا توجد تفاصيل إضافية'}</p>
                  <small dir="ltr">{item.ownerId}</small></div>
                <time>{Number.isNaN(Date.parse(item.updatedAt)) ? '' : new Date(item.updatedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</time>
              </article>)}</div>}
      {query.data && query.data.total > query.data.pageSize && <div className="adm-details-pager">
        <button type="button" className="button button-outline button-compact" disabled={page <= 1 || query.isFetching} onClick={() => setPage(current => current - 1)}>السابق</button>
        <span>صفحة {num(page)} من {num(Math.ceil(query.data.total / query.data.pageSize))}</span>
        <button type="button" className="button button-outline button-compact" disabled={page * query.data.pageSize >= query.data.total || query.isFetching} onClick={() => setPage(current => current + 1)}>التالي</button>
      </div>}
    </section>
  </div>;
}

function Overview() {
  const [selectedKind, setSelectedKind] = useState<AdminOverviewDetailsKind | null>(null);
  const q = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey() } });
  if (q.isLoading) return <Skeleton rows={4}/>;
  if (q.isError || !q.data) return <ErrorBox error={q.error} retry={() => q.refetch()}/>;
  const d = q.data;
  const cells: [AdminOverviewDetailsKind, string, number, string][] = [
    ['accounts', 'الحسابات', d.accounts, 'كل حسابات المصادقة'], ['students', 'ملفات الطلاب', d.students, 'ملفات شخصية محفوظة'],
    ['admins', 'المشرفون', d.admins, 'دور مشرف'], ['suspended', 'موقوفون', d.suspended, 'حسابات معلّقة'],
    ['achievements', 'الإنجازات', d.achievements, 'موثّقة على المنصة'], ['learningItems', 'عناصر التعلّم', d.learningItems, 'دورات ومحاضرات'],
    ['careerPlans', 'خطط مهنية', d.careerPlans, 'خطط محفوظة'], ['activeShares', 'روابط عامة', d.activeShares, 'ملفات منشورة حالياً'],
  ];
  return <>
    <div className="adm-ledger">{cells.map(([kind, label, value, summary], index) => <button key={kind} type="button"
      className={`adm-tally adm-tally-button ${index === 0 ? 'adm-tally-lead' : ''} ${kind === 'suspended' && value > 0 ? 'adm-tally-warn' : ''}`}
      onClick={() => setSelectedKind(kind)} aria-haspopup="dialog" aria-label={`عرض بيانات ${label}: ${num(value)} سجل`}
      data-testid={`admin-tally-${kind}`}>
      <span>{label}</span><strong>{num(value)}</strong><small>{summary}</small><em>عرض البيانات</em></button>)}</div>
    {selectedKind && <OverviewDetails kind={selectedKind} onClose={() => setSelectedKind(null)}/>}
  </>;
}

/* ---------- Users ---------- */
type PendingUser = { kind: 'role' | 'status' | 'revoke'; user: AdminUser };
function UsersPanel({ selfId }: { selfId: string }) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const params = { search: search || undefined, page };
  const q = useListAdminUsers(params, { query: { queryKey: getListAdminUsersQueryKey(params) } });
  const update = useUpdateAdminUser();
  const revoke = useRevokeAdminUserShare();
  const refresh = useRefreshAll();
  const [pending, setPending] = useState<PendingUser | null>(null);
  const [actionError, setActionError] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); setSearch(input.trim().slice(0, 100)); setPage(1); };
  const close = () => { setPending(null); setActionError(''); };
  const done = () => { refresh(['/api/admin/users'], getGetPlatformAccessQueryKey()); close(); };
  const run = () => {
    if (!pending) return;
    const u = pending.user;
    if (pending.kind === 'revoke') { revoke.mutate({ userId: u.userId }, { onSuccess: done, onError: e => setActionError(errText(e)) }); return; }
    const data = pending.kind === 'role'
      ? { role: u.role === 'admin' ? 'student' as const : 'admin' as const, status: u.status }
      : { role: u.role, status: u.status === 'active' ? 'suspended' as const : 'active' as const };
    update.mutate({ userId: u.userId, data }, { onSuccess: done, onError: e => setActionError(errText(e)) });
  };
  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / Math.max(1, q.data.pageSize))) : 1;
  return <section aria-labelledby="adm-users-h">
    <div className="adm-section-head"><h2 id="adm-users-h">الحسابات والأدوار</h2>
      <form className="adm-search" onSubmit={submit} role="search">
        <label htmlFor="adm-user-search" className="adm-sr">ابحث بالاسم أو البريد</label>
        <Search size={16} aria-hidden/><input id="adm-user-search" type="search" maxLength={100} value={input} onChange={e => setInput(e.target.value)} placeholder="الاسم أو البريد الإلكتروني"/>
        <button type="submit" className="button button-primary button-compact">بحث</button>
      </form>
    </div>
    {q.isLoading ? <Skeleton rows={5}/> : q.isError || !q.data ? <ErrorBox error={q.error} retry={() => q.refetch()}/> : q.data.items.length === 0
      ? <Empty title="لا توجد حسابات مطابقة" body={search ? `لا نتائج لـ «${search}».` : 'لم يُسجَّل أي حساب بعد.'}/>
      : <>
        <ul className="adm-rows">{q.data.items.map(u => {
          const self = u.userId === selfId;
          return <li key={u.userId} className="adm-user">
            <span className="adm-avatar" aria-hidden>{(u.name || u.email || '؟').slice(0, 1)}</span>
            <div className="adm-user-meta">
              <b>{u.name || 'بدون اسم'}{self && <em className="adm-chip adm-chip-self">أنت</em>}</b>
              <span dir="ltr" className="adm-email">{u.email || '—'}</span>
              <span className="adm-chips">
                <em className={`adm-chip ${u.verified ? 'adm-chip-ok' : 'adm-chip-warn'}`}>{u.verified ? 'بريد موثّق' : 'بريد غير موثّق'}</em>
                <em className={`adm-chip ${u.role === 'admin' ? 'adm-chip-admin' : ''}`}>{u.role === 'admin' ? 'مشرف' : 'طالب'}</em>
                <em className={`adm-chip ${u.status === 'suspended' ? 'adm-chip-bad' : 'adm-chip-ok'}`}>{u.status === 'suspended' ? 'موقوف' : 'نشط'}</em>
                {u.shared && <em className="adm-chip">رابط عام فعّال</em>}
                <small>انضم {new Date(u.createdAt).toLocaleDateString('ar')}</small>
              </span>
            </div>
            <div className="adm-user-actions">
              <button type="button" className="button button-outline button-compact" disabled={self} title={self ? 'لا يمكنك تغيير دورك' : undefined} onClick={() => setPending({ kind: 'role', user: u })}>{u.role === 'admin' ? 'إرجاع لطالب' : 'ترقية لمشرف'}</button>
              <button type="button" className={`button button-compact ${u.status === 'active' ? 'adm-danger-outline' : 'button-outline'}`} disabled={self} onClick={() => setPending({ kind: 'status', user: u })}>{u.status === 'active' ? 'إيقاف' : 'إعادة تفعيل'}</button>
              {u.shared && <button type="button" className="button button-outline button-compact" onClick={() => setPending({ kind: 'revoke', user: u })}><Link2Off size={14}/> إلغاء الرابط</button>}
            </div>
          </li>;
        })}</ul>
        <Pager page={page} total={totalPages} count={q.data.total} onPage={setPage} busy={q.isFetching}/>
      </>}
    {pending && <Confirm
      title={pending.kind === 'revoke' ? 'إلغاء الرابط العام' : pending.kind === 'role' ? 'تغيير الدور' : pending.user.status === 'active' ? 'إيقاف الحساب' : 'إعادة تفعيل الحساب'}
      body={<p>{pending.kind === 'revoke' ? `سيتوقف رابط الملف العام لـ ${pending.user.name || pending.user.email} فوراً. لن تُحذف أي بيانات.`
        : pending.kind === 'role' ? `سيصبح ${pending.user.name || pending.user.email} ${pending.user.role === 'admin' ? 'طالباً دون صلاحيات إشراف' : 'مشرفاً بصلاحيات كاملة على المنصة'}.`
        : pending.user.status === 'active' ? `لن يتمكن ${pending.user.name || pending.user.email} من استخدام المنصة حتى إعادة التفعيل.` : `سيستعيد ${pending.user.name || pending.user.email} الوصول إلى المنصة.`}</p>}
      confirmLabel="تأكيد" danger={pending.kind !== 'role' && !(pending.kind === 'status' && pending.user.status === 'suspended')}
      busy={update.isPending || revoke.isPending} error={actionError} onConfirm={run} onCancel={close}/>}
  </section>;
}

function Pager({ page, total, count, onPage, busy }: { page: number; total: number; count: number; onPage: (p: number) => void; busy?: boolean }) {
  return <nav className="adm-pager" aria-label="التنقل بين الصفحات">
    <button type="button" className="button button-outline button-compact" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>السابق</button>
    <span aria-live="polite">صفحة {num(page)} من {num(total)} · {num(count)} سجل</span>
    <button type="button" className="button button-outline button-compact" disabled={page >= total || busy} onClick={() => onPage(page + 1)}>التالي</button>
  </nav>;
}

/* ---------- Content ---------- */
const blank: ContentInput = { kind: 'announcement', title: '', description: '', url: '', published: false };
function ContentPanel() {
  const q = useGetAdminContent({ query: { queryKey: getGetAdminContentQueryKey() } });
  const create = useCreateAdminContent();
  const update = useUpdateAdminContent();
  const del = useDeleteAdminContent();
  const refresh = useRefreshAll();
  const [editing, setEditing] = useState<{ id?: string; form: ContentInput } | null>(null);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState<ContentEntry | null>(null);
  const [delError, setDelError] = useState('');
  const [rowError, setRowError] = useState('');
  const after = () => refresh(getGetAdminContentQueryKey(), getGetPlatformContentQueryKey());
  const set = <K extends keyof ContentInput>(k: K, v: ContentInput[K]) => setEditing(e => e && { ...e, form: { ...e.form, [k]: v } });
  const save = (e: FormEvent) => {
    e.preventDefault(); if (!editing) return;
    const f = { ...editing.form, title: editing.form.title.trim(), description: editing.form.description.trim(), url: editing.form.url.trim() };
    if (!f.title) return setFormError('العنوان مطلوب.');
    if (f.kind === 'resource' && !f.url) return setFormError('رابط المصدر مطلوب.');
    if (f.url && !isHttpUrl(f.url)) return setFormError('يجب أن يبدأ الرابط بـ http:// أو https://');
    setFormError('');
    const ok = { onSuccess: () => { after(); setEditing(null); }, onError: (er: unknown) => setFormError(errText(er)) };
    if (editing.id) update.mutate({ id: editing.id, data: f }, ok); else create.mutate({ data: f }, ok);
  };
  const togglePublish = (c: ContentEntry) => {
    setRowError('');
    update.mutate({ id: c.id, data: { kind: c.kind, title: c.title, description: c.description, url: c.url, published: !c.published } }, { onSuccess: after, onError: er => setRowError(errText(er)) });
  };
  return <section aria-labelledby="adm-content-h">
    <div className="adm-section-head"><h2 id="adm-content-h">الإعلانات والمصادر</h2>
      <button type="button" className="button button-primary button-compact" onClick={() => { setFormError(''); setEditing({ form: { ...blank } }); }}><Plus size={15}/> محتوى جديد</button></div>
    {rowError && <p className="adm-form-error" role="alert">{rowError}</p>}
    {editing && <form className="adm-editor" onSubmit={save} aria-label={editing.id ? 'تعديل المحتوى' : 'إنشاء محتوى'}>
      <fieldset className="adm-kind"><legend>النوع</legend>
        {(['announcement', 'resource'] as const).map(k => <label key={k} className={editing.form.kind === k ? 'on' : ''}><input type="radio" name="kind" checked={editing.form.kind === k} onChange={() => set('kind', k)}/>{k === 'announcement' ? 'إعلان' : 'مصدر تعلّم'}</label>)}
      </fieldset>
      <label className="adm-field"><span>العنوان <RequiredMark/></span><input required maxLength={160} value={editing.form.title} onChange={e => set('title', e.target.value)}/></label>
      <label className="adm-field"><span>الوصف</span><textarea rows={3} maxLength={2000} value={editing.form.description} onChange={e => set('description', e.target.value)}/></label>
      <label className="adm-field"><span>الرابط {editing.form.kind === 'resource' ? <RequiredMark/> : '(اختياري)'}</span><input type="url" dir="ltr" maxLength={2000} required={editing.form.kind === 'resource'} placeholder="https://" value={editing.form.url} onChange={e => set('url', e.target.value)}/></label>
      <label className="adm-switch"><input type="checkbox" checked={editing.form.published} onChange={e => set('published', e.target.checked)}/><span>{editing.form.published ? 'منشور للطلاب' : 'مسودة — لا يراها الطلاب'}</span></label>
      {formError && <p className="adm-form-error" role="alert">{formError}</p>}
      <div className="adm-dialog-actions"><button type="button" className="button button-outline" onClick={() => setEditing(null)}>إلغاء</button><button type="submit" className="button button-primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'جارٍ الحفظ…' : 'حفظ'}</button></div>
    </form>}
    {q.isLoading ? <Skeleton rows={4}/> : q.isError || !q.data ? <ErrorBox error={q.error} retry={() => q.refetch()}/> : q.data.items.length === 0
      ? <Empty title="لا يوجد محتوى بعد" body="أنشئ أول إعلان أو مصدر ليظهر للطلاب بعد نشره."/>
      : <ul className="adm-rows">{q.data.items.map(c => <li key={c.id} className="adm-content-row">
        <span className={`adm-kind-mark ${c.kind}`} aria-hidden>{c.kind === 'resource' ? <BookOpen size={17}/> : <Megaphone size={17}/>}</span>
        <div className="adm-user-meta"><b>{c.title}</b>{c.description && <p className="adm-desc">{c.description}</p>}
          <span className="adm-chips"><em className="adm-chip">{c.kind === 'resource' ? 'مصدر' : 'إعلان'}</em><em className={`adm-chip ${c.published ? 'adm-chip-ok' : 'adm-chip-warn'}`}>{c.published ? 'منشور' : 'مسودة'}</em>{c.url && isHttpUrl(c.url) && <a className="adm-link" href={c.url} target="_blank" rel="noopener noreferrer" dir="ltr">{new URL(c.url).hostname}</a>}<small>آخر تحديث {fmtDate(c.updatedAt)}</small></span></div>
        <div className="adm-user-actions">
          <button type="button" className="button button-outline button-compact" disabled={update.isPending} onClick={() => togglePublish(c)}>{c.published ? 'إرجاع لمسودة' : 'نشر'}</button>
          <button type="button" className="icon-button" aria-label={`تعديل ${c.title}`} onClick={() => { setFormError(''); setEditing({ id: c.id, form: { kind: c.kind, title: c.title, description: c.description, url: c.url, published: c.published } }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={16}/></button>
          <button type="button" className="icon-button danger-icon" aria-label={`حذف ${c.title}`} onClick={() => { setDelError(''); setToDelete(c); }}><Trash2 size={16}/></button>
        </div></li>)}</ul>}
    {toDelete && <Confirm title="حذف المحتوى" body={<p>سيُحذف «{toDelete.title}» نهائياً ويختفي من مساحة الطلاب.</p>} confirmLabel="حذف" danger busy={del.isPending} error={delError}
      onCancel={() => setToDelete(null)} onConfirm={() => del.mutate({ id: toDelete.id }, { onSuccess: () => { after(); setToDelete(null); if (editing?.id === toDelete.id) setEditing(null); }, onError: e => setDelError(errText(e)) })}/>}
  </section>;
}

/* ---------- Settings ---------- */
function SettingsPanel({ onOpenAcademy }: { onOpenAcademy: () => void }) {
  const q = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey(), refetchOnWindowFocus: false } });
  const save = useSaveAdminSettings();
  const refresh = useRefreshAll();
  const [moduleDraft, setModuleDraft] = useState<ModuleSetting[] | null>(null);
  const [appearanceDraft, setAppearanceDraft] = useState<AppearanceSettings | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!q.data) return;
    if (moduleDraft === null) setModuleDraft(q.data.moduleSettings);
    if (appearanceDraft === null) setAppearanceDraft(q.data.appearance);
  }, [q.data, moduleDraft, appearanceDraft]);
  if (q.isLoading || (q.data && (moduleDraft === null || appearanceDraft === null))) return <Skeleton rows={5}/>;
  if (q.isError || !moduleDraft || !appearanceDraft || !q.data) return <ErrorBox error={q.error} retry={() => q.refetch()}/>;
  const serverModules = q.data.moduleSettings;
  const serverAppearance = q.data.appearance;
  const iconColor = appearanceDraft.iconColor ?? DEFAULT_APPEARANCE.iconColor ?? appearanceDraft.primaryColor;
  const iconShape = appearanceDraft.iconShape ?? DEFAULT_APPEARANCE.iconShape ?? 'rounded';
  const iconRadius = getAppearanceIconRadius(iconShape);
  const canonicalModules = (modules: ModuleSetting[]) => [...modules].sort((a, b) => a.key.localeCompare(b.key));
  const modulesDirty = JSON.stringify(canonicalModules(moduleDraft)) !== JSON.stringify(canonicalModules(serverModules));
  const appearanceDirty = JSON.stringify(appearanceDraft) !== JSON.stringify(serverAppearance);
  const dirty = modulesDirty || appearanceDirty;
  const updateModule = (key: ModuleSetting['key'], patch: Partial<ModuleSetting>) => {
    setMsg(null);
    setModuleDraft(current => current?.map(module => module.key === key ? { ...module, ...patch } : module) ?? null);
  };
  const updateContentBlock = (key: ModuleSetting['key'], index: number, patch: Partial<SectionBlock>) => {
    const blocks = moduleDraft?.find(module => module.key === key)?.blocks ?? [];
    updateModule(key, { blocks: blocks.map((block, i) => i === index ? { ...block, ...patch } : block) });
  };
  const replaceContentBlockWithBatch = (key: ModuleSetting['key'], index: number, uploaded: SectionBlock[]) => {
    setMsg(null);
    setModuleDraft(current => current?.map(module => module.key === key
      ? { ...module, blocks: [...(module.blocks ?? []).slice(0, index), ...uploaded, ...(module.blocks ?? []).slice(index + 1)] }
      : module) ?? null);
  };
  const moveContentBlock = (key: ModuleSetting['key'], index: number, direction: -1 | 1) => {
    const blocks = moduleDraft?.find(module => module.key === key)?.blocks ?? [];
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    updateModule(key, { blocks: reordered });
  };
  const addContentBlock = (key: ModuleSetting['key']) => {
    const blocks = moduleDraft?.find(module => module.key === key)?.blocks ?? [];
    if (blocks.length >= 20) return;
    updateModule(key, { blocks: [...blocks, { type: 'text', title: '', body: '', url: '' }] });
  };
  const removeContentBlock = (key: ModuleSetting['key'], index: number) => {
    const blocks = moduleDraft?.find(module => module.key === key)?.blocks ?? [];
    updateModule(key, { blocks: blocks.filter((_, i) => i !== index) });
  };
  const updateAppearance = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
    setMsg(null);
    setAppearanceDraft(current => current && { ...current, [key]: value });
  };
  const choosePreset = (preset: AppearanceSettings) => {
    setMsg(null);
    setAppearanceDraft(current => current && ({ ...current, primaryColor: preset.primaryColor, accentColor: preset.accentColor, canvasColor: preset.canvasColor, surfaceColor: preset.surfaceColor, textColor: preset.textColor, headingColor: preset.headingColor, cardTextColor: preset.cardTextColor, cardBorderColor: preset.cardBorderColor, iconColor: preset.iconColor ?? preset.primaryColor }));
  };
  const persist = (modules: ModuleSetting[], appearance: AppearanceSettings) => {
    const invalidContent = modules.some(module => (module.blocks ?? []).length > 20 || (module.blocks ?? []).some(block =>
      !block.title.trim() || (block.type === 'text'
        ? !block.body.trim() || block.url !== ''
        : block.type === 'link'
          ? !isSafeContentUrl(block.url)
          : !validSectionMediaUrl(block.url) || !block.mediaType)));
    if (invalidContent) {
      setMsg({ ok: false, text: 'أكمل عنوان كل عنصر، وأرفق ملفًا صالحًا للمحتوى من نوع مرفق.' });
      return;
    }
    const ordered = [...modules].sort((a, b) => a.sortOrder - b.sortOrder);
    save.mutate({ data: { moduleSettings: ordered, appearance } }, {
      onSuccess: () => { setModuleDraft(ordered); setAppearanceDraft(appearance); setMsg({ ok: true, text: 'تم حفظ التغييرات وتطبيقها على المنصة.' }); refresh(getGetAdminSettingsQueryKey(), getGetPlatformContentQueryKey(), getGetPlatformAccessQueryKey()); },
      onError: e => setMsg({ ok: false, text: errText(e) }),
    });
  };
  return <section aria-labelledby="adm-settings-h">
    <div className="adm-section-head"><h2 id="adm-settings-h">إعداد كل قسم</h2>
      <button type="button" className="button button-outline button-compact" disabled={moduleDraft.every(module => module.enabled)} onClick={() => { setModuleDraft(moduleDraft.map(module => ({ ...module, enabled: true }))); setMsg(null); }}>تفعيل الكل</button></div>
    <p className="adm-note">عدّل الاسم والوصف والترتيب أو أوقف أي قسم بشكل مستقل. الإيقاف يخفيه عن الطلاب ويحمي مساره.</p>
    <div className="adm-module-editor-list">{[...moduleDraft].sort((a, b) => a.sortOrder - b.sortOrder).map(module => {
      const blocks = module.blocks ?? [];
      return <article key={module.key} className={`adm-module-editor ${module.enabled ? 'on' : ''}`} data-testid={`module-editor-${module.key}`}>
        <label className="adm-module-switch"><input type="checkbox" checked={module.enabled} onChange={e => updateModule(module.key, { enabled: e.target.checked })}/><span><b>{module.title}</b><small>{module.enabled ? 'مفعّل للطلاب' : 'متوقف عن الطلاب'}</small></span></label>
        <div className="adm-module-fields">
           <label className="adm-field"><span>اسم القسم <RequiredMark/></span><input required minLength={2} maxLength={80} value={module.title} onChange={e => updateModule(module.key, { title: e.target.value })} data-testid={`input-module-title-${module.key}`}/></label>
          <label className="adm-field"><span>الترتيب في الصفحة</span><input type="number" min={0} max={999} value={module.sortOrder} onChange={e => updateModule(module.key, { sortOrder: Math.min(999, Math.max(0, Number(e.target.value) || 0)) })} data-testid={`input-module-order-${module.key}`}/></label>
          <label className="adm-field adm-module-description"><span>وصف القسم</span><textarea maxLength={240} rows={2} value={module.description} onChange={e => updateModule(module.key, { description: e.target.value })} data-testid={`input-module-description-${module.key}`}/></label>
        </div>
        <SectionAppearanceFields
          iconKey={module.iconKey ?? 'book'}
          accentKey={module.accentKey ?? 'teal'}
          cardStyle={module.cardStyle ?? 'soft'}
          onIconChange={iconKey => updateModule(module.key, { iconKey })}
          onAccentChange={accentKey => updateModule(module.key, { accentKey })}
          onCardStyleChange={cardStyle => updateModule(module.key, { cardStyle })}
          previewTitle={module.title}
        />
        <div className="adm-section-block-heading adm-module-content-heading">
           <div><h4>محتوى داخل القسم</h4><p>اجمع الروابط والفيديوهات والملفات في القائمة نفسها، وارفع عدة ملفات دفعة واحدة.</p></div>
          <button type="button" className="button button-outline button-compact" disabled={blocks.length >= 20} onClick={() => addContentBlock(module.key)} data-testid={`button-add-module-content-${module.key}`}><Plus size={14}/> إضافة محتوى</button>
        </div>
        {blocks.length === 0
          ? <p className="adm-module-empty-content">لا يوجد محتوى إضافي لهذا القسم.</p>
          : <div className="adm-section-block-list">{blocks.map((block, index) => <article className="adm-section-block" key={`${module.key}-${index}`} data-testid={`module-content-block-${module.key}-${index}`}>
            <div className="adm-section-block-top"><b>محتوى {num(index + 1)}</b><div className="adm-section-block-tools">
              <button type="button" className="icon-button" aria-label={`تحريك محتوى ${module.title} ${num(index + 1)} لأعلى`} disabled={index === 0} onClick={() => moveContentBlock(module.key, index, -1)} data-testid={`button-move-module-content-up-${module.key}-${index}`}><ArrowUp size={15}/></button>
              <button type="button" className="icon-button" aria-label={`تحريك محتوى ${module.title} ${num(index + 1)} لأسفل`} disabled={index === blocks.length - 1} onClick={() => moveContentBlock(module.key, index, 1)} data-testid={`button-move-module-content-down-${module.key}-${index}`}><ArrowDown size={15}/></button>
              <button type="button" className="icon-button danger-icon" aria-label={`حذف محتوى ${module.title} ${num(index + 1)}`} onClick={() => removeContentBlock(module.key, index)} data-testid={`button-remove-module-content-${module.key}-${index}`}><Trash2 size={15}/></button>
            </div></div>
             <SectionContentBlockEditor
               block={block}
               name={`module-content-type-${module.key}-${index}`}
               testIdPrefix={`input-module-content-${module.key}-${index}`}
               maxBatchFileCount={21 - blocks.length}
               onChange={patch => updateContentBlock(module.key, index, patch)}
               onUploadMany={uploaded => replaceContentBlockWithBatch(module.key, index, uploaded)}
             />
          </article>)}</div>}
        {module.key === 'academy' && <div className="adm-academy-content-shortcut">
          <p>تُدار الدروس والاختبارات وأسئلتها من محرر المذاكرة.</p>
          <button type="button" className="button button-outline button-compact" onClick={onOpenAcademy} data-testid="button-open-academy-content">إدارة الدروس والاختبارات</button>
        </div>}
      </article>;
    })}</div>
    <section className="adm-appearance" aria-labelledby="adm-appearance-title">
      <div className="adm-appearance-heading"><span className="adm-appearance-mark"><Palette size={18}/></span><div><h2 id="adm-appearance-title">الخطوط وألوان الواجهة</h2><p>إعدادات عامة لكل الطلاب، تشمل لون الأيقونات وشكل خلفيتها. يحتفظ الوضع الداكن بتباين مريح للقراءة.</p></div></div>
      <label className="adm-field"><span>خط المنصة</span><select value={appearanceDraft.fontFamily ?? 'IBM Plex Sans Arabic'} onChange={e => updateAppearance('fontFamily', e.target.value as AppearanceSettings['fontFamily'])} data-testid="select-platform-font">
        <option value="IBM Plex Sans Arabic">أثر — نص واضح وعناوين كايرو</option>
        <option value="Cairo">كايرو — عربي هندسي</option>
        <option value="Tahoma">تاهوما — كلاسيكي واضح</option>
        <option value="Arial">أريال — بسيط ورسمي</option>
      </select></label>
      <label className="adm-field"><span>حجم خط الواجهة — {appearanceDraft.fontScale ?? 100}%</span>
        <input type="range" min={90} max={130} step={5} value={appearanceDraft.fontScale ?? 100} onChange={e => updateAppearance('fontScale', Number(e.target.value))} data-testid="input-platform-font-size"/>
        <small>من ٩٠٪ إلى ١٣٠٪. يؤثر على النصوص والعناوين والأزرار، ولا يغير حجم مستند السيرة.</small>
      </label>
      <div className="adm-appearance-presets" aria-label="لوحات ألوان جاهزة">{APPEARANCE_PRESETS.map(preset => <button key={preset.label} type="button" className="adm-preset" aria-pressed={appearanceDraft.primaryColor === preset.value.primaryColor && appearanceDraft.accentColor === preset.value.accentColor && appearanceDraft.canvasColor === preset.value.canvasColor} onClick={() => choosePreset(preset.value)}><span className="adm-preset-swatches"><i style={{ background: preset.value.primaryColor }}/><i style={{ background: preset.value.accentColor }}/><i style={{ background: preset.value.canvasColor }}/></span>{preset.label}</button>)}</div>
      <div className="adm-color-grid">
        {([
          ['primaryColor', 'اللون الأساسي'],
          ['accentColor', 'لون الإبراز'],
          ['canvasColor', 'خلفية الصفحات'],
          ['surfaceColor', 'خلفية البطاقات'],
          ['textColor', 'لون النصوص'],
          ['headingColor', 'لون العناوين'],
          ['cardTextColor', 'لون النص داخل المربعات'],
          ['cardBorderColor', 'لون حدود المربعات'],
        ] as const).map(([key, label]) => <label className="adm-color-field" key={key}>
          <span>{label}</span><span className="adm-color-value"><NamedColorPicker label={label} value={appearanceDraft[key] ?? DEFAULT_APPEARANCE[key] ?? '#FFFFFF'} onChange={value => updateAppearance(key, value.toUpperCase())} testId={`admin-appearance-${key}`}/><code dir="ltr">{appearanceDraft[key] ?? DEFAULT_APPEARANCE[key] ?? '#FFFFFF'}</code></span>
        </label>)}
      </div>
      <div className="adm-icon-style-settings">
        <label className="adm-color-field adm-icon-color-field">
          <span>لون الأيقونات العامة</span>
          <span className="adm-color-value"><NamedColorPicker label="لون الأيقونات العامة" value={iconColor} onChange={value => updateAppearance('iconColor', value.toUpperCase())} testId="admin-appearance-icon-color"/><code dir="ltr">{iconColor}</code></span>
        </label>
        <div className="adm-icon-shape-field">
          <span className="adm-icon-shape-label">شكل خلفية الأيقونات</span>
          <div className="adm-icon-shape-options" role="group" aria-label="شكل خلفية الأيقونات">
            {ICON_SHAPES.map(shape => <button key={shape.value} type="button" className="adm-icon-shape-option" aria-pressed={iconShape === shape.value} onClick={() => updateAppearance('iconShape', shape.value)} data-testid={`button-platform-icon-shape-${shape.value}`}>
              <span className="adm-icon-shape-swatch" style={{ color: iconColor, background: `color-mix(in srgb, ${iconColor} 13%, ${appearanceDraft.surfaceColor})`, borderRadius: shape.radius }}><Palette size={18}/></span>
              <span>{shape.label}</span>
            </button>)}
          </div>
        </div>
      </div>
      <div className="adm-editor adm-copy-editor">
         <label className="adm-field"><span>عنوان الترحيب <RequiredMark/></span><input required minLength={2} maxLength={80} value={appearanceDraft.welcomeTitle} onChange={e => updateAppearance('welcomeTitle', e.target.value)} /></label>
         <label className="adm-field"><span>النص التعريفي <RequiredMark/></span><textarea required minLength={2} maxLength={220} rows={3} value={appearanceDraft.welcomeDescription} onChange={e => updateAppearance('welcomeDescription', e.target.value)} /></label>
      </div>
      {(appearanceContrast(appearanceDraft.textColor ?? '#334155', appearanceDraft.surfaceColor) < 4.5 || appearanceContrast(appearanceDraft.headingColor ?? '#172033', appearanceDraft.surfaceColor) < 3 || appearanceContrast(appearanceDraft.cardTextColor ?? '#334155', appearanceDraft.surfaceColor) < 4.5 || appearanceContrast(iconColor, appearanceDraft.surfaceColor) < 3) && <p className="adm-form-error" role="status">تباين النص أو الأيقونات مع البطاقة منخفض. اختر لونًا أوضح لسهولة القراءة والرؤية.</p>}
      <div className="adm-appearance-preview" style={{ background: appearanceDraft.canvasColor, '--platform-font-body': PLATFORM_FONTS[appearanceDraft.fontFamily ?? 'IBM Plex Sans Arabic'], '--platform-font-heading': PLATFORM_FONTS[appearanceDraft.fontFamily ?? 'Cairo'], '--platform-font-scale': (appearanceDraft.fontScale ?? 100) / 100 } as CSSProperties} aria-label="معاينة مباشرة للواجهة">
        <div className="adm-appearance-preview-card" style={{ background: appearanceDraft.surfaceColor, borderColor: appearanceDraft.cardBorderColor ?? '#E2E8F0' } as CSSProperties}>
          <span className="adm-preview-label" style={{ color: appearanceDraft.primaryColor }}>معاينة الواجهة</span>
          <b style={{ color: appearanceDraft.cardTextColor ?? '#334155' }}>{appearanceDraft.welcomeTitle}</b><p style={{ color: appearanceDraft.cardTextColor ?? '#334155' }}>{appearanceDraft.welcomeDescription}</p>
          <div className="adm-icon-preview-row"><span style={{ color: iconColor, background: `color-mix(in srgb, ${iconColor} 13%, ${appearanceDraft.surfaceColor})`, borderRadius: iconRadius }}><Palette size={19}/></span><small>معاينة لون وشكل الأيقونة</small></div>
          <button type="button" style={{ background: appearanceDraft.primaryColor, color: getAppearanceTextColor(appearanceDraft.primaryColor) }}>ابدأ الآن</button>
        </div>
      </div>
    </section>
    <div className="adm-save-row">
      {msg && <span role="status" className={msg.ok ? 'adm-ok' : 'adm-form-error'}>{msg.text}</span>}
      {dirty && !msg && <span className="adm-note">تغييرات غير محفوظة</span>}
      {dirty && <button type="button" className="button button-outline" disabled={save.isPending} onClick={() => { setModuleDraft(serverModules); setAppearanceDraft(serverAppearance); setMsg(null); }}><RotateCcw size={15}/> تراجع</button>}
      <button type="button" className="button button-primary" disabled={!dirty || save.isPending} onClick={() => persist(moduleDraft, appearanceDraft)}>{save.isPending ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</button>
    </div>
    <p className="adm-global-note">تغييرات الألوان ورسالة الترحيب وشكل الأيقونات تظهر لكل الطلاب بعد الحفظ، مع بقاء الشعار كما هو.</p>
  </section>;
}

/* ---------- Audit ---------- */
function AuditPanel() {
  const [page, setPage] = useState(1);
  const q = useListAdminAudit({ page }, { query: { queryKey: getListAdminAuditQueryKey({ page }) } });
  if (q.isLoading) return <Skeleton rows={6}/>;
  if (q.isError || !q.data) return <ErrorBox error={q.error} retry={() => q.refetch()}/>;
  const total = Math.max(1, Math.ceil(q.data.total / Math.max(1, q.data.pageSize)));
  return <section aria-labelledby="adm-audit-h"><div className="adm-section-head"><h2 id="adm-audit-h">سجل النشاط الإداري</h2></div>
    {q.data.items.length === 0 ? <Empty title="السجل فارغ" body="ستظهر هنا كل عملية إدارية فور تنفيذها."/> : <>
      <ol className="adm-audit">{q.data.items.map(a => {
        const isMediaCleanup = a.action === 'section-media.cleanup';
        const evidenceActionLabels: Record<string, string> = {
          'achievement_evidence.view': 'مراجعة دليل إنجاز',
          'achievement_evidence.preview': 'معاينة مرفق إنجاز',
          'achievement_evidence.download': 'تنزيل مرفق إنجاز',
        };
        const evidenceAction = evidenceActionLabels[a.action];
        const evidenceDetails = [
          a.evidenceStudentName && `الطالب: ${a.evidenceStudentName}`,
          a.evidenceAchievementTitle && `الإنجاز: ${a.evidenceAchievementTitle}`,
          a.evidenceAttachmentTitle && `المرفق: ${a.evidenceAttachmentTitle}`,
        ].filter(Boolean).join(' · ');
        return <li key={a.id}>
          <time>{fmtDate(a.createdAt)}</time>
          <b>{isMediaCleanup ? 'تنظيف مرفقات الأقسام' : evidenceAction ?? <span dir="ltr">{a.action}</span>}</b>
          <span>{isMediaCleanup ? <>النتيجة: {formatSectionMediaCleanupAuditTarget(a.target)}</> : evidenceAction ? evidenceDetails || 'لم يعد المرفق متاحًا' : <>الهدف: <code dir="ltr">{a.target}</code></>}</span>
          <small>المنفّذ: {a.actorId === 'system:scheduled-section-media-cleanup' ? 'التنظيف الدوري' : <code dir="ltr">{a.actorId}</code>}</small>
        </li>;
      })}</ol>
      <Pager page={page} total={total} count={q.data.total} onPage={setPage} busy={q.isFetching}/></>}
  </section>;
}

/* ---------- Page ---------- */
export default function AdminPage() {
  const access = useGetPlatformAccess({ query: { queryKey: getGetPlatformAccessQueryKey(), retry: false } });
  const notifications = useListAdminNotifications({ query: {
    enabled: access.data?.role === 'admin' && access.data.status === 'active',
    queryKey: access.data?.userId
      ? [...getListAdminNotificationsQueryKey(), access.data.userId]
      : getListAdminNotificationsQueryKey(),
    refetchInterval: 15_000,
    staleTime: 0,
  } });
  const [tab, setTab] = useState<Tab>('overview');
  const [focusSubmissions, setFocusSubmissions] = useState(false);
  const frame = (body: ReactNode) => <div className="adm-frame" dir="rtl">
    <header className="adm-top"><Link href="/dashboard" className="adm-brand" aria-label="العودة إلى مساحة الطالب"><Brand/></Link><span className="adm-crumb"><ShieldCheck size={16}/> لوحة الإشراف</span><ThemeToggle/>
      <Link href="/dashboard" className="adm-back" aria-label="الرجوع للبرنامج" title="الرجوع للبرنامج" data-testid="link-admin-back-to-app"><ArrowRight size={16}/><span>الرجوع للبرنامج</span></Link></header>{body}</div>;
  if (access.isLoading) return frame(<main className="adm-main"><Skeleton rows={4}/></main>);
  const s = statusOf(access.error);
  if (access.isError && s !== 401 && s !== 403) return frame(<main className="adm-main"><ErrorBox error={access.error} retry={() => access.refetch()}/></main>);
  if (!access.data || access.data.role !== 'admin' || access.data.status !== 'active') return frame(<main className="adm-main"><div className="adm-denied" role="alert">
    <ShieldAlert size={28}/><h1>لا تملك صلاحية الوصول</h1><p>هذه الصفحة مخصّصة لمشرفي المنصة فقط.</p><Link href="/dashboard" className="button button-primary">العودة إلى مساحتك</Link></div></main>);
  const selfId = access.data.userId;
  return frame(<div className="adm-body">
    <nav className="adm-tabs" role="tablist" aria-label="أقسام الإشراف">{tabs.map(t => { const I = t.icon; const unread = t.id === 'notifications' ? notifications.data?.unreadCount ?? 0 : 0; return <button key={t.id} type="button" role="tab" id={`adm-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="adm-panel" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}><I size={17}/><span>{t.label}</span>{unread > 0 && <span className="adm-unread-badge" aria-label={`${num(unread)} غير مقروء`}>{num(unread)}</span>}</button>; })}</nav>
    <main className="adm-main" id="adm-panel" role="tabpanel" aria-labelledby={`adm-tab-${tab}`}>
      <div className="adm-title"><span className="page-kicker">الإشراف</span><h1>{tabs.find(t => t.id === tab)?.label}</h1></div>
      {tab === 'overview' && <Overview/>}
      {tab === 'notifications' && <AdminNotificationsPanel
        items={(notifications.data?.items ?? []) as AdminNotification[]}
        unreadCount={notifications.data?.unreadCount ?? 0}
        isLoading={notifications.isLoading}
        isError={notifications.isError}
        onRetry={() => void notifications.refetch()}
        onOpenSubmissions={() => { setFocusSubmissions(true); setTab('academy'); }}
      />}
      {tab === 'users' && <UsersPanel selfId={selfId}/>}
      {tab === 'content' && <ContentPanel/>}
      {tab === 'sections' && <SectionsAdminPanel onOpenModuleSettings={() => setTab('settings')}/>}
      {tab === 'module-submissions' && <ModuleSubmissionsAdminPanel/>}
      {tab === 'evidence-review' && <AchievementEvidenceReviewPanel/>}
      {tab === 'academy' && <AcademyAdminPanel focusSubmissions={focusSubmissions}/>}
      {tab === 'languages' && <LanguageAdminPanel/>}
      {tab === 'graduates' && <GraduatesAdminPanel/>}
      {tab === 'ads' && <AdsAdminPanel/>}
      {tab === 'settings' && <SettingsPanel onOpenAcademy={() => setTab('academy')}/>}
      {tab === 'audit' && <AuditPanel/>}
    </main>
  </div>);
}

/* ---------- Student-facing published content ---------- */
export function PublishedContent({ kind }: { kind: 'announcement' | 'resource' }) {
  const q = useGetPlatformContent({ query: { queryKey: getGetPlatformContentQueryKey() } });
  if (q.isLoading) return <Skeleton rows={2}/>;
  if (q.isError) return <div className="adm-state adm-error" role="alert"><p>تعذّر تحميل {kind === 'announcement' ? 'الإعلانات' : 'المصادر'}.</p><button type="button" className="button button-outline button-compact" onClick={() => q.refetch()}>إعادة المحاولة</button></div>;
  const items = (q.data?.items ?? []).filter(i => i.kind === kind && i.published);
  if (!items.length) return null;
  return <section className="adm-published" aria-label={kind === 'announcement' ? 'إعلانات المنصة' : 'مصادر مختارة'}>
    <div className="adm-published-head">{kind === 'announcement' ? <Megaphone size={16}/> : <BadgeCheck size={16}/>}<h2>{kind === 'announcement' ? 'من فريق أثر' : 'مصادر يرشّحها فريق أثر'}</h2></div>
    <ul>{items.map(i => { const safe = i.url && isHttpUrl(i.url); return <li key={i.id} className={`adm-pub-item ${kind}`}>
      <div><b>{i.title}</b>{i.description && <p>{i.description}</p>}</div>
      {safe && <a href={i.url} target="_blank" rel="noopener noreferrer" className="adm-link">{kind === 'resource' ? 'افتح المصدر' : 'التفاصيل'} <ExternalLink size={13}/><span className="adm-sr">(يفتح في نافذة جديدة)</span></a>}
    </li>; })}</ul>
  </section>;
}
