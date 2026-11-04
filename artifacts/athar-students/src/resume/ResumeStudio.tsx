import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Achievement, LearningItem, StudentProfile, StudentResume, StudentResumeContent } from "@workspace/api-client-react";
import {
  useCreateStudentResume,
  useDeleteStudentResume,
  useListStudentResumes,
  useRewriteResumeText,
  useUpdateStudentResume,
  getListStudentResumesQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowDownToLine, ArrowUpLeft, Check, CircleAlert, FileText, LoaderCircle, Plus, Printer,
  ScanSearch, Sparkles, Trash2, X,
} from "lucide-react";
import { Link } from "wouter";
import { analyzeStudentResumeAts, buildStudentResumeText, createStudentResumeContent, scoreStudentResume } from "./resume-document";
import { downloadStudentResumeDocx } from "./resume-export";
import { NamedColorPicker } from "../components/NamedColorPicker";
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
import "./resume-studio.css";

type ResumeTemplate = "ats" | "professional";
type EntrySection = "education" | "experience" | "projects" | "courses";
type TextSection = "skills" | "certifications" | "languages";
type ResumeEntry = StudentResumeContent[EntrySection][number];
type RewriteTarget = { section: EntrySection | "summary"; index?: number };
type RewriteSuggestion = { text: string; draftId: string; target: RewriteTarget; source: string; targetRole: string };

type ResumeStudioProps = {
  profile: StudentProfile | null;
  achievements: Achievement[];
  courses: LearningItem[];
};

const sectionTitles: Record<EntrySection | TextSection, string> = {
  education: "التعليم", experience: "الخبرات", projects: "المشروعات", courses: "الدورات",
  skills: "المهارات", certifications: "الشهادات", languages: "اللغات",
};
const entryLimits: Record<EntrySection, number> = { education: 20, experience: 30, projects: 30, courses: 30 };
const textLimits: Record<TextSection, number> = { skills: 60, certifications: 30, languages: 20 };
const aiPrivacyNote = "عند النقر، يُعالج النص المحدد والمسمى المهني بواسطة مساعد ذكاء اصطناعي. لا يُرسل وصف الوظيفة، ولا يُضاف الاقتراح إلى سيرتك إلا إذا قبلته.";
const emptyEntry = (): ResumeEntry => ({ title: "", organization: "", location: "", period: "", description: "", link: "" });
const getSourceText = (content: StudentResumeContent, target: RewriteTarget) =>
  target.section === "summary" ? content.summary : content[target.section][target.index ?? -1]?.description ?? "";
const formatDate = (value: string) => value
  ? new Intl.DateTimeFormat("ar", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
  : "مسودة جديدة";

function ResumeStudio({ profile, achievements, courses }: ResumeStudioProps) {
  const queryClient = useQueryClient();
  const resumesQuery = useListStudentResumes({ query: { queryKey: getListStudentResumesQueryKey() } });
  const createResume = useCreateStudentResume();
  const updateResume = useUpdateStudentResume();
  const deleteResume = useDeleteStudentResume();
  const rewriteText = useRewriteResumeText();
  const resumes = useMemo(
    () => (resumesQuery.data ?? []).filter(resume => resume.origin === "guided"),
    [resumesQuery.data],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<ResumeTemplate>("ats");
  const [content, setContent] = useState<StudentResumeContent>(() =>
    withResumeAppearance(createStudentResumeContent(profile, achievements, courses)));
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeStudentResumeAts> | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const [rewriteSuggestion, setRewriteSuggestion] = useState<RewriteSuggestion | null>(null);
  const [rewriteError, setRewriteError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const initializedDraft = useRef<string | null>(null);
  const lastSaved = useRef("");
  const failedSaveKey = useRef("");
  const rewriteRequestId = useRef(0);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const contentRef = useRef(content);
  contentRef.current = content;
  const updateMutationRef = useRef(updateResume.mutate);
  updateMutationRef.current = updateResume.mutate;

  const activeDraft = resumes.find(resume => resume.id === activeId);
  const readiness = useMemo(() => scoreStudentResume(content), [content]);
  const resumeText = useMemo(() => buildStudentResumeText(content), [content]);
  const appearance = content.appearance ?? DEFAULT_RESUME_APPEARANCE;
  const resumePaperStyle: CSSProperties & {
    "--resume-page-color": string;
    "--resume-text-color": string;
    "--resume-heading-color": string;
    "--resume-accent-color": string;
    "--resume-font-family": string;
    "--resume-font-size": string;
  } = {
    "--resume-page-color": appearance.pageColor,
    "--resume-text-color": appearance.textColor,
    "--resume-heading-color": appearance.headingColor,
    "--resume-accent-color": appearance.accentColor,
    "--resume-font-family": RESUME_FONT_STACKS[appearance.fontFamily],
    "--resume-font-size": `${appearance.fontSize ?? 11}pt`,
  };
  const hasDraft = Boolean(activeId);
  const suggestionIsCurrent = Boolean(rewriteSuggestion && rewriteSuggestion.draftId === activeId &&
    content.headline.trim() === rewriteSuggestion.targetRole &&
    getSourceText(content, rewriteSuggestion.target) === rewriteSuggestion.source);

  useEffect(() => {
    if (rewriteSuggestion && !suggestionIsCurrent) setRewriteSuggestion(null);
  }, [rewriteSuggestion, suggestionIsCurrent]);

  useEffect(() => {
    if (!resumes.length) {
      if (!resumesQuery.isLoading && !activeId && !initializedDraft.current) {
        initializedDraft.current = "starter";
        setContent(withResumeAppearance(createStudentResumeContent(profile, achievements, courses)));
        setTitle("سيرتي المهنية");
        setTemplate("ats");
      }
      return;
    }
    if (!activeId) {
      setActiveId(resumes[0].id);
      return;
    }
    const selected = resumes.find(item => item.id === activeId);
    if (selected && initializedDraft.current !== selected.id) {
      initializedDraft.current = selected.id;
      setTitle(selected.title);
      setTemplate(selected.template === "professional" ? "professional" : "ats");
      const normalizedContent = withResumeAppearance(selected.content);
      setContent(normalizedContent);
      lastSaved.current = JSON.stringify({ title: selected.title, template: selected.template, content: normalizedContent });
    }
  }, [resumes, resumesQuery.isLoading, activeId, profile, achievements, courses]);

  const saveCurrentDraft = useCallback(() => {
    if (!activeId || !title.trim()) return;
    const saveId = activeId;
    const snapshot = { title: title.trim(), template, content };
    const snapshotKey = JSON.stringify(snapshot);
    const failureKey = JSON.stringify([saveId, snapshotKey]);
    failedSaveKey.current = "";
    updateMutationRef.current(
      { id: saveId, data: { ...snapshot, origin: "guided" } },
      {
        onSuccess: () => {
          if (activeIdRef.current === saveId) lastSaved.current = snapshotKey;
          if (failedSaveKey.current === failureKey) failedSaveKey.current = "";
          void queryClient.invalidateQueries({ queryKey: getListStudentResumesQueryKey() });
        },
        onError: () => {
          if (activeIdRef.current === saveId) failedSaveKey.current = failureKey;
        },
      },
    );
  }, [activeId, title, template, content, queryClient]);

  useEffect(() => {
    if (!activeId || initializedDraft.current !== activeId || updateResume.isPending) return;
    const nextKey = JSON.stringify({ title, template, content });
    if (nextKey === lastSaved.current || failedSaveKey.current === JSON.stringify([activeId, nextKey]) || !title.trim()) return;
    const timer = window.setTimeout(saveCurrentDraft, 650);
    return () => window.clearTimeout(timer);
  }, [activeId, title, template, content, updateResume.isPending, saveCurrentDraft]);

  const updateContent = (updater: (previous: StudentResumeContent) => StudentResumeContent) => {
    setContent(previous => updater(previous));
  };
  const updateAppearance = (patch: Partial<ResumeAppearance>) => updateContent(previous => ({
    ...previous,
    appearance: { ...DEFAULT_RESUME_APPEARANCE, ...previous.appearance, ...patch },
  }));

  const createStarter = () => {
    const starter = withResumeAppearance(createStudentResumeContent(profile, achievements, courses));
    const draftTitle = "سيرتي المهنية";
    createResume.mutate(
      { data: { title: draftTitle, origin: "guided", template: "ats", content: starter } },
      {
        onSuccess: draft => {
          initializedDraft.current = draft.id;
          lastSaved.current = JSON.stringify({ title: draft.title, template: draft.template, content: draft.content });
          setActiveId(draft.id);
          setTitle(draft.title);
          setTemplate(draft.template === "professional" ? "professional" : "ats");
          setContent(draft.content);
          queryClient.setQueryData<StudentResume[]>(getListStudentResumesQueryKey(), current => [
            draft,
            ...(current ?? []).filter(item => item.id !== draft.id),
          ]);
          void queryClient.invalidateQueries({ queryKey: getListStudentResumesQueryKey() });
        },
      },
    );
  };

  const chooseDraft = (draft: StudentResume) => {
    if (draft.id === activeId) return;
    initializedDraft.current = null;
    rewriteRequestId.current += 1;
    setActiveId(draft.id);
    setRewriteSuggestion(null);
  };

  const removeDraft = () => {
    if (!activeDraft || !window.confirm(`هل تريد حذف «${activeDraft.title}»؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    rewriteRequestId.current += 1;
    setRewriteSuggestion(null);
    setDeleteError("");
    deleteResume.mutate({ id: activeDraft.id }, {
      onSuccess: () => {
        const next = resumes.find(item => item.id !== activeDraft.id);
        queryClient.setQueryData<StudentResume[]>(getListStudentResumesQueryKey(), current =>
          (current ?? []).filter(item => item.id !== activeDraft.id),
        );
        initializedDraft.current = null;
        lastSaved.current = "";
        if (next) setActiveId(next.id);
        else {
          setActiveId(null);
          setTitle("");
          setContent(createStudentResumeContent(profile, achievements, courses));
        }
        void queryClient.invalidateQueries({ queryKey: getListStudentResumesQueryKey() });
      },
      onError: () => setDeleteError("تعذّر حذف المسودة. حاول مرة أخرى."),
    });
  };

  const analyze = () => {
    if (!jobDescription.trim()) {
      setAnalysis(null);
      setAnalysisMessage("أدخل وصف الوظيفة أولاً لبدء المقارنة.");
      return;
    }
    setAnalysis(analyzeStudentResumeAts(content, jobDescription));
    setAnalysisMessage("");
  };

  const handleDocxExport = async () => {
    setExportError("");
    try {
      await downloadStudentResumeDocx(content, template, title || "سيرتي المهنية");
    } catch {
      setExportError("تعذّر تجهيز ملف Word الآن. حاول مرة أخرى.");
    }
  };

  const requestRewrite = (target: RewriteTarget, source: string) => {
    if (!source.trim()) {
      setRewriteError("أضف نصاً أولاً حتى نتمكن من اقتراح صياغة.");
      setRewriteSuggestion(null);
      return;
    }
    const requestId = ++rewriteRequestId.current;
    const draftId = activeId;
    const targetRole = content.headline.trim();
    setRewriteSuggestion(null);
    setRewriteError("");
    rewriteText.mutate(
      { data: { mode: target.section === "summary" ? "summary" : "bullet", sourceText: source, targetRole } },
      {
        onSuccess: result => {
          if (requestId !== rewriteRequestId.current || !draftId || activeIdRef.current !== draftId ||
            contentRef.current.headline.trim() !== targetRole || getSourceText(contentRef.current, target) !== source) return;
          setRewriteSuggestion({ text: result.suggestion, draftId, target, source, targetRole });
        },
        onError: () => {
          if (requestId === rewriteRequestId.current && activeIdRef.current === draftId &&
            getSourceText(contentRef.current, target) === source) {
            setRewriteError("تعذّر إعداد الاقتراح. يمكنك المحاولة مجدداً.");
          }
        },
      },
    );
  };

  const applyRewrite = () => {
    if (!rewriteSuggestion || !suggestionIsCurrent || rewriteSuggestion.draftId !== activeId ||
      content.headline.trim() !== rewriteSuggestion.targetRole ||
      getSourceText(content, rewriteSuggestion.target) !== rewriteSuggestion.source) {
      setRewriteSuggestion(null);
      return;
    }
    if (rewriteSuggestion.target.section === "summary") {
      updateContent(previous => ({ ...previous, summary: rewriteSuggestion.text }));
    } else if (typeof rewriteSuggestion.target.index === "number") {
      const section = rewriteSuggestion.target.section;
      updateContent(previous => ({
        ...previous,
        [section]: previous[section].map((entry, index) =>
          index === rewriteSuggestion.target.index ? { ...entry, description: rewriteSuggestion.text } : entry,
        ),
      }));
    }
    setRewriteSuggestion(null);
  };

  const updateEntry = (section: EntrySection, index: number, field: keyof ResumeEntry, value: string) => {
    updateContent(previous => ({
      ...previous,
      [section]: previous[section].map((entry, itemIndex) => itemIndex === index ? { ...entry, [field]: value } : entry),
    }));
  };
  const addEntry = (section: EntrySection) => updateContent(previous => previous[section].length >= entryLimits[section]
    ? previous
    : ({ ...previous, [section]: [...previous[section], emptyEntry()] }));
  const removeEntry = (section: EntrySection, index: number) => updateContent(previous => ({
    ...previous, [section]: previous[section].filter((_, itemIndex) => itemIndex !== index),
  }));
  const updateListItem = (section: TextSection, index: number, value: string) => updateContent(previous => ({
    ...previous, [section]: previous[section].map((item, itemIndex) => itemIndex === index ? value : item),
  }));
  const addListItem = (section: TextSection) => updateContent(previous => previous[section].length >= textLimits[section]
    ? previous
    : ({ ...previous, [section]: [...previous[section], ""] }));
  const removeListItem = (section: TextSection, index: number) => updateContent(previous => ({
    ...previous, [section]: previous[section].filter((_, itemIndex) => itemIndex !== index),
  }));

  const renderEntryEditors = (section: EntrySection) => (
    <section className="rs-editor-section" aria-labelledby={`heading-editor-${section}`} key={section}>
      <div className="rs-editor-section-head">
        <div><span className="rs-section-index">{String(["education", "experience", "projects", "courses"].indexOf(section) + 1).padStart(2, "0")}</span>
          <h3 id={`heading-editor-${section}`}>{sectionTitles[section]}</h3></div>
        <button type="button" className="rs-add-entry" onClick={() => addEntry(section)} disabled={content[section].length >= entryLimits[section]} data-testid={`button-add-${section}`}><Plus size={15} /> إضافة</button>
      </div>
      {content[section].length === 0 && <p className="rs-editor-empty" data-testid={`status-empty-${section}`}>لا توجد عناصر بعد. أضف تجربة حقيقية لتظهر في سيرتك.</p>}
      {content[section].length >= entryLimits[section] && <p className="rs-limit-note" role="status" data-testid={`status-limit-${section}`}>وصلت إلى الحد المسموح لهذا القسم.</p>}
      {content[section].map((entry, index) => (
        <article className="rs-entry-editor" key={`${section}-${index}`} data-testid={`card-editor-${section}-${index}`}>
          <div className="rs-entry-editor-top">
            <strong>{sectionTitles[section]} {index + 1}</strong>
            <button type="button" className="rs-icon-button rs-danger" aria-label={`حذف ${sectionTitles[section]} ${index + 1}`} onClick={() => removeEntry(section, index)} data-testid={`button-remove-${section}-${index}`}><Trash2 size={15} /></button>
          </div>
          <div className="rs-field-grid">
            {([
              ["title", "المسمى أو المؤهل"], ["organization", "الجهة"], ["location", "الموقع"], ["period", "الفترة"],
            ] as const).map(([field, label]) => (
              <label className="rs-field" key={field}><span>{label}</span>
                <input value={entry[field]} maxLength={field === "period" ? 100 : 180} onChange={event => updateEntry(section, index, field, event.target.value)} data-testid={`input-${section}-${field}-${index}`} />
              </label>
            ))}
            <label className="rs-field rs-field-wide"><span>الوصف والنتيجة</span>
              <textarea value={entry.description} maxLength={2000} rows={3} onChange={event => updateEntry(section, index, "description", event.target.value)} data-testid={`input-${section}-description-${index}`} />
            </label>
            <label className="rs-field rs-field-wide"><span>{section === "projects" ? "رابط المشروع، إن وجد" : "رابط ذو صلة، إن وجد"}</span>
              <input value={entry.link} maxLength={400} dir="ltr" onChange={event => updateEntry(section, index, "link", event.target.value)} data-testid={`input-${section}-link-${index}`} />
            </label>
          </div>
                <p className="rs-ai-privacy-note" data-testid={`text-rewrite-privacy-${section}-${index}`}>{aiPrivacyNote}</p>
          <button type="button" className="rs-rewrite-trigger" onClick={() => requestRewrite({ section, index }, entry.description)} disabled={rewriteText.isPending} data-testid={`button-rewrite-${section}-${index}`}>
            <Sparkles size={14} /> تحسين صياغة الوصف
          </button>
        </article>
      ))}
    </section>
  );

  const renderStringEditors = (section: TextSection) => (
    <section className="rs-editor-section" aria-labelledby={`heading-editor-${section}`} key={section}>
      <div className="rs-editor-section-head">
        <div><span className="rs-section-index">{section === "skills" ? "05" : section === "certifications" ? "06" : "07"}</span><h3 id={`heading-editor-${section}`}>{sectionTitles[section]}</h3></div>
        <button type="button" className="rs-add-entry" onClick={() => addListItem(section)} disabled={content[section].length >= textLimits[section]} data-testid={`button-add-${section}`}><Plus size={15} /> إضافة</button>
      </div>
      {content[section].length === 0 && <p className="rs-editor-empty">أضف ما ينطبق عليك فقط.</p>}
      {content[section].length >= textLimits[section] && <p className="rs-limit-note" role="status" data-testid={`status-limit-${section}`}>وصلت إلى الحد المسموح لهذا القسم.</p>}
      <div className="rs-string-list">
        {content[section].map((item, index) => <div className="rs-string-row" key={`${section}-${index}`}>
          <input aria-label={`${sectionTitles[section]} ${index + 1}`} value={item} maxLength={section === "skills" ? 80 : section === "languages" ? 100 : 180} onChange={event => updateListItem(section, index, event.target.value)} data-testid={`input-${section}-${index}`} />
          <button type="button" className="rs-icon-button rs-danger" aria-label={`حذف ${sectionTitles[section]} ${index + 1}`} onClick={() => removeListItem(section, index)} data-testid={`button-remove-${section}-${index}`}><X size={15} /></button>
        </div>)}
      </div>
    </section>
  );

  return (
    <section className="resume-studio" dir="rtl" data-testid="section-resume-studio">
      <header className="resume-studio-head resume-studio-tools">
        <div className="resume-studio-title">
          <div className="resume-studio-brand"><img src={`${import.meta.env.BASE_URL}athar-wordmark-3d.png`} alt="أثر" data-testid="img-resume-athar-logo" /><span>مساحة السيرة الذاتية</span></div>
          <h1>سيرتك، من واقع ما أنجزت</h1>
          <p>مساحة خاصة لترتيب أدلتك الدراسية ومشروعاتك في سيرة تعكس حقيقتك.</p>
        </div>
        <div className="resume-studio-actions" aria-label="خيارات التصدير">
          <button type="button" className="rs-button rs-button-quiet" onClick={() => window.print()} disabled={!hasDraft} data-testid="button-resume-print"><Printer size={17} /><span>طباعة أو حفظ PDF</span></button>
          <button type="button" className="rs-button rs-button-primary" onClick={handleDocxExport} disabled={!hasDraft} data-testid="button-resume-word"><ArrowDownToLine size={17} /><span>تنزيل Word</span></button>
        </div>
      </header>

      <section className="rs-draft-shelf resume-studio-tools" aria-label="المسودات الخاصة">
        <div className="rs-shelf-heading"><div><span className="rs-card-kicker">مسوداتك الخاصة</span><h2>اختر نسخة أو ابدأ واحدة جديدة</h2></div>
          <button type="button" className="rs-button rs-button-primary" onClick={createStarter} disabled={createResume.isPending || resumesQuery.isLoading} data-testid="button-create-resume">
            {createResume.isPending ? <LoaderCircle className="rs-spin" size={16} /> : <Plus size={16} />}<span>{createResume.isPending ? "يجري إنشاء المسودة" : "إنشاء مسودة من بياناتي"}</span>
          </button>
        </div>
        {resumesQuery.isLoading ? <div className="rs-draft-loading" data-testid="status-resumes-loading"><span /><span /><span /> جارٍ تحميل مسوداتك</div> :
          resumesQuery.isError ? <div className="rs-query-error" role="alert" data-testid="status-resumes-error"><CircleAlert size={17} /><span>تعذّر تحميل المسودات.</span><button type="button" onClick={() => void resumesQuery.refetch()} data-testid="button-retry-resumes">إعادة المحاولة</button></div> :
            resumes.length ? <div className="rs-draft-list" data-testid="list-resume-drafts">
              {resumes.map(draft => <button type="button" key={draft.id} className={`rs-draft-chip ${activeId === draft.id ? "is-active" : ""}`} onClick={() => chooseDraft(draft)} aria-pressed={activeId === draft.id} data-testid={`button-select-resume-${draft.id}`}>
                <FileText size={17} /><span><strong>{draft.title}</strong><small>آخر تعديل {formatDate(draft.updatedAt)} · {draft.template === "ats" ? "ATS مبسّط" : "مهني"}</small></span>
                {activeId === draft.id && <Check size={16} className="rs-selected-check" />}
              </button>)}
            </div> :
              <div className="rs-draft-empty" data-testid="status-resumes-empty"><FileText size={21} /><span>لا توجد مسودات محفوظة بعد. أنشئ نسخة أولى من بياناتك الموثّقة.</span></div>}
        {createResume.isError && <p className="rs-inline-error" role="alert" data-testid="status-create-resume-error">تعذّر إنشاء المسودة. حاول مرة أخرى.</p>}
      </section>

      {resumesQuery.isLoading ? <div className="rs-workspace-skeleton" aria-label="جارٍ تجهيز مساحة التحرير"><span /><span /><span /></div> :
        resumesQuery.isError ? null : (
          <div className="rs-workspace">
            {!hasDraft && resumes.length === 0 ? <div className="rs-empty-workspace resume-studio-tools" data-testid="status-resume-starter-empty">
              <div className="rs-empty-symbol"><FileText size={27} /></div><span className="rs-card-kicker">بداية هادئة</span><h2>لنرتّب ما أنجزته، كما هو</h2>
              <p>تُجهّز المسودة من اسمك ومهاراتك ودوراتك المكتملة وإنجازاتك المسجلة. لا نضيف معلومات لم تذكرها.</p>
              <button type="button" className="rs-button rs-button-primary" onClick={createStarter} disabled={createResume.isPending} data-testid="button-create-first-resume"><Plus size={16} /> إنشاء أول مسودة</button>
            </div> : (
              <>
                <section className="rs-paper-wrap" aria-label="معاينة السيرة">
                  <div className="rs-paper-topline"><span className="rs-live-dot" /><span>معاينة مباشرة</span><span className="rs-paper-date" data-testid="text-resume-updated">{activeDraft ? `آخر حفظ ${formatDate(activeDraft.updatedAt)}` : "مسودة جديدة"}</span></div>
                  <article className={`rs-resume-paper rs-template-${template} rs-customized`} dir="rtl" style={resumePaperStyle} data-testid="section-resume-preview">
                    {template === "professional" && <div className="rs-paper-accent" aria-hidden="true" />}
                    <header className="rs-identity">
                      <div className="rs-identity-copy"><span className="rs-document-label">السيرة الذاتية</span>
                        <h2 data-testid="text-resume-name">{content.fullName || "اسمك يظهر هنا"}</h2>
                        <p className="rs-headline" data-testid="text-resume-headline">{content.headline || "أضف المسمى أو المجال المهني المستهدف"}</p>
                        <div className="rs-meta" data-testid="text-resume-contact">{[content.email, content.phone, content.location, content.linkedin, content.website].filter(Boolean).join(" · ")}</div>
                      </div>
                      {content.fullName && <div className="rs-monogram" aria-hidden="true">{content.fullName.trim().slice(0, 1)}</div>}
                    </header>
                    {content.summary && <section className="rs-resume-section"><div className="rs-section-heading"><span>01</span><h3>الملخص المهني</h3></div><p className="rs-preview-summary" data-testid="text-preview-summary">{content.summary}</p></section>}
                    {(["education", "experience", "projects", "courses"] as EntrySection[]).map((section, sectionIndex) => {
                      const entries = content[section].filter(item => [item.title, item.organization, item.location, item.period, item.description, item.link].some(Boolean));
                      if (!entries.length) return null;
                      return <section className="rs-resume-section" key={section} data-testid={`section-preview-${section}`}>
                        <div className="rs-section-heading"><span>{String(sectionIndex + (content.summary ? 2 : 1)).padStart(2, "0")}</span><h3>{sectionTitles[section]}</h3></div>
                        <div className="rs-entry-list">{entries.map((entry, index) => <article className="rs-entry" key={`${section}-${index}`} data-testid={`card-preview-${section}-${index}`}>
                          <div className="rs-entry-top"><h4>{entry.title || "عنصر دون عنوان"}</h4><time>{entry.period}</time></div>
                          {[entry.organization, entry.location].filter(Boolean).length > 0 && <p className="rs-entry-context">{[entry.organization, entry.location].filter(Boolean).join(" · ")}</p>}
                          {entry.description && <p className="rs-entry-evidence">{entry.description}</p>}
                          {entry.link && <p className="rs-entry-context" dir="ltr">{entry.link}</p>}
                        </article>)}</div>
                      </section>;
                    })}
                    {(["skills", "certifications", "languages"] as TextSection[]).map((section, index) => {
                      const items = content[section].map(item => item.trim()).filter(Boolean);
                      if (!items.length) return null;
                      return <section className="rs-resume-section" key={section} data-testid={`section-preview-${section}`}>
                        <div className="rs-section-heading"><span>{String(index + 5).padStart(2, "0")}</span><h3>{sectionTitles[section]}</h3></div>
                        <ul className="rs-skill-list" data-testid={`list-preview-${section}`}>{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`} data-testid={`text-preview-${section}-${itemIndex}`}>{item}</li>)}</ul>
                      </section>;
                    })}
                    <footer className="rs-paper-footer"><img src={`${import.meta.env.BASE_URL}athar-wordmark-3d.png`} alt="أثر" /><span>أدلة حقيقية على ما تستطيع إنجازه.</span></footer>
                  </article>
                </section>

                <aside className="rs-side-column resume-studio-tools">
                  <section className="rs-side-card rs-score-card" data-testid="section-resume-completeness">
                    <div className="rs-score-heading"><div><span className="rs-card-kicker">جاهزية محلية</span><h2>اكتمال السيرة</h2></div>
                      <div className="rs-readiness-meter" style={{ "--rs-score": `${readiness.score}%` } as CSSProperties} data-testid="text-resume-completeness-score"><span>{readiness.score}<small>%</small></span></div>
                    </div>
                    <p className="rs-readiness-count" data-testid="text-resume-completeness-count">{readiness.completed} من {readiness.total} نقاط أساسية مكتملة</p>
                    {readiness.suggestions.length > 0 && <ul className="rs-readiness-tips" data-testid="list-resume-completeness-tips">{readiness.suggestions.slice(0, 4).map((tip, index) => <li key={tip} data-testid={`text-resume-completeness-tip-${index}`}>{tip}</li>)}</ul>}
                  </section>
                  <section className="rs-side-card rs-edit-card">
                    <div className="rs-card-kicker"><Sparkles size={15} /> مساحة خاصة، بصوتك</div>
                    <h2>كل تفصيل هنا يستند إلى تجربتك.</h2>
                    <p>راجع كل صياغة قبل اعتمادها. اقتراحات الكتابة لا تُطبّق تلقائياً ولا تضيف حقائق.</p>
                    <div className="rs-edit-links">
                      <Link href="/profile" className="rs-edit-link" data-testid="link-resume-profile"><span>تعديل بيانات الملف</span><ArrowUpLeft size={16} /></Link>
                      <Link href="/achievements" className="rs-edit-link" data-testid="link-resume-achievements"><span>إضافة أو تعديل إنجاز</span><ArrowUpLeft size={16} /></Link>
                    </div>
                  </section>
                  <section className="rs-side-card rs-ats-card">
                    <div className="rs-ats-heading"><div className="rs-ats-icon"><ScanSearch size={18} /></div><div><span className="rs-card-kicker">مقارنة داخل المتصفح</span><h2>قارِنها بوصف الوظيفة</h2></div></div>
                    <p className="rs-ats-intro">نقارن الكلمات فقط؛ استخدم ما ينطبق فعلاً على خبرتك.</p>
                    <p className="rs-resume-source-note" data-testid="text-resume-analysis-source">{resumeText.trim() ? "المقارنة ستستخدم نص سيرتك الحالية." : "أضف محتوى مهنياً لتبدأ المقارنة."}</p>
                    <label className="rs-job-label" htmlFor="resume-job-description">وصف الوظيفة</label>
                    <textarea id="resume-job-description" className="rs-job-input" value={jobDescription} onChange={event => { setJobDescription(event.target.value); setAnalysis(null); setAnalysisMessage(""); }} placeholder="الصق وصف الوظيفة هنا..." rows={6} maxLength={10000} data-testid="input-resume-job-description" />
                    <button type="button" className="rs-button rs-analyze-button" onClick={analyze} data-testid="button-resume-analyze"><ScanSearch size={16} /> تحليل الكلمات</button>
                    {analysisMessage && <p className="rs-form-message" role="alert" data-testid="status-resume-analysis-message">{analysisMessage}</p>}
                    {analysis && <div className="rs-analysis-result" aria-live="polite" data-testid="section-resume-analysis-result">
                      {analysis.totalTerms > 0 ? <div className="rs-score-row"><div className="rs-score-meter" style={{ "--rs-score": `${analysis.score}%` } as CSSProperties}><span data-testid="text-resume-ats-score">{analysis.score}<small>%</small></span></div><div><strong>تقارب الكلمات</strong><span data-testid="text-resume-ats-total">من {analysis.totalTerms} كلمة ظاهرة في الوصف</span></div></div> : <div className="rs-analysis-empty" data-testid="status-resume-analysis-empty">لم تظهر كلمات كافية للمقارنة في هذا الوصف.</div>}
                      <div className="rs-term-block"><h3><Check size={15} /> كلمات موجودة في سيرتك <small>{analysis.matchedTermCount}</small></h3>{analysis.matchedTerms.length ? <div className="rs-term-list" data-testid="list-resume-matched-terms">{analysis.matchedTerms.map(term => <span key={term} data-testid={`text-resume-matched-${term}`}>{term}</span>)}</div> : <p className="rs-term-empty">لا توجد كلمات مشتركة حتى الآن.</p>}</div>
                      <div className="rs-term-block"><h3><span className="rs-missing-dot" /> كلمات لم تظهر في سيرتك <small>{analysis.missingTermCount}</small></h3>{analysis.missingTerms.length ? <div className="rs-term-list rs-term-list-missing" data-testid="list-resume-missing-terms">{analysis.missingTerms.map(term => <span key={term} data-testid={`text-resume-missing-${term}`}>{term}</span>)}</div> : <p className="rs-term-empty">لم تُرصد كلمات ناقصة ضمن المقارنة.</p>}</div>
                      {analysis.suggestions.length > 0 && <div className="rs-suggestions" data-testid="list-resume-suggestions"><strong>مراجعة مقترحة</strong><ul>{analysis.suggestions.map((suggestion, index) => <li key={`${suggestion}-${index}`} data-testid={`text-resume-suggestion-${index}`}>{suggestion}</li>)}</ul></div>}
                    </div>}
                    <p className="rs-ats-disclaimer" data-testid="text-resume-ats-disclaimer">النتيجة تقديرية لمقارنة الكلمات وليست تقييماً نهائياً أو ضماناً للتوظيف.</p>
                    <p className="rs-private-job-note" data-testid="text-resume-job-privacy">يبقى وصف الوظيفة في المتصفح فقط؛ لا يُرسل ولا يُحفظ.</p>
                  </section>
                  <section className="rs-side-card rs-appearance-card" aria-labelledby="rs-appearance-title" data-testid="section-guided-resume-appearance">
                    <div className="rs-editor-section-head">
                      <div><span className="rs-card-kicker">تنسيق خاص بالمسودة</span><h2 id="rs-appearance-title">الخطوط والألوان</h2></div>
                      <button type="button" className="rs-appearance-reset" onClick={() => updateAppearance(DEFAULT_RESUME_APPEARANCE)} data-testid="button-reset-guided-resume-appearance">استعادة الافتراضي</button>
                    </div>
                    <div className="rs-appearance-grid">
                      <label className="rs-field"><span>نوع الخط</span>
                        <select value={appearance.fontFamily} onChange={event => updateAppearance({ fontFamily: event.target.value as ResumeFontFamily })} data-testid="select-guided-resume-font">
                          {(Object.keys(RESUME_FONT_LABELS) as ResumeFontFamily[]).map(font => <option value={font} key={font}>{RESUME_FONT_LABELS[font]}</option>)}
                        </select>
                      </label>
                      <label className="rs-field"><span>حجم الخط — {appearance.fontSize ?? 11} نقطة</span>
                        <input type="range" min={10} max={18} step={1} value={appearance.fontSize ?? 11} onChange={event => updateAppearance({ fontSize: Number(event.target.value) })} data-testid="input-guided-resume-font-size" />
                      </label>
                    </div>
                    <div className="rs-appearance-colors">
                      {([
                        ["pageColor", "لون خلفية الصفحة"],
                        ["textColor", "لون النص"],
                        ["headingColor", "لون العناوين"],
                        ["accentColor", "لون التمييز"],
                      ] as const).map(([key, label]) => <div className="rs-appearance-color-field" key={key}>
                        <span>{label}</span>
                        <NamedColorPicker
                          label={label}
                          value={appearance[key]}
                          onChange={value => updateAppearance({ [key]: value })}
                          testId={`input-guided-resume-${key}`}
                        />
                      </div>)}
                    </div>
                    <div className="rs-appearance-presets" role="group" aria-label="ألوان جاهزة">
                      <span>ألوان جاهزة</span>
                      {RESUME_COLOR_PRESETS.map(preset => <button type="button" key={preset.label} onClick={() => updateAppearance(preset.appearance)} data-testid={`button-guided-resume-preset-${preset.label}`}>
                        <i style={{ backgroundColor: preset.appearance.accentColor }} aria-hidden="true" />{preset.label}
                      </button>)}
                    </div>
                    {colorContrastRatio(appearance.textColor, appearance.pageColor) < 4.5 || colorContrastRatio(appearance.headingColor, appearance.pageColor) < 3
                      ? <p className="rs-appearance-warning" role="status">التباين منخفض وقد يصعب قراءة السيرة؛ اختر لونًا أوضح قبل التنزيل.</p>
                      : <p className="rs-appearance-hint">تظهر اختياراتك في المعاينة وتُحفظ تلقائيًا مع هذه السيرة.</p>}
                  </section>
                  <section className="rs-side-card rs-draft-settings">
                    <div className="rs-editor-section-head"><div><span className="rs-card-kicker">إعداد المسودة</span><h2>اسم النسخة والقالب</h2></div>
                      <button type="button" className="rs-icon-button rs-danger" onClick={removeDraft} disabled={!activeDraft || deleteResume.isPending} aria-label="حذف المسودة الحالية" data-testid="button-delete-resume">{deleteResume.isPending ? <LoaderCircle className="rs-spin" size={16} /> : <Trash2 size={16} />}</button>
                    </div>
                    <label className="rs-field"><span>اسم المسودة</span><input value={title} maxLength={120} aria-required="true" onChange={event => setTitle(event.target.value)} data-testid="input-resume-title" /></label>
                    <div className="rs-template-options" role="group" aria-label="قالب السيرة">
                      <button type="button" className={`rs-template-option ${template === "ats" ? "is-selected" : ""}`} onClick={() => setTemplate("ats")} aria-pressed={template === "ats"} data-testid="button-template-ats"><span>ATS مبسّط</span><small>عمود واحد · نص واضح</small></button>
                      <button type="button" className={`rs-template-option ${template === "professional" ? "is-selected" : ""}`} onClick={() => setTemplate("professional")} aria-pressed={template === "professional"} data-testid="button-template-professional"><span>مهني</span><small>تنسيق هادئ · إبراز بصري</small></button>
                    </div>
                    <div className="rs-save-status" aria-live="polite" data-testid="status-resume-saving">
                      {!title.trim() ? <>أدخل اسمًا للنسخة حتى تُحفظ التعديلات.</> : updateResume.isPending ? <><LoaderCircle className="rs-spin" size={14} /> جارٍ حفظ التعديلات</> : updateResume.isError ? <><CircleAlert size={14} /> تعذّر حفظ التعديلات.<button type="button" onClick={saveCurrentDraft} disabled={!activeId} data-testid="button-retry-resume-save">إعادة المحاولة الآن</button></> : <><Check size={14} /> تُحفظ التعديلات تلقائياً</>}
                    </div>
                    {deleteError && <p className="rs-inline-error" role="alert" data-testid="status-delete-resume-error">{deleteError}</p>}
                    {exportError && <p className="rs-inline-error" role="alert" data-testid="status-resume-export-error">{exportError}</p>}
                  </section>
                </aside>
              </>
            )}

            {hasDraft && <div className="rs-editor-column resume-studio-tools">
              <section className="rs-side-card rs-identity-editor">
                <div className="rs-editor-section-head"><div><span className="rs-card-kicker">الأساسيات</span><h2>كيف تريد أن يراك القارئ؟</h2></div><span className="rs-save-indicator" data-testid="text-resume-saved-indicator">{updateResume.isPending ? "يحفظ الآن" : "مسودة خاصة"}</span></div>
                <div className="rs-field-grid">
                  {([
                    ["fullName", "الاسم الكامل", 120], ["email", "البريد الإلكتروني", 200], ["phone", "رقم التواصل", 60], ["location", "المدينة أو الموقع", 160],
                    ["linkedin", "رابط مهني", 400], ["website", "موقع أو معرض أعمال", 400], ["headline", "المسمى أو المجال", 240],
                  ] as const).map(([field, label, max]) => <label className={`rs-field ${field === "headline" ? "rs-field-wide" : ""}`} key={field}><span>{label}</span>
                    <input value={content[field]} maxLength={max} dir={["email", "phone", "linkedin", "website"].includes(field) ? "ltr" : "auto"} onChange={event => updateContent(previous => ({ ...previous, [field]: event.target.value }))} data-testid={`input-resume-${field}`} />
                  </label>)}
                  <label className="rs-field rs-field-wide"><span>الملخص المهني</span><textarea value={content.summary} rows={4} maxLength={2000} onChange={event => updateContent(previous => ({ ...previous, summary: event.target.value }))} data-testid="input-resume-summary" /></label>
                </div>
                <p className="rs-ai-privacy-note" data-testid="text-rewrite-privacy-summary">{aiPrivacyNote}</p>
                <button type="button" className="rs-rewrite-trigger" onClick={() => requestRewrite({ section: "summary" }, content.summary)} disabled={rewriteText.isPending} data-testid="button-rewrite-summary"><Sparkles size={14} /> اقتراح صياغة للملخص</button>
              </section>

              {( ["education", "experience", "projects", "courses"] as EntrySection[]).map(renderEntryEditors)}
              {( ["skills", "certifications", "languages"] as TextSection[]).map(renderStringEditors)}
              {rewriteText.isPending && <div className="rs-rewrite-status" role="status" data-testid="status-resume-rewrite-loading"><LoaderCircle className="rs-spin" size={15} /> يجري إعداد اقتراح للمراجعة</div>}
              {rewriteError && <p className="rs-inline-error" role="alert" data-testid="status-resume-rewrite-error">{rewriteError}</p>}
              {rewriteSuggestion && suggestionIsCurrent && <section className="rs-suggestion-review" aria-live="polite" data-testid="section-resume-rewrite-suggestion">
                <div><div className="rs-card-kicker"><Sparkles size={14} /> اقتراح للمراجعة</div><p data-testid="text-resume-rewrite-suggestion">{rewriteSuggestion.text}</p><small>اقرأ النص وتأكد من دقته. لن يتغير محتوى سيرتك إلا عند تطبيقه.</small></div>
                <div className="rs-suggestion-actions"><button type="button" className="rs-button rs-button-primary" onClick={applyRewrite} data-testid="button-apply-resume-rewrite"><Check size={15} /> تطبيق الاقتراح</button><button type="button" className="rs-button rs-button-quiet" onClick={() => setRewriteSuggestion(null)} data-testid="button-dismiss-resume-rewrite">إبقاء النص الحالي</button></div>
              </section>}
            </div>}
          </div>
        )}
    </section>
  );
}

export default ResumeStudio;
