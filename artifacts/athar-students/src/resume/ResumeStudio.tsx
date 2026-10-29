import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "wouter";
import type { Achievement, LearningItem, StudentProfile } from "@workspace/api-client-react";
import { ArrowDownToLine, ArrowUpLeft, Check, CircleAlert, FileText, Printer, ScanSearch, Sparkles } from "lucide-react";
import { analyzeAtsMatch, buildResumeText } from "./resume-ats";
import type { ResumeData } from "./resume-ats";
import { downloadResumeDocx } from "./resume-export";
import "./resume-studio.css";

type ResumeTemplate = "ats" | "professional";

type ResumeStudioProps = {
  profile: StudentProfile | null;
  achievements: Achievement[];
  courses: LearningItem[];
};

const categoryLabels: Record<Achievement["category"], string> = {
  project: "مشروع",
  internship: "تدريب",
  volunteer: "عمل تطوعي",
  competition: "مسابقة",
  course: "دورة",
  research: "بحث",
  other: "تجربة",
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ar", { year: "numeric", month: "long" }).format(date);
}

function ResumeStudio({ profile, achievements, courses }: ResumeStudioProps) {
  const [template, setTemplate] = useState<ResumeTemplate>("ats");
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeAtsMatch> | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const resumeData = useMemo<ResumeData>(() => ({
    profile: profile ? {
      fullName: profile.fullName,
      headline: profile.headline,
      university: profile.university,
      major: profile.major,
      yearOfStudy: profile.yearOfStudy,
      skills: profile.skills ?? [],
    } : null,
    achievements: (achievements ?? []).map(item => ({
      title: item.title,
      context: item.context,
      result: item.result,
      resumeBullet: item.resumeBullet,
      skills: item.skills ?? [],
      achievedOn: item.achievedOn,
    })),
    courses: (courses ?? [])
      .filter(item => item.kind === "course" && item.status === "completed")
      .map(item => ({
        title: item.title, subject: item.subject, source: item.source,
        skills: item.skills ?? [], studyMinutes: item.studyMinutes,
      })),
  }), [profile, achievements, courses]);

  const skills = useMemo(() => [...new Set([
    ...(profile?.skills ?? []),
    ...resumeData.achievements.flatMap(item => item.skills ?? []),
    ...resumeData.courses.flatMap(item => item.skills ?? []),
  ].map(skill => skill.trim()).filter(Boolean))], [profile?.skills, resumeData.achievements]);
  const resumeText = useMemo(() => buildResumeText(resumeData), [resumeData]);
  const hasProfile = Boolean(profile?.fullName?.trim() || profile?.headline?.trim() || profile?.major?.trim());

  const handleAnalyze = () => {
    if (!jobDescription.trim()) {
      setAnalysis(null);
      setAnalysisMessage("أدخل وصف الوظيفة أولاً لبدء المقارنة.");
      return;
    }
    setAnalysis(analyzeAtsMatch(resumeData, jobDescription));
    setAnalysisMessage("");
  };

  const handleDocxExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      await downloadResumeDocx(resumeData, template);
    } catch {
      setExportError("تعذّر تجهيز ملف Word الآن. حاول مرة أخرى.");
    } finally {
      setExporting(false);
    }
  };

  const printResume = () => window.print();

  return (
    <section className="resume-studio" dir="rtl" data-testid="section-resume-studio">
      <div className="resume-studio-head resume-studio-tools">
        <div className="resume-studio-title">
          <div className="resume-studio-brand">
            <img src={`${import.meta.env.BASE_URL}athar-wordmark-3d.png`} alt="أثر" data-testid="img-resume-athar-logo" />
            <span>مساحة السيرة الذاتية</span>
          </div>
          <h1>سيرتك، من واقع ما أنجزت</h1>
          <p>رتّب أدلتك الدراسية والعملية في نسخة واضحة وجاهزة لطلبك القادم.</p>
        </div>
        <div className="resume-studio-actions" aria-label="خيارات التصدير">
          <button type="button" className="rs-button rs-button-quiet" onClick={printResume} data-testid="button-resume-print">
            <Printer size={17} aria-hidden="true" />
            <span>طباعة أو حفظ PDF</span>
          </button>
          <button type="button" className="rs-button rs-button-primary" onClick={handleDocxExport} disabled={exporting} data-testid="button-resume-word">
            <ArrowDownToLine size={17} aria-hidden="true" />
            <span>{exporting ? "يجري تجهيز الملف" : "تنزيل Word"}</span>
          </button>
        </div>
      </div>

      <section className="rs-template-bar resume-studio-tools" aria-label="اختيار قالب السيرة">
        <div className="rs-template-copy">
          <span className="rs-template-mark"><FileText size={17} /></span>
          <div>
            <strong>اختر طريقة العرض</strong>
            <small>يمكنك تغيير القالب قبل الطباعة أو التنزيل.</small>
          </div>
        </div>
        <div className="rs-template-options" role="group" aria-label="قالب السيرة">
          <button type="button" className={template === "ats" ? "rs-template-option is-selected" : "rs-template-option"} onClick={() => setTemplate("ats")} aria-pressed={template === "ats"} data-testid="button-template-ats">
            <span>قالب ATS مبسّط</span><small>عمود واحد · نص واضح</small>
          </button>
          <button type="button" className={template === "professional" ? "rs-template-option is-selected" : "rs-template-option"} onClick={() => setTemplate("professional")} aria-pressed={template === "professional"} data-testid="button-template-professional">
            <span>مهني</span><small>تنسيق هادئ · إبراز بصري</small>
          </button>
        </div>
      </section>

      <div className="rs-studio-grid">
        <section className="rs-paper-wrap" aria-label="معاينة السيرة">
          <div className="rs-paper-topline">
            <span className="rs-live-dot" />
            <span>معاينة مباشرة</span>
            <span className="rs-paper-date">{formatDate(new Date().toISOString())}</span>
          </div>

          <article className={`rs-resume-paper rs-template-${template}`} dir="rtl" data-testid="section-resume-preview">
            {template === "professional" && <div className="rs-paper-accent" aria-hidden="true" />}
            <header className="rs-identity">
              <div className="rs-identity-copy">
                <span className="rs-document-label">السيرة الذاتية</span>
                <h2 data-testid="text-resume-name">{profile?.fullName?.trim() || "أضف اسمك إلى ملفك الشخصي"}</h2>
                <p className="rs-headline" data-testid="text-resume-headline">{profile?.headline?.trim() || profile?.major?.trim() || "نبذة مهنية تظهر هنا عند إضافتها إلى ملفك."}</p>
                <div className="rs-meta" data-testid="text-resume-profile-details">
                  {profile?.university && <span>{profile.university}</span>}
                  {profile?.major && <span>{profile.major}</span>}
                  {profile?.yearOfStudy && <span>السنة {profile.yearOfStudy}</span>}
                </div>
              </div>
              {profile?.fullName && <div className="rs-monogram" aria-hidden="true">{profile.fullName.trim().slice(0, 1)}</div>}
            </header>

            {!hasProfile && (
              <div className="rs-inline-note" data-testid="status-resume-profile-empty">
                <CircleAlert size={16} />
                <span>ابدأ بتعبئة بياناتك الأساسية ليظهر تعريفك المهني هنا.</span>
              </div>
            )}

            <section className="rs-resume-section" data-testid="section-resume-skills">
              <div className="rs-section-heading"><span>01</span><h3>المهارات</h3></div>
              {skills.length ? (
                <ul className="rs-skill-list" data-testid="list-resume-skills">
                  {skills.map(skill => <li key={skill} data-testid={`text-resume-skill-${skill}`}>{skill}</li>)}
                </ul>
              ) : (
                <p className="rs-empty-copy">ستظهر مهارات ملفك وإنجازاتك والمهارات المرتبطة بالدورات المكتملة هنا.</p>
              )}
            </section>

            <section className="rs-resume-section" data-testid="section-resume-achievements">
              <div className="rs-section-heading">
                <span>02</span><h3>الخبرات والإنجازات</h3><small data-testid="text-resume-achievement-count">{resumeData.achievements.length}</small>
              </div>
              {resumeData.achievements.length ? (
                <div className="rs-entry-list">
                  {resumeData.achievements.map((item, index) => {
                    const original = achievements[index];
                    const evidence = item.resumeBullet?.trim() || item.result?.trim();
                    return (
                      <article className="rs-entry" key={original?.id ?? `${item.title}-${index}`} data-testid={`card-resume-achievement-${original?.id ?? index}`}>
                        <div className="rs-entry-top">
                          <h4>{item.title}</h4>
                          <time>{formatDate(item.achievedOn)}</time>
                        </div>
                        <p className="rs-entry-context">
                          {original ? categoryLabels[original.category] : "إنجاز"}
                          {item.context?.trim() ? ` · ${item.context}` : ""}
                        </p>
                        {evidence && <p className="rs-entry-evidence">{evidence}</p>}
                        {!evidence && <p className="rs-entry-evidence rs-entry-missing">أضف وصفاً موجزاً لنتيجتك من صفحة الإنجازات.</p>}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="rs-empty-copy" data-testid="status-resume-achievements-empty">لم توثّق تجربة بعد. أضف مشروعاً أو تدريباً أو تجربة حقيقية لتبدأ.</p>
              )}
            </section>

            <section className="rs-resume-section" data-testid="section-resume-courses">
              <div className="rs-section-heading">
                <span>03</span><h3>التعلّم والدورات</h3><small data-testid="text-resume-course-count">{resumeData.courses.length}</small>
              </div>
              {resumeData.courses.length ? (
                <div className="rs-entry-list">
                  {resumeData.courses.map((course, index) => (
                    <article className="rs-entry rs-course-entry" key={`${course.title}-${index}`} data-testid={`card-resume-course-${index}`}>
                      <div className="rs-entry-top"><h4>{course.title}</h4></div>
                      {(course.subject || course.source) && <p className="rs-entry-context">{[course.subject, course.source].filter(Boolean).join(" · ")}</p>}
                      {course.skills?.length ? <p className="rs-entry-context">مهارات درستها: {course.skills.join(" · ")}</p> : null}
                      {!!course.studyMinutes && <p className="rs-entry-context" data-testid={`text-resume-course-study-time-${index}`}>وقت التعلّم المسجل داخل أثر: {course.studyMinutes.toLocaleString("ar")} دقيقة</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rs-empty-copy" data-testid="status-resume-courses-empty">تظهر هنا الدورات المكتملة من مكتبة التعلّم.</p>
              )}
            </section>
            <footer className="rs-paper-footer">
              <img src={`${import.meta.env.BASE_URL}athar-wordmark-3d.png`} alt="أثر" />
              <span>أدلة حقيقية على ما تستطيع إنجازه.</span>
            </footer>
          </article>
        </section>

        <aside className="rs-side-column resume-studio-tools">
          <section className="rs-side-card rs-edit-card">
            <div className="rs-card-kicker"><Sparkles size={15} /> جاهزة للتطوير</div>
            <h2>كل تجربة موثّقة تقوّي صورتك.</h2>
            <p>بيانات سيرتك تأتي من ملفك وإنجازاتك ودوراتك المكتملة، ولا تُضاف أي معلومة من خارجها.</p>
            <div className="rs-edit-links">
              <Link href="/profile" className="rs-edit-link" data-testid="link-resume-profile">
                <span>تعديل بيانات الملف</span><ArrowUpLeft size={16} />
              </Link>
              <Link href="/achievements" className="rs-edit-link" data-testid="link-resume-achievements">
                <span>إضافة أو تعديل إنجاز</span><ArrowUpLeft size={16} />
              </Link>
            </div>
          </section>

          <section className="rs-side-card rs-ats-card">
            <div className="rs-ats-heading">
              <div className="rs-ats-icon"><ScanSearch size={18} /></div>
              <div><span className="rs-card-kicker">مقارنة محلية</span><h2>قارِنها بوصف الوظيفة</h2></div>
            </div>
            <p className="rs-ats-intro">أدخل الوصف لمقارنة الكلمات الموجودة في سيرتك. يبقى النص في هذه الصفحة فقط.</p>
            <p className="rs-resume-source-note" data-testid="text-resume-analysis-source">
              {resumeText.trim() ? "ستعتمد المقارنة على المحتوى المتاح في سيرتك." : "لا يوجد محتوى مهني كافٍ للمقارنة بعد؛ أضف بياناتك أو إنجازاتك أولاً."}
            </p>
            <label className="rs-job-label" htmlFor="resume-job-description">وصف الوظيفة</label>
            <textarea
              id="resume-job-description"
              className="rs-job-input"
              value={jobDescription}
              onChange={event => {
                setJobDescription(event.target.value);
                setAnalysis(null);
                setAnalysisMessage("");
              }}
              placeholder="الصق وصف الوظيفة هنا..."
              rows={7}
              maxLength={10000}
              data-testid="input-resume-job-description"
            />
            <button type="button" className="rs-button rs-analyze-button" onClick={handleAnalyze} data-testid="button-resume-analyze">
              <ScanSearch size={16} /> تحليل التطابق
            </button>
            {analysisMessage && <p className="rs-form-message" role="alert" data-testid="status-resume-analysis-message">{analysisMessage}</p>}

            {analysis && (
              <div className="rs-analysis-result" aria-live="polite" data-testid="section-resume-analysis-result">
                {analysis.totalTerms > 0 ? (
                  <div className="rs-score-row">
                    <div className="rs-score-meter" style={{ "--rs-score": `${analysis.score}%` } as CSSProperties}>
                      <span data-testid="text-resume-ats-score">{analysis.score}<small>%</small></span>
                    </div>
                    <div><strong>تطابق الكلمات</strong><span data-testid="text-resume-ats-total">من {analysis.totalTerms} كلمة مهمة في الوصف</span></div>
                  </div>
                ) : (
                  <div className="rs-analysis-empty" data-testid="status-resume-analysis-empty">لم تظهر كلمات كافية للمقارنة في هذا الوصف.</div>
                )}
                <div className="rs-term-block">
                  <h3><Check size={15} /> كلمات موجودة في سيرتك <small>{analysis.matchedTermCount}</small></h3>
                  {analysis.matchedTerms.length ? (
                    <div className="rs-term-list" data-testid="list-resume-matched-terms">
                      {analysis.matchedTerms.map(term => <span key={term} data-testid={`text-resume-matched-${term}`}>{term}</span>)}
                    </div>
                  ) : <p className="rs-term-empty">لا توجد كلمات مشتركة حتى الآن.</p>}
                </div>
                <div className="rs-term-block">
                  <h3><span className="rs-missing-dot" /> كلمات لم تظهر في سيرتك <small>{analysis.missingTermCount}</small></h3>
                  {analysis.missingTerms.length ? (
                    <div className="rs-term-list rs-term-list-missing" data-testid="list-resume-missing-terms">
                      {analysis.missingTerms.map(term => <span key={term} data-testid={`text-resume-missing-${term}`}>{term}</span>)}
                    </div>
                  ) : <p className="rs-term-empty">لم تُرصد كلمات ناقصة ضمن المقارنة.</p>}
                </div>
                {analysis.suggestions.length > 0 && (
                  <div className="rs-suggestions" data-testid="list-resume-suggestions">
                    <strong>خطوات مقترحة</strong>
                    <ul>{analysis.suggestions.map((suggestion, index) => <li key={`${suggestion}-${index}`} data-testid={`text-resume-suggestion-${index}`}>{suggestion}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
            <p className="rs-ats-disclaimer" data-testid="text-resume-ats-disclaimer">
              هذه نتيجة تقديرية لمطابقة الكلمات فقط. تختلف أنظمة ATS وطرق التقييم، ولا تمثل النسبة ضماناً للتوظيف.
            </p>
          </section>

          <section className="rs-privacy-note" data-testid="text-resume-private-note">
            <span className="rs-privacy-mark" aria-hidden="true">↳</span>
            <p>يُستخدم وصف الوظيفة للتحليل داخل المتصفح فقط، ولا يُرسل إلى خادم أو خدمة ذكاء اصطناعي ولا يُحفظ.</p>
          </section>
          {exportError && <p className="rs-export-error" role="alert" data-testid="status-resume-export-error">{exportError}</p>}
        </aside>
      </div>
    </section>
  );
}

export default ResumeStudio;
