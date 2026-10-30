import { useState, type FormEvent } from "react";
import { uploadFile } from "../lib/upload-file";
import { AcademyVideoPlayer } from "./AcademyVideoPlayer";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Download, FileText, Link2, LoaderCircle, Send, Upload } from "lucide-react";
import { RequiredMark } from "../components/RequiredMark";
import {
  getListMyAcademyCourseSubmissionsQueryKey,
  useConfirmAcademyCourseSubmissionUpload,
  useListApprovedAcademyCommunityCourses,
  useListMyAcademyCourseSubmissions,
  useRequestAcademyCourseSubmissionUpload,
  useSubmitAcademyCourseLink,
} from "@workspace/api-client-react";
import type { AcademyCourseSubmissionStatus } from "@workspace/api-client-react";

type SourceMode = "file" | "link";
type CourseDraft = { title: string; description: string; sourceUrl: string };

const statusLabel: Record<AcademyCourseSubmissionStatus, string> = {
  uploading: "جارٍ تجهيز الملف",
  pending: "بانتظار المراجعة",
  approved: "تمت الموافقة",
  rejected: "لم تُعتمد",
};

function mimeFromName(name: string) {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf" as const;
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const;
  if (ext === "txt") return "text/plain" as const;
  if (ext === "mp4") return "video/mp4" as const;
  if (ext === "webm") return "video/webm" as const;
  return null;
}

export function CommunityCoursesPanel() {
  const qc = useQueryClient();
  const catalog = useListApprovedAcademyCommunityCourses();
  const submissions = useListMyAcademyCourseSubmissions();
  const uploadRequest = useRequestAcademyCourseSubmissionUpload();
  const confirmUpload = useConfirmAcademyCourseSubmissionUpload();
  const submitLink = useSubmitAcademyCourseLink();
  const [mode, setMode] = useState<SourceMode>("file");
  const [draft, setDraft] = useState<CourseDraft>({ title: "", description: "", sourceUrl: "" });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploading, setUploading] = useState(false);

  const refreshSubmissions = () => qc.invalidateQueries({ queryKey: getListMyAcademyCourseSubmissionsQueryKey() });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (mode === "link") {
        const url = new URL(draft.sourceUrl);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("link");
        await submitLink.mutateAsync({ data: {
          title: draft.title.trim(),
          description: draft.description.trim(),
          sourceUrl: url.toString(),
        } });
      } else {
        if (!file) throw new Error("file");
        const mime = mimeFromName(file.name);
        if (!mime || file.size < 1 || !Number.isSafeInteger(file.size)) throw new Error("file");
        const upload = await uploadRequest.mutateAsync({ data: {
          title: draft.title.trim(),
          description: draft.description.trim(),
          originalName: file.name.slice(0, 180),
          mime,
          size: file.size,
        } });
        setUploading(true);
        await uploadFile(upload.uploadUrl, file, mime, setUploadPercent);
        setUploading(false);
        await confirmUpload.mutateAsync({ submissionId: upload.id });
      }
      setDraft({ title: "", description: "", sourceUrl: "" });
      setFile(null);
      const input = document.getElementById("academy-course-file") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage("تم إرسال المحتوى للمراجعة. سيظهر للطلاب بعد اعتماده.");
      await refreshSubmissions();
    } catch {
      setError(mode === "file"
        ? "تعذّر رفع الملف. استخدم PDF أو DOCX أو TXT أو فيديو MP4/WebM غير فارغ، وتحقق من استقرار الاتصال."
        : "تحقق من الرابط والعنوان ثم حاول مرة أخرى.");
      await refreshSubmissions();
    } finally {
      setUploading(false);
    }
  };

  const busy = uploading || uploadRequest.isPending || confirmUpload.isPending || submitLink.isPending;
  const titleReady = draft.title.trim().length >= 3;
  const submitHint = !titleReady
    ? "اكتب عنوانًا من ٣ أحرف على الأقل؛ الوصف اختياري."
    : mode === "file" && !file
      ? "اختر ملفًا أو فيديو لإكمال الإرسال."
      : mode === "link" && !draft.sourceUrl.trim()
        ? "أضف رابط المحتوى لإكمال الإرسال."
        : "";

  return <section className="ac-panel ac-community-courses" aria-labelledby="community-courses-title">
    <div className="ac-meta"><BookOpen size={17}/><span className="ac-kicker">مشاركة المعرفة</span></div>
    <h2 id="community-courses-title" style={{ margin: "4px 0 7px", fontSize: 17 }}>محتوى تعليمي من الأعضاء</h2>
    <p className="ac-community-intro">ارفع ملفًا أو فيديو أو أرسل رابطًا لمحتوى تعليمي. لا يظهر للطلاب قبل مراجعته واعتماده.</p>
    {uploading && <div role="status"><p>جارٍ رفع الملف: {uploadPercent.toLocaleString("ar")}٪</p><progress value={uploadPercent} max={100} aria-label="نسبة رفع المحتوى التعليمي" style={{ width: "100%" }}/></div>}

    <form className="ac-community-form" onSubmit={submit}>
      <div className="ac-admin-tabs" role="group" aria-label="نوع المحتوى">
        <button type="button" className={`ac-button ${mode === "file" ? "ac-button-primary" : ""}`} onClick={() => { setMode("file"); setError(""); }}>ملف تعليمي <Upload size={14}/></button>
        <button type="button" className={`ac-button ${mode === "link" ? "ac-button-primary" : ""}`} onClick={() => { setMode("link"); setError(""); }}>رابط محتوى <Link2 size={14}/></button>
      </div>
      <label className="ac-field"><span>عنوان المحتوى <RequiredMark/></span><input required minLength={3} maxLength={160} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })}/></label>
      <label className="ac-field">وصف مختصر<textarea rows={2} maxLength={2000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })}/></label>
      {mode === "link"
        ? <label className="ac-field"><span>رابط المحتوى <RequiredMark/></span><input required type="url" dir="ltr" maxLength={2000} value={draft.sourceUrl} onChange={event => setDraft({ ...draft, sourceUrl: event.target.value })} placeholder="https://"/></label>
        : <label className="ac-button ac-community-file" style={{ cursor: busy ? "wait" : "pointer" }}><FileText size={15}/>{file ? file.name : "اختر ملفًا أو فيديو"}<input id="academy-course-file" className="ac-sr" type="file" accept=".pdf,.docx,.txt,.mp4,.webm" disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)}/></label>}
      {error && <p className="ac-inline-error" role="alert">{error}</p>}
      {message && <p className="ac-community-message" role="status"><CheckCircle2 size={15}/>{message}</p>}
      {submitHint && <p className="ac-community-hint" role="status">{submitHint}</p>}
      <button className="ac-button ac-button-primary" type="submit" disabled={busy || !titleReady || (mode === "file" && !file)}>
        {busy ? <><LoaderCircle className="ac-community-spin" size={15}/> جارٍ الإرسال</> : <>إرسال للمراجعة <Send size={14}/></>}
      </button>
    </form>

    <div className="ac-community-columns">
      <div>
        <h3 className="ac-community-subtitle">مشاركاتي</h3>
        {submissions.isLoading ? <p className="ac-community-muted">جارٍ تحميل مشاركاتك…</p>
          : submissions.isError ? <button className="ac-button" type="button" onClick={() => submissions.refetch()}>تعذّر تحميل المشاركات · إعادة المحاولة</button>
            : submissions.data?.items.length ? <ul className="ac-community-list">{submissions.data.items.slice(0, 5).map(item => <li key={item.id}><span>{item.title}</span><b className={`ac-community-status status-${item.status}`}>{statusLabel[item.status]}</b>{item.reviewNote && <small>{item.reviewNote}</small>}</li>)}</ul>
              : <p className="ac-community-muted">لم ترسل محتوى بعد.</p>}
      </div>
      <div>
        <h3 className="ac-community-subtitle">محتوى معتمد</h3>
        {catalog.isLoading ? <p className="ac-community-muted">جارٍ تحميل المحتوى…</p>
          : catalog.isError ? <button className="ac-button" type="button" onClick={() => catalog.refetch()}>تعذّر تحميل المحتوى · إعادة المحاولة</button>
            : catalog.data?.items.length ? <ul className="ac-community-list">{catalog.data.items.slice(0, 6).map(item => <li key={item.id}>
              <span>{item.title}{item.description && <small>{item.description}</small>}</span>
              {item.downloadUrl && item.mime?.startsWith("video/") ? <AcademyVideoPlayer scope={`community-course-${item.id}`} id={item.id} url={item.downloadUrl} title={item.title}/>
                : item.downloadUrl ? <a className="ac-button" href={item.downloadUrl}><Download size={14}/> تنزيل</a>
                : item.sourceUrl ? <a className="ac-button" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">فتح الرابط <Link2 size={14}/></a>
                  : <span className="ac-community-status status-approved">معتمد</span>}
            </li>)}</ul>
              : <p className="ac-community-muted">سيظهر المحتوى بعد اعتماده.</p>}
      </div>
    </div>
  </section>;
}
