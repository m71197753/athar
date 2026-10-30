import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { StudentResume, StudentResumeContent } from "@workspace/api-client-react";
import {
  getListStudentResumesQueryKey,
  useCreateStudentResume,
  useDeleteStudentResume,
  useListStudentResumes,
  useUpdateStudentResume,
} from "@workspace/api-client-react";
import {
  AlertCircle, Check, FileText, Layers2, LoaderCircle, Plus, Printer, Save, Trash2, X,
  ArrowDownToLine,
} from "lucide-react";
import { downloadStudentResumeDocx } from "./resume-export";
import { scoreStudentResume } from "./resume-document";
import {
  colorContrastRatio,
  DEFAULT_RESUME_APPEARANCE,
  RESUME_COLOR_PRESETS,
  RESUME_FONT_LABELS,
  RESUME_FONT_STACKS,
  withResumeAppearance,
  type ResumeAppearance,
  type ResumeFontFamily,
} from "./resume-appearance";
import "./resume-template-studio.css";

type ManualTemplate = "ats" | "classic" | "modern" | "sidebar";
type EntrySection = "education" | "experience" | "projects" | "courses";
type ListSection = "skills" | "certifications" | "languages";
type ResumeEntry = StudentResumeContent[EntrySection][number];
type SaveState = "saved" | "pending" | "saving" | "error" | "unsaved";

const blankContent = (): StudentResumeContent => ({
  fullName: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  website: "",
  headline: "",
  summary: "",
  education: [],
  experience: [],
  projects: [],
  courses: [],
  skills: [],
  certifications: [],
  languages: [],
  appearance: { ...DEFAULT_RESUME_APPEARANCE },
});
const blankEntry = (): ResumeEntry => ({
  title: "",
  organization: "",
  location: "",
  period: "",
  description: "",
  link: "",
});
const entrySections: EntrySection[] = ["education", "experience", "projects", "courses"];
const listSections: ListSection[] = ["skills", "certifications", "languages"];
const sectionLabels: Record<EntrySection | ListSection, string> = {
  education: "التعليم",
  experience: "الخبرات",
  projects: "المشروعات",
  courses: "الدورات",
  skills: "المهارات",
  certifications: "الشهادات",
  languages: "اللغات",
};
const entryLimits: Record<EntrySection, number> = { education: 20, experience: 30, projects: 30, courses: 30 };
const listLimits: Record<ListSection, number> = { skills: 60, certifications: 30, languages: 20 };
const listItemLimits: Record<ListSection, number> = { skills: 80, certifications: 180, languages: 100 };
const templateLabels: Record<ManualTemplate, { title: string; description: string }> = {
  ats: { title: "ATS بسيط", description: "عمود واحد وعناوين واضحة" },
  classic: { title: "كلاسيكي", description: "ترتيب هادئ وواضح" },
  modern: { title: "حديث", description: "تفاصيل بلمسة نيليّة" },
  sidebar: { title: "جانبي", description: "معلوماتك في عمود مستقل" },
};
const atsSectionLabels: Record<EntrySection | ListSection, string> = {
  education: "EDUCATION | التعليم",
  experience: "WORK EXPERIENCE | الخبرات",
  projects: "PROJECTS | المشروعات",
  courses: "COURSES | الدورات",
  skills: "SKILLS | المهارات",
  certifications: "CERTIFICATIONS | الشهادات",
  languages: "LANGUAGES | اللغات",
};
const formatDate = (value: string) => value
  ? new Intl.DateTimeFormat("ar", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
  : "مسودة جديدة";

export default function ResumeTemplateStudio() {
  const queryClient = useQueryClient();
  const resumesQuery = useListStudentResumes({ query: { queryKey: getListStudentResumesQueryKey() } });
  const createResume = useCreateStudentResume();
  const updateResume = useUpdateStudentResume();
  const deleteResume = useDeleteStudentResume();
  const manualResumes = useMemo(
    () => (resumesQuery.data ?? []).filter(resume => resume.origin === "manual"),
    [resumesQuery.data],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<ManualTemplate>("ats");
  const [content, setContent] = useState<StudentResumeContent>(() => blankContent());
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [deleteError, setDeleteError] = useState("");
  const [exportError, setExportError] = useState("");
  const [createError, setCreateError] = useState("");
  const [newTitle, setNewTitle] = useState("مسودة جديدة");
  const initializedId = useRef<string | null>(null);
  const lastSaved = useRef("");
  const failedSaveKey = useRef("");
  const activeIdRef = useRef(activeId);
  const updateMutationRef = useRef(updateResume.mutate);
  activeIdRef.current = activeId;
  updateMutationRef.current = updateResume.mutate;

  const activeDraft = manualResumes.find(resume => resume.id === activeId);
  const readiness = useMemo(() => scoreStudentResume(content), [content]);

  useEffect(() => {
    if (!activeId) return;
    const selected = manualResumes.find(item => item.id === activeId);
    if (selected && initializedId.current !== selected.id) {
      initializedId.current = selected.id;
      setTitle(selected.title);
      setTemplate(selected.template as ManualTemplate);
      const normalizedContent = withResumeAppearance(selected.content);
      setContent(normalizedContent);
      lastSaved.current = JSON.stringify({
        title: selected.title,
        template: selected.template,
        content: normalizedContent,
      });
      failedSaveKey.current = "";
      setSaveState("saved");
    }
  }, [activeId, manualResumes]);

  const saveCurrentDraft = useCallback(() => {
    const saveId = activeId;
    const safeTitle = title.trim();
    if (!saveId || !safeTitle) {
      setSaveState("unsaved");
      return;
    }
    const snapshot = { title: safeTitle, template, content };
    const snapshotKey = JSON.stringify(snapshot);
    const failureKey = JSON.stringify([saveId, snapshotKey]);
    if (snapshotKey === lastSaved.current) {
      setSaveState("saved");
      return;
    }
    failedSaveKey.current = "";
    setSaveState("saving");
    updateMutationRef.current(
      { id: saveId, data: { ...snapshot, origin: "manual" } },
      {
        onSuccess: () => {
          if (activeIdRef.current === saveId) {
            lastSaved.current = snapshotKey;
            setSaveState("saved");
          }
          if (failedSaveKey.current === failureKey) failedSaveKey.current = "";
          void queryClient.invalidateQueries({ queryKey: getListStudentResumesQueryKey() });
        },
        onError: () => {
          if (activeIdRef.current === saveId) {
            failedSaveKey.current = failureKey;
            setSaveState("error");
          }
        },
      },
    );
  }, [activeId, content, queryClient, template, title]);

  useEffect(() => {
    if (!activeId || initializedId.current !== activeId) return;
    if (updateResume.isPending) return;
    if (!title.trim()) {
      setSaveState("unsaved");
      return;
    }
    const nextKey = JSON.stringify({ title: title.trim(), template, content });
    if (nextKey === lastSaved.current) {
      if (saveState !== "saved") setSaveState("saved");
      return;
    }
    if (failedSaveKey.current === JSON.stringify([activeId, nextKey])) return;
    setSaveState("pending");
    const timer = window.setTimeout(saveCurrentDraft, 700);
    return () => window.clearTimeout(timer);
  }, [activeId, content, saveCurrentDraft, saveState, template, title, updateResume.isPending]);

  const chooseDraft = (draft: StudentResume) => {
    if (draft.id === activeId) return;
    if (activeId && initializedId.current === activeId && title.trim()) saveCurrentDraft();
    initializedId.current = null;
    setActiveId(draft.id);
    setDeleteError("");
    setExportError("");
  };

  const createDraft = () => {
    const safeTitle = newTitle.trim().slice(0, 120);
    if (!safeTitle) {
      setCreateError("اكتب عنواناً للمسودة أولاً.");
      return;
    }
    setCreateError("");
    const empty = blankContent();
    createResume.mutate(
      { data: { title: safeTitle, origin: "manual", template, content: empty } },
      {
        onSuccess: draft => {
          const snapshot = JSON.stringify({ title: draft.title, template: draft.template, content: draft.content });
          initializedId.current = draft.id;
          lastSaved.current = snapshot;
          failedSaveKey.current = "";
          setActiveId(draft.id);
          setTitle(draft.title);
          setTemplate(draft.template as ManualTemplate);
          setContent(draft.content);
          setSaveState("saved");
          setNewTitle("مسودة جديدة");
          queryClient.setQueryData<StudentResume[]>(getListStudentResumesQueryKey(), current => [
            draft,
            ...(current ?? []).filter(item => item.id !== draft.id),
          ]);
          void queryClient.invalidateQueries({ queryKey: getListStudentResumesQueryKey() });
        },
        onError: () => setCreateError("تعذّر إنشاء المسودة. حاول مرة أخرى."),
      },
    );
  };

  const createAnother = () => {
    if (activeId && initializedId.current === activeId && title.trim()) saveCurrentDraft();
    setActiveId(null);
    activeIdRef.current = null;
    initializedId.current = null;
    setTitle("");
    setContent(blankContent());
    setTemplate("ats");
    setSaveState("saved");
    setDeleteError("");
    setExportError("");
    setCreateError("");
  };

  const deleteDraft = () => {
    if (!activeDraft || !window.confirm(`هل تريد حذف «${activeDraft.title}»؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    setDeleteError("");
    const removedId = activeDraft.id;
    deleteResume.mutate(
      { id: removedId },
      {
        onSuccess: () => {
          const next = manualResumes.find(item => item.id !== removedId);
          queryClient.setQueryData<StudentResume[]>(getListStudentResumesQueryKey(), current =>
            (current ?? []).filter(item => item.id !== removedId),
          );
          initializedId.current = null;
          lastSaved.current = "";
          if (next) setActiveId(next.id);
          else {
            setActiveId(null);
            activeIdRef.current = null;
            setTitle("");
            setContent(blankContent());
            setSaveState("saved");
          }
          void queryClient.invalidateQueries({ queryKey: getListStudentResumesQueryKey() });
        },
        onError: () => setDeleteError("تعذّر حذف المسودة. حاول مرة أخرى."),
      },
    );
  };

  const updateContent = (updater: (previous: StudentResumeContent) => StudentResumeContent) => {
    setContent(previous => updater(previous));
  };
  const updateAppearance = (patch: Partial<ResumeAppearance>) => updateContent(previous => ({
    ...previous,
    appearance: {
      ...DEFAULT_RESUME_APPEARANCE,
      ...previous.appearance,
      ...patch,
    },
  }));
  const updateEntry = (section: EntrySection, index: number, field: keyof ResumeEntry, value: string) => {
    updateContent(previous => ({
      ...previous,
      [section]: previous[section].map((entry, itemIndex) => itemIndex === index ? { ...entry, [field]: value } : entry),
    }));
  };
  const addEntry = (section: EntrySection) => updateContent(previous =>
    previous[section].length >= entryLimits[section]
      ? previous
      : { ...previous, [section]: [...previous[section], blankEntry()] },
  );
  const removeEntry = (section: EntrySection, index: number) => updateContent(previous => ({
    ...previous,
    [section]: previous[section].filter((_, itemIndex) => itemIndex !== index),
  }));
  const updateList = (section: ListSection, index: number, value: string) => updateContent(previous => ({
    ...previous,
    [section]: previous[section].map((item, itemIndex) => itemIndex === index ? value : item),
  }));
  const addList = (section: ListSection) => updateContent(previous =>
    previous[section].length >= listLimits[section]
      ? previous
      : { ...previous, [section]: [...previous[section], ""] },
  );
  const removeList = (section: ListSection, index: number) => updateContent(previous => ({
    ...previous,
    [section]: previous[section].filter((_, itemIndex) => itemIndex !== index),
  }));

  const retrySave = () => {
    failedSaveKey.current = "";
    saveCurrentDraft();
  };
  const exportWord = async () => {
    setExportError("");
    try {
      await downloadStudentResumeDocx(content, template, title || "سيرتي المهنية");
    } catch {
      setExportError("تعذّر تجهيز ملف Word الآن. حاول مرة أخرى.");
    }
  };

  const renderEntryEditor = (section: EntrySection) => (
    <section className="ats-card" key={section} aria-labelledby={`ats-heading-${section}`} data-testid={`section-editor-${section}`}>
      <div className="ats-card-heading">
        <div><span className="ats-index">{String(entrySections.indexOf(section) + 1).padStart(2, "0")}</span>
          <h3 id={`ats-heading-${section}`}>{sectionLabels[section]}</h3></div>
        <button type="button" className="ats-add" onClick={() => addEntry(section)}
          disabled={content[section].length >= entryLimits[section]} data-testid={`button-add-${section}`}>
          <Plus size={14} /> إضافة
        </button>
      </div>
      {content[section].length === 0 && <p className="ats-empty-note" data-testid={`status-empty-${section}`}>لا توجد عناصر بعد. أضف ما تريد إظهاره في سيرتك.</p>}
      {content[section].length >= entryLimits[section] && <p className="ats-limit" role="status" data-testid={`status-limit-${section}`}>وصلت إلى الحد المسموح لهذا القسم.</p>}
      {content[section].map((entry, index) => (
        <article className="ats-entry-editor" key={`${section}-${index}`} data-testid={`card-editor-${section}-${index}`}>
          <div className="ats-entry-top"><strong>{sectionLabels[section]} {index + 1}</strong>
            <button type="button" className="ats-icon-button" aria-label={`حذف ${sectionLabels[section]} ${index + 1}`}
              onClick={() => removeEntry(section, index)} data-testid={`button-remove-${section}-${index}`}><Trash2 size={14} /></button>
          </div>
          <div className="ats-field-grid">
            {([
              ["title", "المسمى أو المؤهل", 180],
              ["organization", "الجهة", 180],
              ["location", "الموقع", 180],
              ["period", "الفترة", 100],
            ] as const).map(([field, label, maxLength]) => (
              <label className="ats-field" key={field}><span>{label}</span>
                <input value={entry[field]} maxLength={maxLength} onChange={event => updateEntry(section, index, field, event.target.value)}
                  data-testid={`input-${section}-${field}-${index}`} />
              </label>
            ))}
            <label className="ats-field ats-wide"><span>الوصف</span>
              <textarea value={entry.description} maxLength={2000} rows={3}
                onChange={event => updateEntry(section, index, "description", event.target.value)}
                data-testid={`input-${section}-description-${index}`} />
            </label>
            <label className="ats-field ats-wide"><span>الرابط، إن وجد</span>
              <input value={entry.link} maxLength={400} dir="ltr"
                onChange={event => updateEntry(section, index, "link", event.target.value)}
                data-testid={`input-${section}-link-${index}`} />
            </label>
          </div>
        </article>
      ))}
    </section>
  );

  const renderListEditor = (section: ListSection) => (
    <section className="ats-card" key={section} aria-labelledby={`ats-heading-${section}`} data-testid={`section-editor-${section}`}>
      <div className="ats-card-heading">
        <div><span className="ats-index">{String(entrySections.length + listSections.indexOf(section) + 1).padStart(2, "0")}</span>
          <h3 id={`ats-heading-${section}`}>{sectionLabels[section]}</h3></div>
        <button type="button" className="ats-add" onClick={() => addList(section)}
          disabled={content[section].length >= listLimits[section]} data-testid={`button-add-${section}`}>
          <Plus size={14} /> إضافة
        </button>
      </div>
      {content[section].length === 0 && <p className="ats-empty-note" data-testid={`status-empty-${section}`}>أضف العناصر التي تنطبق عليك فقط.</p>}
      {content[section].length >= listLimits[section] && <p className="ats-limit" role="status" data-testid={`status-limit-${section}`}>وصلت إلى الحد المسموح لهذا القسم.</p>}
      <div className="ats-string-list">
        {content[section].map((item, index) => (
          <div className="ats-string-row" key={`${section}-${index}`} data-testid={`row-editor-${section}-${index}`}>
            <input aria-label={`${sectionLabels[section]} ${index + 1}`} value={item} maxLength={listItemLimits[section]}
              onChange={event => updateList(section, index, event.target.value)} data-testid={`input-${section}-${index}`} />
            <button type="button" className="ats-icon-button" aria-label={`حذف ${sectionLabels[section]} ${index + 1}`}
              onClick={() => removeList(section, index)} data-testid={`button-remove-${section}-${index}`}><X size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  );

  const renderPreviewSection = (section: EntrySection | ListSection, index: number) => {
    const label = template === "ats" ? atsSectionLabels[section] : sectionLabels[section];
    if (section === "skills" || section === "certifications" || section === "languages") {
      const items = content[section].map(value => value.trim()).filter(Boolean);
      if (!items.length) return null;
      return (
        <section className="ats-paper-section" key={section} data-testid={`section-preview-${section}`}>
          <h3>{template !== "ats" && <span>{String(index + 1).padStart(2, "0")}</span>}{label}</h3>
          <ul className="ats-paper-chips" data-testid={`list-preview-${section}`}>
            {items.map((item, itemIndex) => <li key={`${section}-${itemIndex}`} data-testid={`text-preview-${section}-${itemIndex}`}>{item}</li>)}
          </ul>
        </section>
      );
    }
    const entries = content[section].filter(entry =>
      [entry.title, entry.organization, entry.location, entry.period, entry.description, entry.link].some(Boolean),
    );
    if (!entries.length) return null;
    return (
      <section className="ats-paper-section" key={section} data-testid={`section-preview-${section}`}>
          <h3>{template !== "ats" && <span>{String(index + 1).padStart(2, "0")}</span>}{label}</h3>
        <div className="ats-paper-entries">{entries.map((entry, entryIndex) => (
          <article className="ats-paper-entry" key={`${section}-${entryIndex}`} data-testid={`card-preview-${section}-${entryIndex}`}>
            <div className="ats-paper-entry-top"><h4>{entry.title}</h4><time>{entry.period}</time></div>
            {[entry.organization, entry.location].filter(Boolean).length > 0 &&
              <p className="ats-paper-meta">{[entry.organization, entry.location].filter(Boolean).join(" · ")}</p>}
            {entry.description && <p className="ats-paper-desc">{entry.description}</p>}
            {entry.link && <p className="ats-paper-meta" dir="ltr">{entry.link}</p>}
          </article>
        ))}</div>
      </section>
    );
  };

  const renderPaper = () => {
    const sectionOrder: (EntrySection | ListSection)[] = template === "ats" ? [
      "experience", "education", "projects", "skills", "certifications", "courses", "languages",
    ] : [
      "education", "experience", "projects", "courses", "skills", "certifications", "languages",
    ];
    const summaryHeading = template === "ats" ? "PROFESSIONAL SUMMARY | الملخص المهني" : "الملخص المهني";
    const appearance = content.appearance ?? DEFAULT_RESUME_APPEARANCE;
    const paperStyle: CSSProperties & {
      "--resume-page-color": string;
      "--resume-text-color": string;
      "--resume-heading-color": string;
      "--resume-accent-color": string;
      "--resume-font-family": string;
    } = {
      "--resume-page-color": appearance.pageColor,
      "--resume-text-color": appearance.textColor,
      "--resume-heading-color": appearance.headingColor,
      "--resume-accent-color": appearance.accentColor,
      "--resume-font-family": RESUME_FONT_STACKS[appearance.fontFamily],
    };
    return (
      <article className={`ats-paper ats-${template} ats-customized`} dir={template === "ats" ? "auto" : "rtl"} style={paperStyle} data-testid="section-resume-preview">
        <header className="ats-paper-header">
          <div className="ats-paper-identity">
            {template !== "ats" && <span className="ats-doc-label">السيرة الذاتية</span>}
            <h2 data-testid="text-resume-name">{content.fullName || "اسمك"}</h2>
            {content.headline && <p className="ats-paper-headline" data-testid="text-resume-headline">{content.headline}</p>}
            {[content.email, content.phone, content.location, content.linkedin, content.website].some(Boolean) &&
              <div className="ats-paper-contact" data-testid="text-resume-contact">
                {[content.email, content.phone, content.location, content.linkedin, content.website].filter(Boolean).map((value, index) =>
                  <span key={`contact-${index}`} dir={index === 0 || index > 2 ? "ltr" : undefined}>{value}</span>,
                )}
              </div>}
          </div>
          {template !== "ats" && content.fullName && <div className="ats-paper-mark" aria-hidden="true">{content.fullName.trim().slice(0, 1)}</div>}
        </header>
        {template === "sidebar" ? (
          <>
            <div className="ats-sidebar-main">
              {content.summary && <section className="ats-paper-section"><h3><span>01</span>الملخص المهني</h3><p className="ats-paper-summary" data-testid="text-preview-summary">{content.summary}</p></section>}
              {sectionOrder.slice(0, 4).map((section, index) => renderPreviewSection(section, index + (content.summary ? 1 : 0)))}
            </div>
            <aside className="ats-sidebar-aside" aria-label="معلومات إضافية">
              {sectionOrder.slice(4).map((section, index) => renderPreviewSection(section, index + 5))}
            </aside>
          </>
        ) : (
          <>
            {content.summary && <section className="ats-paper-section"><h3>{template !== "ats" && <span>01</span>}{summaryHeading}</h3><p className="ats-paper-summary" data-testid="text-preview-summary">{content.summary}</p></section>}
            {sectionOrder.map((section, index) => renderPreviewSection(section, index + (content.summary ? 1 : 0)))}
          </>
        )}
        {template !== "ats" && <footer className="ats-paper-foot"><img src={`${import.meta.env.BASE_URL}athar-wordmark-3d.png`} alt="أثر" /></footer>}
      </article>
    );
  };

  return (
    <main className="ats-studio" dir="rtl" data-testid="section-resume-template-studio">
      <header className="ats-top ats-studio-tools">
        <div className="ats-heading">
          <div className="ats-brand"><img src={`${import.meta.env.BASE_URL}athar-wordmark-3d.png`} alt="أثر" data-testid="img-template-studio-logo" />
            <span>مساحة السيرة الذاتية</span></div>
          <h1>اختر تصميمك، واكتب سيرتك</h1>
          <p>مساحة مستقلة تكتب فيها كل تفصيل بنفسك. لا تُضاف بيانات تلقائياً ولا تُشارك السيرة.</p>
        </div>
        {activeId && <div className="ats-toolbar" aria-label="خيارات التصدير">
          <button type="button" className="ats-button ats-secondary" onClick={() => window.print()} data-testid="button-template-print">
            <Printer size={16} /><span>طباعة أو PDF</span>
          </button>
          <button type="button" className="ats-button ats-primary" onClick={exportWord} data-testid="button-template-word">
            <ArrowDownToLine size={16} /><span>تنزيل Word</span>
          </button>
        </div>}
      </header>

      <section className="ats-shelf ats-studio-tools" aria-label="مسودات السيرة الخاصة">
        <div className="ats-shelf-head">
          <div><span className="ats-eyebrow">مسوداتك الخاصة</span><h2>سير منفصلة عن مساحة الكتابة الموجّهة</h2></div>
          {activeId && <button type="button" className="ats-button ats-primary" onClick={createAnother}
            disabled={updateResume.isPending}
            data-testid="button-new-manual-resume"><Plus size={15} /> مسودة جديدة</button>}
        </div>
        {resumesQuery.isLoading ? <div className="ats-loading" role="status" data-testid="status-manual-resumes-loading">
          <span /><span /><span /> جارٍ تحميل المسودات
        </div> : resumesQuery.isError ? (
          <div className="ats-error" role="alert" data-testid="status-manual-resumes-error">
            <AlertCircle size={16} /><span>تعذّر تحميل المسودات.</span>
            <button type="button" onClick={() => void resumesQuery.refetch()} data-testid="button-retry-manual-resumes">إعادة المحاولة</button>
          </div>
        ) : manualResumes.length ? (
          <div className="ats-drafts" data-testid="list-manual-resumes">
            {manualResumes.map(draft => (
          <button type="button" key={draft.id} className={`ats-draft ${activeId === draft.id ? "is-active" : ""}`}
                onClick={() => chooseDraft(draft)} disabled={updateResume.isPending}
                aria-pressed={activeId === draft.id} data-testid={`button-select-manual-${draft.id}`}>
                <FileText size={16} />
                <span><strong>{draft.title}</strong><small>{formatDate(draft.updatedAt)} · {templateLabels[draft.template as ManualTemplate]?.title ?? "قالب"}</small></span>
                {activeId === draft.id && <Check size={15} />}
              </button>
            ))}
          </div>
        ) : <div className="ats-draft-empty" data-testid="status-manual-resumes-empty">
          <Layers2 size={18} /><span>لا توجد مسودات يدوية بعد. ابدأ بسيرة فارغة واختر نموذجاً.</span>
        </div>}
        {createError && <p className="ats-inline-error" role="alert" data-testid="status-create-manual-error">{createError}</p>}
      </section>

      {!resumesQuery.isLoading && !resumesQuery.isError && !activeId && (
        <section className="ats-create-panel ats-studio-tools" data-testid="section-create-manual-resume">
          <div className="ats-create-mark"><Layers2 size={25} /></div>
          <div><span className="ats-eyebrow">بداية من صفحة فارغة</span>
            <h2>المحتوى يبدأ منك</h2>
            <p>لا نستورد الاسم أو الخبرات أو الدورات. أضف فقط المعلومات التي تريدها، ويمكنك إنشاء أكثر من مسودة خاصة.</p>
          </div>
          <div className="ats-create-controls">
            <div>
              <label className="ats-field"><span>عنوان المسودة</span>
                <input value={newTitle} maxLength={120} onChange={event => setNewTitle(event.target.value)}
                  data-testid="input-new-manual-title" />
              </label>
              <div className="ats-template-picks" role="group" aria-label="اختر نموذج السيرة">
                {(Object.keys(templateLabels) as ManualTemplate[]).map(option => (
                  <button type="button" key={option} className={`ats-template-pick ${template === option ? "is-selected" : ""}`}
                    onClick={() => setTemplate(option)} aria-pressed={template === option} data-testid={`button-template-${option}`}>
                    <strong>{templateLabels[option].title}</strong><small>{templateLabels[option].description}</small>
                  </button>
                ))}
              </div>
              {template === "ats" && <p className="ats-template-guidance">تنسيق أحادي العمود بعناوين قياسية. اكتب خبراتك الحقيقية وراجع الملف؛ توافق ATS لا يضمن اجتياز كل نظام فرز.</p>}
            </div>
            <button type="button" className="ats-button ats-primary" onClick={createDraft} disabled={createResume.isPending}
              data-testid="button-create-manual-resume">
              {createResume.isPending ? <LoaderCircle size={15} /> : <Plus size={15} />}
              {createResume.isPending ? "يجري إنشاء المسودة" : "إنشاء سيرة فارغة"}
            </button>
          </div>
        </section>
      )}

      {activeId && activeDraft && (
        <div className="ats-workspace">
          <div className="ats-edit-column ats-studio-tools">
            <section className="ats-card ats-identity-card" aria-labelledby="ats-identity-title">
              <div className="ats-card-heading"><div><span className="ats-index">00</span><h2 id="ats-identity-title">عنوان السيرة والبيانات الأساسية</h2></div></div>
              <label className="ats-field"><span>عنوان المسودة</span>
                <input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} data-testid="input-manual-title" />
              </label>
              {!title.trim() && <p className="ats-inline-error" role="status" data-testid="status-title-required">أضف عنواناً لحفظ المسودة.</p>}
              <div className="ats-template-picks ats-template-current" role="group" aria-label="نموذج السيرة">
                {(Object.keys(templateLabels) as ManualTemplate[]).map(option => (
                  <button type="button" key={option} className={`ats-template-pick ${template === option ? "is-selected" : ""}`}
                    onClick={() => setTemplate(option)} aria-pressed={template === option} data-testid={`button-active-template-${option}`}>
                    <strong>{templateLabels[option].title}</strong><small>{templateLabels[option].description}</small>
                  </button>
                ))}
              </div>
              {template === "ats" && <p className="ats-template-guidance">تنسيق أحادي العمود بعناوين قياسية. اكتب خبراتك الحقيقية وراجع الملف؛ توافق ATS لا يضمن اجتياز كل نظام فرز.</p>}
              <div className="ats-save-line" role="status" data-testid="status-manual-save">
                {saveState === "saved" ? <Check size={14} /> : saveState === "error" ? <AlertCircle size={14} /> : saveState === "saving" ? <LoaderCircle size={14} /> : <Save size={14} />}
                <span>{saveState === "saved" ? "تم حفظ التغييرات" :
                  saveState === "pending" ? "تغييرات بانتظار الحفظ…" :
                    saveState === "saving" ? "جارٍ حفظ التغييرات…" :
                      saveState === "error" ? "تعذّر الحفظ." : "أضف عنواناً لحفظ التغييرات."}</span>
                {saveState === "error" && <button type="button" onClick={retrySave} disabled={updateResume.isPending}
                  data-testid="button-retry-manual-save">إعادة المحاولة</button>}
              </div>
              <div className="ats-readiness" data-testid="section-manual-readiness">
                <div className="ats-readiness-top"><span>اكتمال المحتوى — على هذا الجهاز</span>
                  <strong data-testid="text-manual-readiness">{readiness.score}%</strong></div>
                <div className="ats-readiness-track" aria-hidden="true"><span style={{ width: `${readiness.score}%` }} /></div>
                <p>{readiness.completed} من {readiness.total} نقاط أساسية مكتملة</p>
              </div>
            </section>

            <section className="ats-card ats-appearance-card" aria-labelledby="ats-appearance-title" data-testid="section-resume-appearance">
              <div className="ats-card-heading">
                <div><span className="ats-index">02</span><h3 id="ats-appearance-title">الخطوط والألوان</h3></div>
                <button type="button" className="ats-appearance-reset" onClick={() => updateAppearance(DEFAULT_RESUME_APPEARANCE)} data-testid="button-reset-resume-appearance">
                  استعادة الافتراضي
                </button>
              </div>
              <div className="ats-appearance-grid">
                <label className="ats-field">
                  <span>نوع الخط</span>
                  <select value={content.appearance?.fontFamily ?? DEFAULT_RESUME_APPEARANCE.fontFamily}
                    onChange={event => updateAppearance({ fontFamily: event.target.value as ResumeFontFamily })}
                    data-testid="select-resume-font">
                    {(Object.keys(RESUME_FONT_LABELS) as ResumeFontFamily[]).map(font => <option value={font} key={font}>{RESUME_FONT_LABELS[font]}</option>)}
                  </select>
                </label>
                <div className="ats-appearance-colors">
                  {([
                    ["pageColor", "لون خلفية الصفحة"],
                    ["textColor", "لون النص"],
                    ["headingColor", "لون العناوين"],
                    ["accentColor", "لون التمييز"],
                  ] as const).map(([key, label]) => <label className="ats-color-field" key={key}>
                    <span>{label}</span>
                    <span className="ats-color-input-wrap">
                      <input type="color" value={content.appearance?.[key] ?? DEFAULT_RESUME_APPEARANCE[key]}
                        aria-label={label} onChange={event => updateAppearance({ [key]: event.target.value })}
                        data-testid={`input-resume-${key}`}/>
                      <code>{content.appearance?.[key] ?? DEFAULT_RESUME_APPEARANCE[key]}</code>
                    </span>
                  </label>)}
                </div>
              </div>
              <div className="ats-appearance-presets" role="group" aria-label="ألوان جاهزة">
                <span>ألوان جاهزة</span>
                {RESUME_COLOR_PRESETS.map(preset => <button type="button" key={preset.label} onClick={() => updateAppearance(preset.appearance)} data-testid={`button-resume-preset-${preset.label}`}>
                  <i style={{ backgroundColor: preset.appearance.accentColor }} aria-hidden="true"/>
                  {preset.label}
                </button>)}
              </div>
              {colorContrastRatio(content.appearance?.textColor ?? DEFAULT_RESUME_APPEARANCE.textColor, content.appearance?.pageColor ?? DEFAULT_RESUME_APPEARANCE.pageColor) < 4.5
                || colorContrastRatio(content.appearance?.headingColor ?? DEFAULT_RESUME_APPEARANCE.headingColor, content.appearance?.pageColor ?? DEFAULT_RESUME_APPEARANCE.pageColor) < 3
                ? <p className="ats-appearance-warning" role="status">التباين منخفض وقد يصعب قراءة السيرة؛ اختر لونًا أوضح قبل التصدير.</p>
                : <p className="ats-appearance-hint">تظهر تغييراتك مباشرة في المعاينة، وتُحفظ مع هذه المسودة.</p>}
            </section>

            <section className="ats-card" aria-labelledby="ats-contact-title" data-testid="section-editor-contact">
              <div className="ats-card-heading"><div><span className="ats-index">01</span><h3 id="ats-contact-title">التعريف والتواصل</h3></div></div>
              <div className="ats-field-grid">
                {([
                  ["fullName", "الاسم الكامل", 120],
                  ["headline", "المسمى أو المجال", 240],
                  ["email", "البريد الإلكتروني", 200],
                  ["phone", "رقم التواصل", 60],
                  ["location", "الموقع", 160],
                  ["linkedin", "LinkedIn", 400],
                  ["website", "الموقع الإلكتروني", 400],
                ] as const).map(([field, label, maxLength]) => (
                  <label className="ats-field" key={field}><span>{label}</span>
                    <input value={content[field]} maxLength={maxLength} dir={["email", "phone", "linkedin", "website"].includes(field) ? "ltr" : undefined}
                      onChange={event => updateContent(previous => ({ ...previous, [field]: event.target.value }))}
                      data-testid={`input-manual-${field}`} />
                  </label>
                ))}
                <label className="ats-field ats-wide"><span>الملخص المهني</span>
                  <textarea value={content.summary} maxLength={2000} rows={4}
                    onChange={event => updateContent(previous => ({ ...previous, summary: event.target.value }))}
                    data-testid="input-manual-summary" />
                </label>
              </div>
            </section>

            {entrySections.map(renderEntryEditor)}
            {listSections.map(renderListEditor)}
            <div className="ats-delete-row">
              <button type="button" className="ats-button ats-danger-button" onClick={deleteDraft}
                disabled={deleteResume.isPending || updateResume.isPending}
                data-testid="button-delete-manual-resume">
                {deleteResume.isPending ? <LoaderCircle size={15} /> : <Trash2 size={15} />} حذف هذه المسودة
              </button>
            </div>
            {deleteError && <p className="ats-inline-error" role="alert" data-testid="status-delete-manual-error">{deleteError}</p>}
            {exportError && <p className="ats-export-error" role="alert" data-testid="status-manual-export-error">{exportError}</p>}
          </div>

          <section className="ats-preview-column" aria-label="معاينة السيرة">
            <div className="ats-preview-caption ats-studio-tools"><span className="ats-live-dot" />معاينة مباشرة
              <span data-testid="text-manual-updated">{activeDraft ? `آخر حفظ ${formatDate(activeDraft.updatedAt)}` : "مسودة جديدة"}</span>
            </div>
            {renderPaper()}
          </section>
        </div>
      )}
    </main>
  );
}
