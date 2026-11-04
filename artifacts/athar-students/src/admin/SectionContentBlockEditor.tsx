import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, Headphones, Image as ImageIcon, Link2, LoaderCircle, Upload, Video } from "lucide-react";
import { RequiredMark } from "../components/RequiredMark";
import { useConfirmSectionMediaUpload, useRequestSectionMediaUpload } from "@workspace/api-client-react";
import type { SectionBlock, SectionMediaUploadInput, SectionMediaUploadRequest } from "@workspace/api-client-react";
import { uploadFile, UploadSessionExpiredError } from "../lib/upload-file";
import { adminPreviewMediaUrl, versionedVideoStreamUrl } from "../lib/section-units";

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
  block, name, testIdPrefix, maxBatchFileCount, onChange, onUploadMany,
}: {
  block: SectionBlock;
  name: string;
  testIdPrefix?: string;
  maxBatchFileCount: number;
  onChange: (patch: Partial<SectionBlock>) => void;
  onUploadMany: (blocks: SectionBlock[]) => void;
}) {
  const requestUpload = useRequestSectionMediaUpload();
  const confirmUpload = useConfirmSectionMediaUpload();
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  const tickets = useRef(new WeakMap<File, SectionMediaUploadRequest>());
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => () => uploadController.current?.abort(), []);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploadError("");
    if (files.length > maxBatchFileCount) {
      setUploadError(`يمكنك إضافة ${maxBatchFileCount.toLocaleString("ar")} ملفًا في هذا المكان كحد أقصى.`);
      return;
    }
    const selectedFiles = files.map(file => {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mime = (file.type || mimeByExtension[extension] || "") as SectionMediaUploadInput["mime"];
      return { file, mime };
    });
    const unsupported = selectedFiles.find(({ file, mime }) => !acceptedMimeTypes.has(mime) || file.size < 1);
    if (unsupported) {
      const message = unsupported.file.size < 1 ? "الملف فارغ." : `نوع الملف غير مدعوم: ${unsupported.file.name}`;
      setUploadError(message);
      return;
    }
    setUploading(true);
    setRetryFiles([]);
    const controller = new AbortController();
    uploadController.current = controller;
    const uploadedBlocks: SectionBlock[] = [];
    const applyUploadedBlocks = () => {
      if (uploadedBlocks.length === 1) onChange(uploadedBlocks[0]);
      else if (uploadedBlocks.length > 1) onUploadMany(uploadedBlocks);
    };
    try {
      for (const [index, { file, mime }] of selectedFiles.entries()) {
        setUploadStatus(files.length > 1
          ? `جارٍ رفع الملف ${index + 1} من ${files.length}: ${file.name}`
          : `جارٍ رفع ${file.name}…`);
        let ticket = tickets.current.get(file);
        if (!ticket) {
          ticket = await requestUpload.mutateAsync({ data: { originalName: file.name, mime, size: file.size, resumable: true } });
          tickets.current.set(file, ticket);
        }
        if (controller.signal.aborted) throw new DOMException("تم إيقاف الرفع.", "AbortError");
        try {
          await uploadFile(ticket.uploadUrl, file, mime, setUploadPercent, {
            resumable: ticket.resumable,
            signal: controller.signal,
            onStatus: status => setUploadStatus(status === "reconnecting"
              ? `انقطع الاتصال؛ جارٍ استكمال ${file.name} من آخر جزء محفوظ…`
              : `جارٍ رفع الملف ${index + 1} من ${files.length}: ${file.name}`),
          });
        } catch (error) {
          if (error instanceof UploadSessionExpiredError) tickets.current.delete(file);
          throw error;
        }
        setUploadStatus(`جارٍ التحقق من ${file.name}…`);
        const confirmed = await confirmUpload.mutateAsync({ id: ticket.id });
        tickets.current.delete(file);
        uploadedBlocks.push({
          type: "media",
          mediaType: kindForMime(mime),
          title: files.length === 1 ? block.title : file.name.slice(0, 100),
          body: block.body,
          url: confirmed.url,
        });
      }
      applyUploadedBlocks();
    } catch (error) {
      setRetryFiles(files.slice(uploadedBlocks.length));
      if (uploadedBlocks.length) {
        applyUploadedBlocks();
        setUploadError("توقف رفع المجموعة قبل اكتمالها؛ أُضيفت الملفات التي اكتمل رفعها. يمكنك استكمال باقي الملفات.");
      } else {
        setUploadError(error instanceof Error && error.name === "AbortError"
          ? "توقف الرفع. يمكنك استكماله من آخر جزء محفوظ ما دامت الصفحة مفتوحة."
          : error instanceof UploadSessionExpiredError ? error.message
          : "لم يكتمل الرفع أو التحقق منه. اضغط «استكمال الرفع» لإعادة المحاولة بدون إعادة الأجزاء المحفوظة.");
      }
    } finally {
      setUploading(false);
      uploadController.current = null;
      setUploadStatus("");
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
        <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,video/mp4,video/webm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          disabled={uploading} onChange={event => { void upload(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }}/>
      </label>
      <small className="adm-upload-hint">يمكنك اختيار عدة ملفات دفعة واحدة، ثم إضافة روابط في القائمة نفسها. الملفات الكبيرة تحتاج وقتًا أطول.</small>
      {uploading && <div role="status"><p className="adm-upload-status"><LoaderCircle size={15} className="adm-spin"/> {uploadStatus} — {uploadPercent.toLocaleString("ar")}٪</p><progress value={uploadPercent} max={100} aria-label="نسبة رفع الملف" style={{ width: "100%" }}/></div>}
      {uploading && <button type="button" className="button button-outline" onClick={() => uploadController.current?.abort()}>إيقاف الرفع مؤقتًا</button>}
      {uploadError && <p className="adm-form-error" role="alert">{uploadError}</p>}
      {!uploading && retryFiles.length > 0 && <button type="button" className="button button-outline" onClick={() => void upload(retryFiles)}>استكمال الرفع</button>}
      <small className="adm-upload-status">الرفع يدعم الاستكمال عند انقطاع الإنترنت. اترك الصفحة مفتوحة؛ إغلاقها أو تحديثها يتطلب إعادة اختيار الملف وبدء رفع جديد.</small>
      {block.url && block.mediaType === "image" && <img className="adm-media-preview" src={adminPreviewMediaUrl(block.url)} alt={block.title || "معاينة الصورة"} loading="lazy"/>}
      {block.url && block.mediaType === "audio" && <audio className="adm-media-preview" src={adminPreviewMediaUrl(block.url)} controls preload="metadata"/>}
      {block.url && block.mediaType === "video" && <video className="adm-media-preview" src={versionedVideoStreamUrl(adminPreviewMediaUrl(block.url))} controls preload="metadata"/>}
       {block.url && block.mediaType === "file" && <button className="adm-media-file-link" type="button" onClick={() => setFilePreviewOpen(true)}><FileText size={16}/> معاينة داخل أثر</button>}
       {filePreviewOpen && block.url && block.mediaType === "file" && <div className="adm-inline-file-preview-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setFilePreviewOpen(false); }}>
         <section className="adm-inline-file-preview" role="dialog" aria-modal="true" aria-label={`معاينة ${block.title}`}>
           <header><b>{block.title || "معاينة الملف"}</b><button type="button" onClick={() => setFilePreviewOpen(false)}><ArrowRight size={16}/> رجوع للبرنامج</button></header>
           <iframe src={adminPreviewMediaUrl(block.url)} title={`معاينة ${block.title}`} />
         </section>
       </div>}
      {block.url && <span className="adm-upload-status">{block.mediaType === "image" ? <ImageIcon size={14}/> : block.mediaType === "audio" ? <Headphones size={14}/> : block.mediaType === "video" ? <Video size={14}/> : <FileText size={14}/>} تم التحقق من الملف؛ سيظهر للطلاب بعد نشر المحتوى.</span>}
    </>}
  </div>;
}
