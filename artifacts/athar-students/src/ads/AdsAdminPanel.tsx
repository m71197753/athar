import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, Download, Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  useListAdminAds, useCreateAdminAd, useUpdateAdminAd, useArchiveAdminAd,
  useListAdCustomers, useCreateAdCustomer, useUpdateAdCustomer, useDeleteAdCustomer,
  useGetAdStatistics, useUpdateAdEnquiry,
  getListAdminAdsQueryKey, getListAdCustomersQueryKey, getGetAdStatisticsQueryKey, getGetPublishedAdsQueryKey,
} from '@workspace/api-client-react';
import type { AdInput, ClassifiedAd, AdCustomer, AdCustomerInput, AdBreakdown, AdEnquiryStatus, GetAdStatisticsDays, AdInputStatus } from '@workspace/api-client-react';
import { AdCreative } from './AdCreative';
import { RequiredMark } from '../components/RequiredMark';
import { AdEditor, blankAd } from './AdEditor';
import { ConfirmDialog, Modal } from './Modal';
import { enquiryNames, errText, fmtDate, formatNames, num, pageNames, pct, slotNames, statusNames } from './shared';
import './ads.css';

type Sub = 'ads' | 'customers' | 'stats';

function useInvalidate() {
  const qc = useQueryClient();
  return (what: { ads?: boolean; customers?: boolean }) => {
    if (what.ads) { qc.invalidateQueries({ queryKey: getListAdminAdsQueryKey() }); qc.invalidateQueries({ queryKey: [getGetPublishedAdsQueryKey()[0]] }); }
    if (what.customers) qc.invalidateQueries({ queryKey: getListAdCustomersQueryKey() });
    qc.invalidateQueries({ queryKey: [getGetAdStatisticsQueryKey()[0]] });
    qc.invalidateQueries({ queryKey: ['/api/admin/audit'] });
  };
}

function Skel({ rows = 3 }: { rows?: number }) { return <div className="ads-skel" role="status" aria-label="جارٍ التحميل">{Array.from({ length: rows }).map((_, i) => <span key={i}/>)}</div>; }
function Failed({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="ads-state ads-state-err" role="alert"><p>{errText(error)}</p><button type="button" className="button button-outline button-compact" onClick={retry}>إعادة المحاولة</button></div>;
}
function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="ads-state"><b>{title}</b><p>{body}</p>{action}</div>;
}

const toInput = (a: ClassifiedAd): AdInput => ({ title: a.title, format: a.format, status: a.status, mediaUrl: a.mediaUrl, code: a.code, destination: a.destination, cta: a.cta, customerId: a.customerId, placements: a.placements.map(p => ({ ...p })), startsAt: a.startsAt, endsAt: a.endsAt });

/* ---------------- Ads ---------------- */
function AdsTab() {
  const ads = useListAdminAds({ query: { queryKey: getListAdminAdsQueryKey(), refetchOnWindowFocus: false } });
  const customers = useListAdCustomers({ query: { queryKey: getListAdCustomersQueryKey() } });
  const create = useCreateAdminAd(); const update = useUpdateAdminAd(); const archive = useArchiveAdminAd();
  const inval = useInvalidate();
  const [editing, setEditing] = useState<{ id?: string; key: number; form: AdInput } | null>(null);
  const [formErr, setFormErr] = useState('');
  const [toArchive, setToArchive] = useState<ClassifiedAd | null>(null);
  const [archErr, setArchErr] = useState('');
  const [filter, setFilter] = useState<'live' | AdInputStatus | 'all'>('live');
  const [rowMsg, setRowMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const custName = (id: string | null) => id ? customers.data?.find(c => c.id === id)?.name ?? 'معلن محذوف' : 'بلا معلن';

  const open = (a?: ClassifiedAd) => { setFormErr(''); setRowMsg(null); setEditing({ id: a?.id, key: Date.now(), form: a ? toInput(a) : blankAd() }); };
  const save = (form: AdInput) => {
    setFormErr('');
    const ok = { onSuccess: () => { inval({ ads: true }); setEditing(null); setRowMsg({ ok: true, text: editing?.id ? 'حُفظت التعديلات.' : 'أُنشئ الإعلان.' }); }, onError: (e: unknown) => setFormErr(errText(e)) };
    if (editing?.id) update.mutate({ id: editing.id, data: form }, ok); else create.mutate({ data: form }, ok);
  };
  const setStatus = (a: ClassifiedAd, status: AdInputStatus) => {
    setRowMsg(null);
    update.mutate({ id: a.id, data: { ...toInput(a), status } }, { onSuccess: () => { inval({ ads: true }); setRowMsg({ ok: true, text: `«${a.title}» أصبح ${statusNames[status]}.` }); }, onError: e => setRowMsg({ ok: false, text: errText(e) }) });
  };

  const list = (ads.data ?? []).filter(a => filter === 'all' ? true : filter === 'live' ? a.status !== 'archived' : a.status === filter);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const a of ads.data ?? []) c[a.status] = (c[a.status] ?? 0) + 1; return c; }, [ads.data]);

  return <section aria-labelledby="ads-h">
    <div className="ads-head"><h2 id="ads-h">الإعلانات</h2>
      {!editing && <button type="button" className="button button-primary button-compact" onClick={() => open()}><Plus size={15}/> إعلان جديد</button>}</div>
    {editing && <AdEditor key={editing.key} initial={editing.form} customers={customers.data ?? []} busy={create.isPending || update.isPending} error={formErr} onSave={save} onCancel={() => setEditing(null)}/>}
    {rowMsg && <p role="status" className={rowMsg.ok ? 'ads-ok' : 'ads-err'}>{rowMsg.text}</p>}
    {!editing && <>
      <div className="ads-filter" role="tablist" aria-label="تصفية حسب الحالة">
        {([['live', 'غير المؤرشفة'], ['active', statusNames.active], ['draft', statusNames.draft], ['paused', statusNames.paused], ['archived', statusNames.archived], ['all', 'الكل']] as const).map(([k, l]) =>
          <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}{k !== 'live' && k !== 'all' && <small>{num(counts[k] ?? 0)}</small>}</button>)}
      </div>
      {ads.isLoading ? <Skel rows={3}/> : ads.isError ? <Failed error={ads.error} retry={() => ads.refetch()}/> : list.length === 0
        ? <Empty title={ads.data?.length ? 'لا إعلانات بهذه الحالة' : 'لا توجد إعلانات بعد'} body="أنشئ إعلاناً واختر الصفحات والمواضع التي يظهر فيها." action={<button type="button" className="button button-primary button-compact" onClick={() => open()}><Plus size={14}/> إعلان جديد</button>}/>
        : <ul className="ads-cards">{list.map(a => <li key={a.id} className={`ads-card st-${a.status}`}>
          <div className="ads-card-thumb" aria-hidden><AdCreative ad={a} preview/></div>
          <div className="ads-card-meta">
            <b>{a.title}</b>
            <span className="ads-chips">
              <em className={`ads-chip ads-chip-${a.status}`}>{statusNames[a.status]}</em>
              <em className="ads-chip">{formatNames[a.format]}</em>
              <em className="ads-chip">{custName(a.customerId)}</em>
            </span>
            <small>{a.placements.slice(0, 3).map(p => `${pageNames[p.page]} · ${slotNames[p.slot]}`).join('، ')}{a.placements.length > 3 ? ` و${num(a.placements.length - 3)} أخرى` : ''}</small>
            <small>{a.startsAt || a.endsAt ? `الجدولة: ${a.startsAt ? fmtDate(a.startsAt) : 'فوراً'} ← ${a.endsAt ? fmtDate(a.endsAt) : 'دون نهاية'}` : 'بلا جدولة'} · آخر تحديث {fmtDate(a.updatedAt)}</small>
          </div>
          <div className="ads-card-actions">
            {a.status === 'active' && <button type="button" className="button button-outline button-compact" disabled={update.isPending} onClick={() => setStatus(a, 'paused')}><Pause size={13}/> إيقاف</button>}
            {(a.status === 'draft' || a.status === 'paused') && <button type="button" className="button button-primary button-compact" disabled={update.isPending} onClick={() => setStatus(a, 'active')}><Play size={13}/> تفعيل</button>}
            {a.status === 'archived' && <button type="button" className="button button-outline button-compact" disabled={update.isPending} onClick={() => setStatus(a, 'draft')}>استعادة كمسودة</button>}
            <button type="button" className="icon-button" aria-label={`تعديل ${a.title}`} onClick={() => { open(a); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={15}/></button>
            {a.status !== 'archived' && <button type="button" className="icon-button danger-icon" aria-label={`أرشفة ${a.title}`} onClick={() => { setArchErr(''); setToArchive(a); }}><Archive size={15}/></button>}
          </div>
        </li>)}</ul>}
    </>}
    {toArchive && <ConfirmDialog title="أرشفة الإعلان" danger busy={archive.isPending} error={archErr} confirmLabel="أرشفة"
      body={<p>سيتوقف عرض «{toArchive.title}» في كل المواضع فوراً. تبقى إحصاءاته وطلبات الاستفسار المرتبطة به محفوظة، ويمكن استعادته لاحقاً كمسودة.</p>}
      onCancel={() => setToArchive(null)}
      onConfirm={() => archive.mutate({ id: toArchive.id }, { onSuccess: () => { inval({ ads: true }); setRowMsg({ ok: true, text: `أُرشف «${toArchive.title}».` }); setToArchive(null); }, onError: e => setArchErr(errText(e)) })}/>}
  </section>;
}

/* ---------------- Customers ---------------- */
const blankCustomer: AdCustomerInput = { name: '', email: '', phone: '', notes: '' };
function CustomersTab() {
  const q = useListAdCustomers({ query: { queryKey: getListAdCustomersQueryKey() } });
  const ads = useListAdminAds({ query: { queryKey: getListAdminAdsQueryKey() } });
  const create = useCreateAdCustomer(); const update = useUpdateAdCustomer(); const del = useDeleteAdCustomer();
  const inval = useInvalidate();
  const [editing, setEditing] = useState<{ id?: string; form: AdCustomerInput } | null>(null);
  const [err, setErr] = useState('');
  const [toDelete, setToDelete] = useState<AdCustomer | null>(null);
  const [delErr, setDelErr] = useState('');
  const [msg, setMsg] = useState('');
  const adCount = (id: string) => (ads.data ?? []).filter(a => a.customerId === id).length;
  const submit = (e: FormEvent) => {
    e.preventDefault(); if (!editing) return;
    const f = { name: editing.form.name.trim(), email: editing.form.email.trim(), phone: editing.form.phone.trim(), notes: editing.form.notes.trim() };
    if (!f.name) return setErr('اسم المعلن مطلوب.');
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return setErr('صيغة البريد غير صحيحة.');
    setErr('');
    const ok = { onSuccess: () => { inval({ customers: true }); setMsg(editing.id ? 'حُفظ المعلن.' : 'أُضيف المعلن.'); setEditing(null); }, onError: (er: unknown) => setErr(errText(er)) };
    if (editing.id) update.mutate({ id: editing.id, data: f }, ok); else create.mutate({ data: f }, ok);
  };
  const setF = (k: keyof AdCustomerInput, v: string) => setEditing(e => e && { ...e, form: { ...e.form, [k]: v } });
  return <section aria-labelledby="cust-h">
    <div className="ads-head"><h2 id="cust-h">المعلنون</h2>
      <button type="button" className="button button-primary button-compact" onClick={() => { setErr(''); setMsg(''); setEditing({ form: { ...blankCustomer } }); }}><Plus size={15}/> معلن جديد</button></div>
    <p className="ads-hint">بيانات المعلن خاصة بفريق الإشراف ولا تظهر أبداً في الإعلانات العامة.</p>
    {msg && <p className="ads-ok" role="status">{msg}</p>}
    {editing && <Modal title={editing.id ? 'تعديل المعلن' : 'معلن جديد'} onClose={() => setEditing(null)} busy={create.isPending || update.isPending}>
      <form className="ads-form" onSubmit={submit} noValidate>
        <label className="ads-field"><span>الاسم / الجهة <RequiredMark/></span><input maxLength={160} value={editing.form.name} onChange={e => setF('name', e.target.value)} required/></label>
        <div className="ads-two">
          <label className="ads-field"><span>البريد</span><input type="email" dir="ltr" maxLength={254} value={editing.form.email} onChange={e => setF('email', e.target.value)}/></label>
          <label className="ads-field"><span>الهاتف</span><input type="tel" dir="ltr" maxLength={60} value={editing.form.phone} onChange={e => setF('phone', e.target.value)}/></label>
        </div>
        <label className="ads-field"><span>ملاحظات داخلية</span><textarea rows={3} maxLength={2000} value={editing.form.notes} onChange={e => setF('notes', e.target.value)}/></label>
        {err && <p className="ads-err" role="alert">{err}</p>}
        <div className="ads-actions">
          <button type="button" className="button button-outline button-compact" onClick={() => setEditing(null)}>إلغاء</button>
          <button type="submit" className="button button-primary button-compact" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'جارٍ الحفظ…' : 'حفظ'}</button>
        </div>
      </form>
    </Modal>}
    {q.isLoading ? <Skel rows={3}/> : q.isError ? <Failed error={q.error} retry={() => q.refetch()}/> : !q.data?.length
      ? <Empty title="لا يوجد معلنون" body="أضف المعلن ثم اربطه بإعلاناته لتظهر إحصاءاته مجمّعة."/>
      : <div className="ads-table-wrap"><table className="ads-table">
        <thead><tr><th>المعلن</th><th>التواصل</th><th>الإعلانات</th><th>أُضيف</th><th><span className="ads-sr">إجراءات</span></th></tr></thead>
        <tbody>{q.data.map(c => <tr key={c.id}>
          <td data-label="المعلن"><b>{c.name}</b>{c.notes && <small className="ads-clip">{c.notes}</small>}</td>
          <td data-label="التواصل"><span dir="ltr">{c.email || '—'}</span><small dir="ltr">{c.phone}</small></td>
          <td data-label="الإعلانات">{ads.isLoading ? '…' : num(adCount(c.id))}</td>
          <td data-label="أُضيف">{new Date(c.createdAt).toLocaleDateString('ar')}</td>
          <td className="ads-td-actions">
            <button type="button" className="icon-button" aria-label={`تعديل ${c.name}`} onClick={() => { setErr(''); setMsg(''); setEditing({ id: c.id, form: { name: c.name, email: c.email, phone: c.phone, notes: c.notes } }); }}><Pencil size={15}/></button>
            <button type="button" className="icon-button danger-icon" aria-label={`حذف ${c.name}`} onClick={() => { setDelErr(''); setToDelete(c); }}><Trash2 size={15}/></button>
          </td></tr>)}</tbody></table></div>}
    {toDelete && <ConfirmDialog title="حذف المعلن" danger busy={del.isPending} error={delErr} confirmLabel="حذف"
      body={<p>سيُحذف «{toDelete.name}» وبيانات التواصل الخاصة به. {adCount(toDelete.id) ? `إعلاناته (${num(adCount(toDelete.id))}) لن تُحذف، بل تبقى كما هي وتُفصل عن هذا المعلن مع الاحتفاظ بإحصاءاتها.` : 'لا ترتبط به إعلانات حالياً.'}</p>}
      onCancel={() => setToDelete(null)}
      onConfirm={() => del.mutate({ id: toDelete.id }, { onSuccess: () => { inval({ customers: true, ads: true }); setMsg(`حُذف «${toDelete.name}».`); setToDelete(null); }, onError: e => setDelErr(errText(e)) })}/>}
  </section>;
}

/* ---------------- Statistics & enquiries ---------------- */
const csvCell = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
function download(name: string, rows: (string | number)[][]) {
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BreakdownTable({ caption, rows, nameLabel }: { caption: string; rows: AdBreakdown[]; nameLabel: string }) {
  return <div className="ads-table-wrap"><table className="ads-table ads-num">
    <caption>{caption}</caption>
    <thead><tr><th>{nameLabel}</th><th>مرات الظهور</th><th>زوار مجهولون</th><th>نقرات الزر</th><th>نسبة النقر</th><th>استفسارات</th></tr></thead>
    <tbody>{rows.length === 0 ? <tr><td colSpan={6} className="ads-td-empty">لا بيانات في هذه الفترة.</td></tr> : rows.map(r => <tr key={r.id}>
      <td data-label={nameLabel}><b>{r.title}</b></td><td data-label="الظهور">{num(r.impressions)}</td><td data-label="الزوار">{num(r.visitors)}</td>
      <td data-label="النقرات">{num(r.clicks)}</td><td data-label="نسبة النقر">{pct(r.ctr)}</td><td data-label="الاستفسارات">{num(r.enquiries)}</td></tr>)}</tbody>
  </table></div>;
}

function StatsTab() {
  const [days, setDays] = useState<GetAdStatisticsDays>(30);
  const params = { days };
  const q = useGetAdStatistics(params, { query: { queryKey: getGetAdStatisticsQueryKey(params), refetchInterval: 10_000, refetchIntervalInBackground: false } });
  const upd = useUpdateAdEnquiry();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [leadErr, setLeadErr] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ago = q.dataUpdatedAt ? Math.max(0, Math.round((now - q.dataUpdatedAt) / 1000)) : null;
  const d = q.data;
  const setLead = (id: string, status: AdEnquiryStatus) => {
    setLeadErr(null);
    upd.mutate({ id, data: { status } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: [getGetAdStatisticsQueryKey()[0]] }),
      onError: e => setLeadErr({ id, text: errText(e) }),
    });
  };
  const exportCsv = () => {
    if (!d) return;
    const rows: (string | number)[][] = [['القسم', 'الاسم/التاريخ', 'الظهور', 'الزوار المجهولون', 'النقرات', 'نسبة النقر', 'الاستفسارات']];
    rows.push(['الإجمالي', `آخر ${d.days} يوماً`, d.totals.impressions, d.totals.visitors, d.totals.clicks, d.totals.ctr, d.totals.enquiries]);
    for (const r of d.byAd) rows.push(['إعلان', r.title, r.impressions, r.visitors, r.clicks, r.ctr, r.enquiries]);
    for (const r of d.byCustomer) rows.push(['معلن', r.title, r.impressions, r.visitors, r.clicks, r.ctr, r.enquiries]);
    for (const r of d.daily) rows.push(['يومي', r.date, r.impressions, r.visitors, r.clicks, r.ctr, r.enquiries]);
    rows.push([]); rows.push(['طلب', 'الإعلان', 'الاسم', 'التواصل', 'الرسالة', 'الحالة', 'التاريخ']);
    for (const l of d.leads) rows.push(['طلب', l.adTitle, l.name, l.contact, l.message, enquiryNames[l.status], l.createdAt]);
    download(`athar-ads-${d.days}d-${new Date(d.updatedAt).toISOString().slice(0, 10)}.csv`, rows);
  };
  return <section aria-labelledby="stats-h">
    <div className="ads-head"><h2 id="stats-h">الإحصاءات المباشرة</h2>
      <div className="ads-head-tools">
        <div className="ads-filter" role="radiogroup" aria-label="الفترة">{([7, 30, 90] as GetAdStatisticsDays[]).map(n => <button key={n} type="button" role="radio" aria-checked={days === n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>{num(n)} يوماً</button>)}</div>
        <button type="button" className="button button-outline button-compact" disabled={!d} onClick={exportCsv}><Download size={14}/> CSV</button>
      </div></div>
    <p className="ads-live" aria-live="polite"><span className={`ads-pulse ${q.isFetching ? 'is-on' : ''}`} aria-hidden/>
      {q.isError && d ? 'تعذّر التحديث الأخير — تُعرض آخر بيانات ناجحة. ' : ''}
      {d ? <>تحديث تلقائي كل ١٠ ثوانٍ · آخر جلب منذ {num(ago ?? 0)} ث · بيانات الخادم حتى {fmtDate(d.updatedAt)}</> : 'جارٍ الجلب…'}
      <button type="button" className="ads-linkbtn" onClick={() => q.refetch()} disabled={q.isFetching}><RefreshCw size={12}/> تحديث الآن</button></p>
    {q.isLoading ? <Skel rows={4}/> : !d ? <Failed error={q.error} retry={() => q.refetch()}/> : <>
      <div className="ads-ledger">
        {([['مرات الظهور المقيسة', d.totals.impressions, 'ظهور ٥٠٪ لثانية متصلة'], ['زوار مجهولون', d.totals.visitors, 'معرّفات متصفح، ليست أشخاصاً'], ['نقرات رابط الوجهة', d.totals.clicks, 'الصورة أو زر الإجراء'], ['نسبة النقر', pct(d.totals.ctr), 'النقرات ÷ الظهور'], ['استفسارات', d.totals.enquiries, 'طلبات بموافقة صريحة']] as const).map(([l, v, s], i) =>
          <div key={l} className={`ads-tally ${i === 0 ? 'lead' : ''}`}><span>{l}</span><strong>{typeof v === 'number' ? num(v) : v}</strong><small>{s}</small></div>)}
      </div>
      <details className="ads-limits"><summary>حدود القياس</summary><ul>
        <li>يُحتسب الظهور حين يكون ٥٠٪ من الإعلان مرئياً لثانية متصلة والصفحة ظاهرة، مرة واحدة لكل إعلان في كل عرض صفحة، ويُزال تكراره على الخادم لكل زائر ونوع حدث كل ١٥ دقيقة.</li>
        <li>«الزوار» معرّفات متصفح مجهولة؛ الشخص نفسه على جهازين يُحتسب مرتين، ومسح بيانات المتصفح ينشئ معرّفاً جديداً.</li>
        <li>تُقاس نقرات رابط الوجهة عبر الصورة أو زر الإجراء؛ الروابط داخل إعلانات الكود لا تُتتبّع. معاينات الإدارة لا تُسجّل أي حدث.</li>
        <li>حاجبات الإعلانات وتعطيل JavaScript قد تُخفّض الأرقام.</li>
      </ul></details>
      <BreakdownTable caption="حسب الإعلان" rows={d.byAd} nameLabel="الإعلان"/>
      <BreakdownTable caption="حسب المعلن" rows={d.byCustomer} nameLabel="المعلن"/>
      <div className="ads-table-wrap"><table className="ads-table ads-num"><caption>يومياً</caption>
        <thead><tr><th>التاريخ</th><th>الظهور</th><th>الزوار</th><th>النقرات</th><th>نسبة النقر</th><th>الاستفسارات</th></tr></thead>
        <tbody>{d.daily.length === 0 ? <tr><td colSpan={6} className="ads-td-empty">لا بيانات في هذه الفترة.</td></tr> : [...d.daily].reverse().map(r => <tr key={r.date}>
          <td data-label="التاريخ">{new Date(r.date).toLocaleDateString('ar', { month: 'short', day: 'numeric', weekday: 'short' })}</td><td data-label="الظهور">{num(r.impressions)}</td>
          <td data-label="الزوار">{num(r.visitors)}</td><td data-label="النقرات">{num(r.clicks)}</td><td data-label="نسبة النقر">{pct(r.ctr)}</td><td data-label="الاستفسارات">{num(r.enquiries)}</td></tr>)}</tbody>
      </table></div>
      <div className="ads-head ads-head-sub"><h2>طلبات الاستفسار</h2><small className="ads-hint">أحدث ١٠٠ طلب في الفترة المختارة</small></div>
      {d.leads.length === 0 ? <Empty title="لا طلبات بعد" body="ستظهر هنا الطلبات التي يرسلها الزوار من زر «استفسار» في الإعلانات."/>
        : <ul className="ads-leads">{d.leads.map(l => <li key={l.id} className={`lead-${l.status}`}>
          <div className="ads-lead-main"><b>{l.name}</b><span dir="ltr" className="ads-lead-contact">{l.contact}</span>
            {l.message && <p>{l.message}</p>}
            <small>عن «{l.adTitle}» · {fmtDate(l.createdAt)}</small>
            {leadErr?.id === l.id && <small className="ads-err" role="alert">{leadErr.text}</small>}</div>
          <label className="ads-lead-status"><span className="ads-sr">حالة طلب {l.name}</span>
            <select value={l.status} disabled={upd.isPending && upd.variables?.id === l.id} onChange={e => setLead(l.id, e.target.value as AdEnquiryStatus)}>
              {(Object.keys(enquiryNames) as AdEnquiryStatus[]).map(s => <option key={s} value={s}>{enquiryNames[s]}</option>)}</select></label>
        </li>)}</ul>}
    </>}
  </section>;
}

export default function AdsAdminPanel() {
  const [sub, setSub] = useState<Sub>('ads');
  const subs: [Sub, string][] = [['ads', 'الإعلانات'], ['customers', 'المعلنون'], ['stats', 'الإحصاءات والطلبات']];
  return <div className="ads-admin" dir="rtl">
    <nav className="ads-subtabs" aria-label="أقسام الإعلانات">{subs.map(([k, l]) => <button key={k} type="button" aria-current={sub === k ? 'page' : undefined} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}</nav>
    {sub === 'ads' && <AdsTab/>}
    {sub === 'customers' && <CustomersTab/>}
    {sub === 'stats' && <StatsTab/>}
  </div>;
}
