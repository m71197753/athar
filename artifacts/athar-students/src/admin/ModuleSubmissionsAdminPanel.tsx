import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileText, LoaderCircle, ShieldCheck, X } from "lucide-react";
import {
  downloadAdminModuleSubmission,
  getListAdminModuleSubmissionsQueryKey,
  useListAdminModuleSubmissions,
  useReviewAdminModuleSubmission,
} from "@workspace/api-client-react";
import type { AdminModuleSubmission, ModuleKey, ModuleSubmissionStatus } from "@workspace/api-client-react";
import "./module-submissions-admin.css";

const moduleLabels: Record<ModuleKey, string> = {
  achievements: "إنجازاتي",
  learning: "التعلّم",
  academy: "المذاكرة",
  languages: "اللغات",
  graduates: "الخريجون",
  roadmap: "الخطة المهنية",
  resume: "السيرة الذاتية",
  assistant: "المساعد المهني",
};
const statusLabels: Record<ModuleSubmissionStatus, string> = {
  uploading: "جارٍ الرفع",
  pending: "بانتظار المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

function fileSize(size: number): string {
  if (size < 1024) return `${size.toLocaleString("ar")} بايت`;
  const units = ["ك.ب", "م.ب", "ج.ب", "ت.ب"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toLocaleString("ar-EG", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

export function ModuleSubmissionsAdminPanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [page, setPage] = useState(1);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const params = { status, page };
  const query = useListAdminModuleSubmissions(params, {
    query: { queryKey: getListAdminModuleSubmissionsQueryKey(params), staleTime: 0 },
  });
  const review = useReviewAdminModuleSubmission();

  const reviewSubmission = (item: AdminModuleSubmission, nextStatus: "approved" | "rejected") => {
    review.mutate({
      submissionId: item.id,
      data: {
        status: nextStatus,
        reviewNote: nextStatus === "rejected" ? reviewNotes[item.id]?.trim() || null : null,
      },
    }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListAdminModuleSubmissionsQueryKey() });
        setReviewNotes(current => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      },
    });
  };
  const download = async (item: AdminModuleSubmission) => {
    setDownloadingId(item.id);
    try {
      const blob = await downloadAdminModuleSubmission(item.id);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = item.originalName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.alert("تعذّر فتح الملف. حاول مرة أخرى.");
    } finally {
      setDownloadingId(null);
    }
  };

  return <section className="adm-module-submissions" aria-labelledby="adm-module-submissions-title" dir="rtl" data-testid="admin-module-submissions">
    <header className="adm-module-submissions-head">
      <span className="adm-module-submissions-mark"><ShieldCheck size={21}/></span>
      <div><span className="page-kicker">مساهمات الطلاب</span><h2 id="adm-module-submissions-title">مراجعة الملفات المرفوعة</h2>
        <p>لا تظهر الملفات للطلاب الآخرين. راجعها هنا ثم اعتمدها أو ارفضها.</p></div>
    </header>
    <div className="adm-module-submissions-filters" role="group" aria-label="تصفية ملفات الطلاب">
      {([
        ["pending", "بانتظار المراجعة"],
        ["approved", "مقبولة"],
        ["rejected", "مرفوضة"],
      ] as const).map(([value, label]) => <button key={value} type="button" className={status === value ? "is-active" : ""}
        aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }} data-testid={`button-submission-filter-${value}`}>{label}</button>)}
    </div>
    {query.isLoading ? <div className="adm-module-submissions-state" role="status">جارٍ تحميل الملفات…</div>
      : query.isError || !query.data ? <div className="adm-module-submissions-state is-error" role="alert">
        <span>تعذّر تحميل ملفات الطلاب.</span><button type="button" onClick={() => void query.refetch()}>إعادة المحاولة</button>
      </div>
        : query.data.items.length === 0 ? <div className="adm-module-submissions-state">
          لا توجد ملفات {statusLabels[status].toLowerCase()} حاليًا.
        </div>
          : <div className="adm-module-submissions-list">
            {query.data.items.map(item => <article className="adm-module-submission-card" key={item.id} data-testid={`admin-module-submission-${item.id}`}>
              <div className="adm-module-submission-icon"><FileText size={18}/></div>
              <div className="adm-module-submission-main">
                <div className="adm-module-submission-title"><h3>{item.title}</h3><span>{statusLabels[item.status]}</span></div>
                <p>{moduleLabels[item.moduleKey]} · {item.originalName}</p>
                <small>{fileSize(item.size)} · {new Date(item.createdAt).toLocaleString("ar-EG")}</small>
                <small className="adm-module-submission-owner">معرّف الطالب: <b dir="ltr">{item.ownerId}</b></small>
                {item.note && <p className="adm-module-submission-note">ملاحظة الطالب: {item.note}</p>}
                {item.reviewNote && <p className="adm-module-submission-note">ملاحظة الإدارة: {item.reviewNote}</p>}
                {status === "pending" && <label className="adm-module-submission-review-note"><span>ملاحظة للطالب عند الرفض (اختياري)</span>
                  <textarea value={reviewNotes[item.id] ?? ""} maxLength={1000} rows={2}
                    onChange={event => setReviewNotes(current => ({ ...current, [item.id]: event.target.value }))}/>
                </label>}
              </div>
              <div className="adm-module-submission-actions">
                {item.downloadUrl && <button type="button" disabled={downloadingId === item.id} onClick={() => void download(item)} aria-label={`تنزيل ملف ${item.originalName}`}><Download size={16}/> تنزيل الملف</button>}
                {status === "pending" && <>
                  <button type="button" className="is-approve" disabled={review.isPending} onClick={() => reviewSubmission(item, "approved")} data-testid={`button-approve-submission-${item.id}`}>
                    {review.isPending && review.variables?.submissionId === item.id ? <LoaderCircle size={15}/> : <Check size={15}/>} اعتماد
                  </button>
                  <button type="button" className="is-reject" disabled={review.isPending} onClick={() => reviewSubmission(item, "rejected")} data-testid={`button-reject-submission-${item.id}`}>
                    {review.isPending && review.variables?.submissionId === item.id ? <LoaderCircle size={15}/> : <X size={15}/>} رفض
                  </button>
                </>}
              </div>
            </article>)}
          </div>}
    {query.data && query.data.total > query.data.pageSize && <nav className="adm-module-submissions-pager" aria-label="صفحات الملفات">
      <button type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>السابق</button>
      <span>صفحة {page.toLocaleString("ar")} من {Math.ceil(query.data.total / query.data.pageSize).toLocaleString("ar")}</span>
      <button type="button" disabled={page * query.data.pageSize >= query.data.total || query.isFetching} onClick={() => setPage(value => value + 1)}>التالي</button>
    </nav>}
  </section>;
}
