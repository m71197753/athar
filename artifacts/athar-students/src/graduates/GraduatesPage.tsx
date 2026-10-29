import { useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, BriefcaseBusiness, Check, ExternalLink, FileText, HeartHandshake, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { useListGraduateItems, useSubmitGraduateCommunityPost } from "@workspace/api-client-react";
import type { GraduateCommunityPostInput, GraduateItem } from "@workspace/api-client-react";
import { RequiredMark } from "../components/RequiredMark";
import "./graduates.css";

type GraduateTab = "all" | "opportunity" | "guidance" | "community" | "portfolio";

const tabs: { id: GraduateTab; label: string }[] = [
  { id: "all", label: "نظرة عامة" },
  { id: "opportunity", label: "فرص العمل والتدريب" },
  { id: "guidance", label: "الإرشاد والتوجيه" },
  { id: "community", label: "مجتمع الخريجين" },
  { id: "portfolio", label: "ملفي وإنجازاتي" },
];

const kindLabels: Record<GraduateItem["kind"], string> = {
  opportunity: "فرصة",
  guidance: "إرشاد",
  community: "من المجتمع",
};

function GraduateCard({ item }: { item: GraduateItem }) {
  const Icon = item.kind === "opportunity" ? BriefcaseBusiness : item.kind === "guidance" ? HeartHandshake : MessageCircle;
  return (
    <article className="gr-card">
      <div className="gr-card-top"><span className={`gr-kind gr-kind-${item.kind}`}><Icon size={14}/>{kindLabels[item.kind]}</span><span className="gr-date">{new Date(item.createdAt).toLocaleDateString("ar", { month: "short", day: "numeric" })}</span></div>
      <h3>{item.title}</h3>
      {item.summary && <p className="gr-summary">{item.summary}</p>}
      <p className="gr-body">{item.body}</p>
      {item.actionUrl && <a className="gr-link" href={item.actionUrl} target="_blank" rel="noopener noreferrer">{item.actionLabel || "فتح المحتوى"}<ExternalLink size={14}/></a>}
    </article>
  );
}

export function GraduatesPage() {
  const feed = useListGraduateItems();
  const submit = useSubmitGraduateCommunityPost();
  const [tab, setTab] = useState<GraduateTab>("all");
  const [form, setForm] = useState<GraduateCommunityPostInput>({
    title: "",
    summary: "",
    body: "",
    actionLabel: null,
    actionUrl: null,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const filteredItems = useMemo(
    () => (feed.data?.items ?? []).filter(item => tab === "all" || tab === "portfolio" || item.kind === tab),
    [feed.data?.items, tab],
  );

  const sendPost = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const data = {
      ...form,
      title: form.title.trim(),
      summary: form.summary.trim(),
      body: form.body.trim(),
      actionLabel: form.actionUrl ? form.actionLabel?.trim() || "فتح المحتوى" : null,
      actionUrl: form.actionUrl?.trim() || null,
    };
    submit.mutate({ data }, {
      onSuccess: () => {
        setForm({ title: "", summary: "", body: "", actionLabel: null, actionUrl: null });
        setMessage("وصلت مشاركتك إلى فريق أثر للمراجعة. ستظهر في المجتمع بعد اعتمادها.");
      },
      onError: () => setError("تعذّر إرسال المشاركة. راجع البيانات وحاول مرة أخرى."),
    });
  };

  return (
    <main className="graduates" dir="rtl">
      <header className="gr-hero">
        <div className="gr-hero-mark"><BriefcaseBusiness size={27}/></div>
        <div>
          <span className="gr-eyebrow">الخطوة التالية بعد الدراسة</span>
          <h1>مساحة الخريجين</h1>
          <p>تابع فرص العمل والتدريب، واستفد من التوجيه، وشارك خبرتك، واجمع إنجازاتك في ملفك المهني.</p>
        </div>
      </header>

      <nav className="gr-tabs" aria-label="أقسام الخريجين">
        {tabs.map(item => <button key={item.id} type="button" className={tab === item.id ? "is-active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </nav>

      {tab === "portfolio" ? (
        <section className="gr-portfolio">
          <div className="gr-portfolio-icon"><FileText size={23}/></div>
          <div><span className="gr-eyebrow">ملفك المهني</span><h2>إنجازاتك الموثقة في مكان واحد</h2><p>راجع تجاربك، حدّث مهاراتك، ثم جهّز سيرتك المهنية لمشاركتها بالطريقة التي تختارها.</p></div>
          <div className="gr-portfolio-actions">
            <Link href="/achievements" className="gr-primary">عرض إنجازاتي <ArrowLeft size={15}/></Link>
            <Link href="/resume" className="gr-secondary">فتح السيرة المهنية <FileText size={15}/></Link>
          </div>
        </section>
      ) : (
        <>
          {tab === "all" && <section className="gr-shortcuts">
            <button type="button" onClick={() => setTab("opportunity")}><BriefcaseBusiness size={17}/><span><b>فرص العمل والتدريب</b><small>تابع الفرص المنشورة للخريجين</small></span><ArrowLeft size={15}/></button>
            <button type="button" onClick={() => setTab("guidance")}><HeartHandshake size={17}/><span><b>الإرشاد والتوجيه</b><small>محتوى يساعدك على التخطيط لخطوتك التالية</small></span><ArrowLeft size={15}/></button>
            <button type="button" onClick={() => setTab("portfolio")}><FileText size={17}/><span><b>ملفي وإنجازاتي</b><small>ارجع إلى أدلتك المهنية وسيرتك</small></span><ArrowLeft size={15}/></button>
          </section>}

          {tab === "community" && <section className="gr-submit-panel">
            <div className="gr-submit-heading"><div><span className="gr-eyebrow">شارك خبرتك</span><h2>أضف مشاركة للمجتمع</h2><p>تُراجع المشاركات قبل ظهورها للآخرين.</p></div><MessageCircle size={20}/></div>
            <form className="gr-form" onSubmit={sendPost}>
              <label><span>عنوان المشاركة <RequiredMark/></span><input required minLength={3} maxLength={160} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label>
              <label>ملخص قصير<input maxLength={500} value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })}/></label>
              <label><span>التفاصيل <RequiredMark/></span><textarea required minLength={10} maxLength={5000} rows={5} value={form.body} onChange={event => setForm({ ...form, body: event.target.value })}/></label>
              <div className="gr-form-row">
                <label>رابط اختياري<input type="url" maxLength={2000} dir="ltr" value={form.actionUrl ?? ""} onChange={event => setForm({ ...form, actionUrl: event.target.value || null, actionLabel: event.target.value ? form.actionLabel : null })} placeholder="https://"/></label>
                {form.actionUrl && <label>نص الزر<input maxLength={60} value={form.actionLabel ?? ""} onChange={event => setForm({ ...form, actionLabel: event.target.value || null })}/></label>}
              </div>
              {error && <p className="gr-error" role="alert">{error}</p>}
              {message && <p className="gr-success" role="status"><Check size={15}/>{message}</p>}
              <button className="gr-primary" type="submit" disabled={submit.isPending}>{submit.isPending ? <><LoaderCircle className="gr-spin" size={15}/> جارٍ الإرسال</> : <>إرسال للمراجعة <Send size={15}/></>}</button>
            </form>
          </section>}

          {feed.isLoading ? <div className="gr-state" role="status">جارٍ تحميل محتوى الخريجين…</div>
            : feed.isError ? <div className="gr-state" role="alert"><b>تعذّر تحميل المحتوى</b><p>تحقق من اتصالك ثم أعد المحاولة.</p><button type="button" className="gr-secondary" onClick={() => feed.refetch()}>إعادة المحاولة</button></div>
              : filteredItems.length ? <section className="gr-feed" aria-live="polite">{filteredItems.map(item => <GraduateCard key={item.id} item={item}/>)}</section>
                : <div className="gr-empty"><span className="gr-empty-mark"><BriefcaseBusiness size={23}/></span><h2>لا يوجد محتوى منشور هنا بعد</h2><p>{tab === "community" ? "كن أول من يشارك تجربة مفيدة للخريجين." : "سيظهر المحتوى هنا بعد إضافته ومراجعته من فريق أثر."}</p>{tab === "community" && <button type="button" className="gr-primary" onClick={() => document.querySelector(".gr-submit-panel")?.scrollIntoView({ behavior: "smooth" })}>اكتب مشاركة <ArrowLeft size={15}/></button>}</div>}
        </>
      )}
    </main>
  );
}
