import { useState } from "react";
import { FileText, Headphones, Image as ImageIcon, Link2, LoaderCircle, Upload, Video } from "lucide-react";
import { RequiredMark } from "../components/RequiredMark";
import { useConfirmSectionMediaUpload, useRequestSectionMediaUpload } from "@workspace/api-client-react";
import type { SectionBlock, SectionMediaUploadInput } from "@workspace/api-client-react";

const acceptedMimeTypes = new Set<SectionMediaUploadInput["mime"]>([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm",
  "video/mp4", "video/webm", "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain",
]);
const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain",
};
const kindForMime = (mime: string): "image" | "audio" | "video" | "file" => mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : "file";

export function SectionContentBlockEditor({
  block, name, testIdPrefix, onChange,
}: {
  block: SectionBlock;
  name: string;
  testIdPrefix?: string;
  onChange: (patch: Partial<SectionBlock>) => void;
}) {
  const requestUpload = useRequestSectionMediaUpload();
  const confirmUpload = useConfirmSectionMediaUpload();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const upload = async (file?: File) => {
    if (!file) return;
    setUploadError("");
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = (file.type || mimeByExtension[extension] || "") as SectionMediaUploadInput["mime"];
    if (!acceptedMimeTypes.has(mime)) {
      setUploadError("الملف غير مدعوم. اختر صورة أو صوتًا أو فيديو أو PDF أو Word أو ملفًا نصيًا.");
      return;
    }
    if (file.size < 1) {
      setUploadError("الملف فارغ.");
      return;
    }
    setUploading(true);
    try {
      const ticket = await requestUpload.mutateAsync({ data: { originalName: file.name, mime, size: file.size } });
      const uploaded = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: file,
      });
      if (!uploaded.ok) throw new Error("تعذّر رفع الملف إلى التخزين.");
      const confirmed = await confirmUpload.mutateAsync({ id: ticket.id });
      onChange({ type: "media", mediaType: kindForMime(mime), url: confirmed.url });
    } catch {
      setUploadError("لم يكتمل رفع الملف. تحقق من الاتصال وحاول مرة أخرى.");
    } finally {
      setUploading(false);
    }
  };

  return <div className="adm-block-editor-fields">
    <fieldset className="adm-kind adm-section-block-kind">
      <legend>نوع المحتوى</legend>
      <label className={block.type === "text" ? "on" : ""}><input type="radio" name={name} checked={block.type === "text"} onChange={() => onChange({ type: "text", url: "", mediaType: undefined })}/> نص</label>
      <label className={block.type === "link" ? "on" : ""}><input type="radio" name={name} checked={block.type === "link"} onChange={() => onChange({ type: "link", url: "", mediaType: undefined })}/><Link2 size={14}/> رابط</label>
      <label className={block.type === "media" ? "on" : ""}><input type="radio" name={name} checked={block.type === "media"} onChange={() => onChange({ type: "media", url: "", mediaType: undefined })}/><Upload size={14}/> مرفق</label>
    </fieldset>
     <label className="adm-field"><span>{block.type === "link" ? "عنوان الرابط" : block.type === "media" ? "عنوان المرفق" : "عنوان النص"} <RequiredMark/></span>
      <input required maxLength={100} value={block.title} onChange={event => onChange({ title: event.target.value })} data-testid={testIdPrefix ? `${testIdPrefix}-title` : undefined}/>
    </label>
    {block.type !== "text" && <label className="adm-field"><span>{block.type === "link" ? "وصف الرابط" : "وصف المرفق"}</span>
      <textarea maxLength={2000} rows={3} value={block.body} onChange={event => onChange({ body: event.target.value })} data-testid={testIdPrefix ? `${testIdPrefix}-body` : undefined}/>
    </label>}
     {block.type === "text" && <label className="adm-field"><span>النص <RequiredMark/></span>
      <textarea required minLength={1} maxLength={2000} rows={3} value={block.body} onChange={event => onChange({ body: event.target.value })} data-testid={testIdPrefix ? `${testIdPrefix}-body` : undefined}/>
    </label>}
     {block.type === "link" && <label className="adm-field"><span>الرابط <RequiredMark/></span>
      <input required type="url" dir="ltr" maxLength={2048} placeholder="https://" value={block.url} onChange={event => onChange({ url: event.target.value })} data-testid={testIdPrefix ? `${testIdPrefix}-url` : undefined}/>
    </label>}
    {block.type === "media" && <>
      <label className="adm-field"><span>اختيار صورة أو صوت أو فيديو أو ملف</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,video/mp4,video/webm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          disabled={uploading} onChange={event => { void upload(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}/>
      </label>
      <small className="adm-upload-hint">لا يفرض التطبيق حدًا لحجم الملف؛ قد يستغرق رفع الملفات الكبيرة وقتًا أطول حسب سرعة الاتصال.</small>
      {uploading && <p className="adm-upload-status" role="status"><LoaderCircle size={15} className="adm-spin"/> جارٍ رفع الملف والتحقق منه…</p>}
      {uploadError && <p className="adm-form-error" role="alert">{uploadError}</p>}
      {block.url && block.mediaType === "image" && <img className="adm-media-preview" src={block.url} alt={block.title || "معاينة الصورة"} loading="lazy"/>}
      {block.url && block.mediaType === "audio" && <audio className="adm-media-preview" src={block.url} controls preload="metadata"/>}
      {block.url && block.mediaType === "video" && <video className="adm-media-preview" src={block.url} controls preload="metadata"/>}
      {block.url && block.mediaType === "file" && <a className="adm-media-file-link" href={block.url} target="_blank" rel="noopener noreferrer"><FileText size={16}/> فتح المرفق</a>}
      {block.url && <span className="adm-upload-status">{block.mediaType === "image" ? <ImageIcon size={14}/> : block.mediaType === "audio" ? <Headphones size={14}/> : block.mediaType === "video" ? <Video size={14}/> : <FileText size={14}/>} تم التحقق من الملف؛ سيظهر للطلاب بعد نشر المحتوى.</span>}
    </>}
  </div>;
}
