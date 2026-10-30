import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Download, FileText, LoaderCircle, ShieldCheck, Trash2, Upload, XCircle } from "lucide-react";
import {
  downloadModuleSubmission,
  getListModuleSubmissionsQueryKey,
  useConfirmModuleSubmissionUpload,
  useDeleteModuleSubmission,
  useListModuleSubmissions,
  useRequestModuleSubmissionUpload,
} from "@workspace/api-client-react";
import type { ModuleKey } from "@workspace/api-client-react";
import "./student-module-submissions.css";

const acceptedMimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

function getSupportedMime(file: File): string {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const expectedMime = acceptedMimeByExtension[extension];
  return expectedMime && (!file.type || file.type === "application/octet-stream" || file.type === expectedMime)
    ? expectedMime
    : "";
}

function uploadToSignedUrl(
  file: File,
  mime: string,
  uploadUrl: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", mime);
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error("تعذّر رفع الملف إلى التخزين."));
    request.onerror = () => reject(new Error("انقطع الاتصال أثناء رفع الملف."));
    request.onabort = () => reject(new Error("تم إيقاف رفع الملف."));
    request.send(file);
  });
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size.toLocaleString("ar")} بايت`;
  const units = ["ك.ب", "م.ب", "ج.ب", "ت.ب"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("ar-EG", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

const statusCopy = {
  uploading: { label: "لم يكتمل الرفع", icon: LoaderCircle, className: "is-uploading" },
  pending: { label: "قيد مراجعة الإدارة", icon: Clock3, className: "is-pending" },
  approved: { label: "تمت الموافقة", icon: CheckCircle2, className: "is-approved" },
  rejected: { label: "تحتاج إلى تعديل", icon: XCircle, className: "is-rejected" },
} as const;

export function StudentModuleSubmissions({ moduleKey }: { moduleKey: ModuleKey }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useListModuleSubmissions(moduleKey, {
    query: { queryKey: getListModuleSubmissionsQueryKey(moduleKey), staleTime: 20_000 },
  });
  const requestUpload = useRequestModuleSubmissionUpload();
  const confirmUpload = useConfirmModuleSubmissionUpload();
  const deleteSubmission = useDeleteModuleSubmission();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!files.length || busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    let completed = 0;
    try {
      for (const [index, file] of files.entries()) {
        const mime = getSupportedMime(file);
        if (!mime) {
          throw new Error(`نوع الملف «${file.name}» غير مدعوم. استخدم PDF أو Word أو صورة أو فيديو MP4/WebM.`);
        }
        const upload = await requestUpload.mutateAsync({
          moduleKey,
          data: {
            title: file.name.slice(0, 160),
            note: note.trim() || null,
            originalName: file.name.slice(0, 255),
            mime,
            size: file.size,
          },
        });
        await uploadToSignedUrl(file, mime, upload.uploadUrl, value => {
          setProgress(Math.round(((index + value / 100) / files.length) * 100));
        });
        await confirmUpload.mutateAsync({ moduleKey, submissionId: upload.id });
        completed += 1;
      }
      setFiles([]);
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
      setNotice(completed === 1 ? "تم إرسال الملف للإدارة للمراجعة." : `تم إرسال ${completed.toLocaleString("ar")} ملفات للإدارة للمراجعة.`);
      await queryClient.invalidateQueries({ queryKey: getListModuleSubmissionsQueryKey(moduleKey) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر رفع الملف. تحقق من الاتصال وحاول مرة أخرى.");
      await queryClient.invalidateQueries({ queryKey: getListModuleSubmissionsQueryKey(moduleKey) });
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const remove = (submissionId: string) => {
    if (!window.confirm("هل تريد حذف هذا الملف من القسم؟")) return;
    deleteSubmission.mutate({ moduleKey, submissionId }, {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListModuleSubmissionsQueryKey(moduleKey) }),
      onError: () => setError("تعذّر حذف الملف. حاول مرة أخرى."),
    });
  };
  const download = async (submissionId: string, fileName: string) => {
    setDownloadingId(submissionId);
    setError("");
    try {
      const blob = await downloadModuleSubmission(moduleKey, submissionId);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setError("تعذّر تنزيل الملف. حاول مرة أخرى.");
    } finally {
      setDownloadingId(null);
    }
  };

  return <section className="student-module-submissions" aria-labelledby={`student-submissions-title-${moduleKey}`} dir="rtl" data-testid={`student-module-submissions-${moduleKey}`}>
    <header className="student-submissions-heading">
      <span className="student-submissions-mark"><Upload size={18}/></span>
      <div>
        <span className="student-submissions-kicker"><ShieldCheck size={13}/> ملفاتك في القسم</span>
        <h2 id={`student-submissions-title-${moduleKey}`}>ارفع إنجازاتك وأدلتك</h2>
        <p>أرسل صورًا أو مستندات أو فيديوهات، ويمكنك إضافة ملاحظة للإدارة.</p>
      </div>
    </header>
    <p className="student-submissions-privacy">الملفات تظهر لك وللإدارة للمراجعة فقط، ولا تظهر للطلاب الآخرين.</p>

    <form className="student-submissions-form" onSubmit={submit}>
      <label className="student-submissions-picker">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.mp4,.webm"
          disabled={busy}
          onChange={event => { setFiles(Array.from(event.currentTarget.files ?? [])); setError(""); setNotice(""); }}
          data-testid={`input-student-module-files-${moduleKey}`}
        />
        <span className="student-submissions-picker-icon"><Upload size={18}/></span>
        <span><strong>اختر ملفات أو فيديوهات</strong><small>يمكنك تحديد أكثر من ملف في المرة نفسها</small></span>
      </label>
      {files.length > 0 && <ul className="student-submissions-selection" aria-label="الملفات المختارة">
        {files.map((file, index) => <li key={`${file.name}-${index}`}><FileText size={15}/><span>{file.name}</span><small>{formatBytes(file.size)}</small></li>)}
      </ul>}
      <label className="student-submissions-note">
        <span>ملاحظة للإدارة (اختياري)</span>
        <textarea value={note} maxLength={2000} rows={2} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="اكتب وصفًا مختصرًا للملفات أو الإنجاز"/>
      </label>
      {busy && <div className="student-submissions-progress" role="status" aria-live="polite">
        <div><span>جارٍ رفع الملفات</span><strong>{progress.toLocaleString("ar")}٪</strong></div>
        <progress max={100} value={progress} aria-label="نسبة رفع الملفات"/>
      </div>}
      {error && <p className="student-submissions-message is-error" role="alert">{error}</p>}
      {notice && <p className="student-submissions-message is-success" role="status">{notice}</p>}
      <button className="button button-primary student-submissions-submit" type="submit" disabled={busy || files.length === 0}>
        {busy ? <LoaderCircle size={16} className="student-submissions-spin"/> : <Upload size={16}/>}
        {busy ? "جارٍ الإرسال…" : "إرسال للإدارة للمراجعة"}
      </button>
      <p className="student-submissions-size-note">لا يوجد حدّ مصطنع لحجم الملف؛ يعتمد نجاح الرفع على حدود التخزين والاتصال.</p>
    </form>

    <div className="student-submissions-list">
      <div className="student-submissions-list-heading"><h3>ملفاتي المرسلة</h3>
        {query.data && <span>{query.data.items.length.toLocaleString("ar")} ملف</span>}</div>
      {query.isLoading ? <p className="student-submissions-empty" role="status">جارٍ تحميل ملفاتك…</p>
        : query.isError ? <div className="student-submissions-message is-error" role="alert">
          <span>تعذّر تحميل ملفاتك.</span><button type="button" onClick={() => void query.refetch()}>إعادة المحاولة</button>
        </div>
          : query.data?.items.length ? <div className="student-submission-cards">
            {query.data.items.map(item => {
              const status = statusCopy[item.status];
              const StatusIcon = status.icon;
              return <article className="student-submission-card" key={item.id} data-testid={`student-submission-${item.id}`}>
                <div className="student-submission-file-icon"><FileText size={17}/></div>
                <div className="student-submission-copy">
                  <strong>{item.title}</strong>
                  <small>{item.originalName} · {formatBytes(item.size)}</small>
                  <span className={`student-submission-status ${status.className}`}><StatusIcon size={13}/>{status.label}</span>
                  {item.reviewNote && <p className="student-submission-review-note">ملاحظة الإدارة: {item.reviewNote}</p>}
                  {item.note && <p>{item.note}</p>}
                </div>
                <div className="student-submission-actions">
                  {item.downloadUrl && <button type="button" onClick={() => void download(item.id, item.originalName)} disabled={downloadingId === item.id} aria-label={`تنزيل ${item.originalName}`}><Download size={15}/></button>}
                  <button type="button" onClick={() => remove(item.id)} disabled={deleteSubmission.isPending} aria-label={`حذف ${item.originalName}`}><Trash2 size={15}/></button>
                </div>
              </article>;
            })}
          </div> : <p className="student-submissions-empty">لم ترسل ملفات لهذا القسم بعد.</p>}
    </div>
  </section>;
}
