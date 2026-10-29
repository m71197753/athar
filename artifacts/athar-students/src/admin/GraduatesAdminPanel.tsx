import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, FileText, LoaderCircle, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  getListAdminGraduateItemsQueryKey,
  useCreateAdminGraduateItem,
  useDeleteAdminGraduateItem,
  useListAdminGraduateItems,
  useReviewAdminGraduateItem,
} from "@workspace/api-client-react";
import type { AdminGraduateItem } from "@workspace/api-client-react";
import { RequiredMark } from "../components/RequiredMark";

type Draft = { kind: "opportunity" | "guidance"; title: string; summary: string; body: string; actionLabel: string; actionUrl: string };
const emptyDraft: Draft = { kind: "opportunity", title: "", summary: "", body: "", actionLabel: "", actionUrl: "" };

const kindText = { opportunity: "فرصة عمل أو تدريب", guidance: "إرشاد وتوجيه", community: "مشاركة مجتمع" } as const;
const statusText = { pending: "بانتظار المراجعة", published: "منشور", rejected: "مرفوض" } as const;

export function GraduatesAdminPanel() {
  const qc = useQueryClient();
  const items = useListAdminGraduateItems();
  const create = useCreateAdminGraduateItem();
  const review = useReviewAdminGraduateItem();
  const remove = useDeleteAdminGraduateItem();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: getListAdminGraduateItemsQueryKey() });

  const startEdit = (item: AdminGraduateItem) => {
    if (item.kind === "community") return;
    setEditingId(item.id);
    setDraft({
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      body: item.body,
      actionLabel: item.actionLabel ?? "",
      actionUrl: item.actionUrl ?? "",
    });
    setError("");
    setNotice("");
    document.querySelector(".gr-admin-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const cancelEdit = () => { setEditingId(null); setDraft(emptyDraft); setError(""); };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const data = {
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      body: draft.body.trim(),
      actionLabel: draft.actionUrl.trim() ? draft.actionLabel.trim() || "فتح المحتوى" : null,
      actionUrl: draft.actionUrl.trim() || null,
    };
    if (editingId) {
      review.mutate({ itemId: editingId, data }, {
        onSuccess: () => { setNotice("تم حفظ التعديلات."); cancelEdit(); void invalidate(); },
        onError: () => setError("تعذّر حفظ التعديلات. راجع الحقول وحاول مجددًا."),
      });
    } else {
      create.mutate({ data: { ...data, kind: draft.kind } }, {
        onSuccess: () => { setNotice("تم نشر المحتوى في مساحة الخريجين."); setDraft(emptyDraft); void invalidate(); },
        onError: () => setError("تعذّر نشر المحتوى. راجع الحقول وحاول مجددًا."),
      });
    }
  };

  const setStatus = (itemId: string, status: "published" | "rejected") => {
    setError("");
    review.mutate({ itemId, data: { status, reviewNote: notes[itemId]?.trim() || undefined } }, {
      onSuccess: () => { setNotice(status === "published" ? "تم اعتماد المشاركة." : "تم رفض المشاركة."); void invalidate(); },
      onError: () => setError("تعذّر تحديث حالة المشاركة."),
    });
  };

  const deleteItem = (item: AdminGraduateItem) => {
    if (!window.confirm(`هل تريد حذف «${item.title}» نهائيًا؟`)) return;
    remove.mutate({ itemId: item.id }, {
      onSuccess: () => { if (editingId === item.id) cancelEdit(); setNotice("تم حذف المحتوى."); void invalidate(); },
      onError: () => setError("تعذّر حذف المحتوى."),
    });
  };

  return <section className="gr-admin" dir="rtl">
    <div className="gr-admin-intro"><span className="page-kicker">مساحة الخريجين</span><h2>إدارة الفرص والإرشاد والمجتمع</h2><p>انشر الفرص والمواد الإرشادية، وراجع مشاركات الخريجين قبل ظهورها.</p></div>
    <form className="gr-admin-form" onSubmit={save}>
      <h3>{editingId ? "تعديل المحتوى" : "إضافة محتوى جديد"}</h3>
      {!editingId && <label>نوع المحتوى<select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as Draft["kind"] })}><option value="opportunity">فرصة عمل أو تدريب</option><option value="guidance">إرشاد وتوجيه</option></select></label>}
      <label><span>العنوان <RequiredMark/></span><input required minLength={3} maxLength={160} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })}/></label>
      <label>ملخص<input maxLength={500} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })}/></label>
      <label><span>التفاصيل <RequiredMark/></span><textarea required minLength={10} maxLength={5000} rows={5} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })}/></label>
      <div className="gr-admin-form-row"><label>رابط اختياري<input type="url" dir="ltr" maxLength={2000} value={draft.actionUrl} onChange={event => setDraft({ ...draft, actionUrl: event.target.value })} placeholder="https://"/></label><label>عنوان الزر<input maxLength={60} value={draft.actionLabel} onChange={event => setDraft({ ...draft, actionLabel: event.target.value })}/></label></div>
      {error && <p className="gr-admin-error" role="alert">{error}</p>}
      {notice && <p className="gr-admin-notice" role="status"><Check size={14}/>{notice}</p>}
      <div className="gr-admin-actions">
        <button className="button button-primary" type="submit" disabled={create.isPending || review.isPending}>{editingId ? <><Save size={14}/> حفظ التعديلات</> : <><Plus size={14}/> نشر المحتوى</>}</button>
        {editingId && <button className="button button-outline" type="button" onClick={cancelEdit}><X size={14}/> إلغاء التعديل</button>}
      </div>
    </form>
    <section className="gr-admin-queue"><h3>كل عناصر مساحة الخريجين</h3>
      {items.isLoading ? <div className="adm-skeleton" role="status"><span/><span/><span/></div>
        : items.isError || !items.data ? <div className="adm-state" role="alert"><p>تعذّر تحميل العناصر.</p><button className="button button-outline" type="button" onClick={() => items.refetch()}>إعادة المحاولة</button></div>
          : items.data.items.length ? <div className="gr-admin-list">{items.data.items.map(item => <article className="gr-admin-item" key={item.id}>
            <div className="gr-admin-item-head"><span className={`gr-kind gr-kind-${item.kind}`}><FileText size={13}/>{kindText[item.kind]}</span><span className={`gr-admin-status status-${item.status}`}>{statusText[item.status]}</span></div>
            <h4>{item.title}</h4><p>{item.summary || item.body}</p>
            {item.actionUrl && <a className="gr-admin-link" href={item.actionUrl} target="_blank" rel="noopener noreferrer">فتح الرابط <ExternalLink size={13}/></a>}
            {item.reviewNote && <small className="gr-admin-note">ملاحظة: {item.reviewNote}</small>}
            {item.status === "pending" && <label className="gr-admin-note-input">ملاحظة المراجعة<input maxLength={1000} value={notes[item.id] ?? ""} onChange={event => setNotes({ ...notes, [item.id]: event.target.value })}/></label>}
            <div className="gr-admin-actions">
              {item.kind === "community" && item.status === "pending" && <><button className="button button-primary" type="button" disabled={review.isPending} onClick={() => setStatus(item.id, "published")}><Check size={14}/> اعتماد</button><button className="button button-outline" type="button" disabled={review.isPending} onClick={() => setStatus(item.id, "rejected")}><X size={14}/> رفض</button></>}
              {item.kind !== "community" && item.status !== "rejected" && <button className="button button-outline" type="button" onClick={() => startEdit(item)}><Pencil size={14}/> تعديل</button>}
              <button className="button button-outline gr-admin-delete" type="button" disabled={remove.isPending} onClick={() => deleteItem(item)}><Trash2 size={14}/> حذف</button>
              {(create.isPending || review.isPending || remove.isPending) && <LoaderCircle className="gr-admin-spin" size={15} aria-label="جارٍ الحفظ"/>}
            </div>
          </article>)}</div> : <div className="adm-state"><b>لا يوجد محتوى بعد</b><p>أضف أول فرصة أو مادة إرشادية من النموذج.</p></div>}
    </section>
  </section>;
}
