import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useRoute } from 'wouter';
import {
  ArrowLeft, Award, BookOpen, Check, CheckCircle2, Clock3, Download, FileText, GraduationCap, Image as ImageIcon,
  Lightbulb, LockKeyhole, Search, Send, ShieldCheck, Sparkles, Trash2, Upload, Brain, NotebookPen,
} from 'lucide-react';
import {
  getGetCareerPlanQueryKey,
  getGetAcademyAttemptQueryKey, getGetAcademyLessonQueryKey, getGetAcademySubjectQueryKey,
  getGetAcademySkillSuggestionsQueryKey, getListAcademyFilesQueryKey, getListAcademySubjectsQueryKey,
  getListAchievementsQueryKey,
  getSearchAcademyQueryKey, useApplyAcademySkillSuggestions, useAskAcademyAssistant,
  useBeginAcademyExam, useCompleteAcademyLesson, useConfirmAcademyFileUpload,
  useConvertAcademyAttemptToAchievement, useConvertAcademyGrowthToAchievement,
  useDeleteAcademyFile, useEnrollAcademySubject, useGetAcademyAttempt, useGetAcademyLesson,
  useGetAcademySkillSuggestions, useGetAcademySubject, useListAcademyFiles,
  useListAcademySubjects, useMarkAcademyAttemptReviewed, useRequestAcademyFileUpload,
  useSearchAcademy, useSubmitAcademyAttempt,
} from '@workspace/api-client-react';
import type { AcademyAssistantResponse, AcademySearchSource, AcademyStudentFile, AcademyStudentFileInputMime } from '@workspace/api-client-react';
import './academy.css';
import { CommunityCoursesPanel } from './CommunityCoursesPanel';
import { AcademyVideoPlayer } from './AcademyVideoPlayer';
import { RequiredMark } from '../components/RequiredMark';
import { AcademyFileQuizBuilder, AcademyFileStudyGuide } from './AcademyFileStudyTools';
import { uploadFile } from '../lib/upload-file';

function Head({ kicker = 'المذاكرة في أثر', title, detail, action }: { kicker?: string; title: string; detail: string; action?: React.ReactNode }) {
  return <header className="ac-head"><div><span className="ac-kicker">{kicker}</span><h1>{title}</h1><p>{detail}</p></div>{action}</header>;
}
function Loading({ count = 3 }: { count?: number }) {
  return <div className="ac-skeleton" role="status" aria-label="جارٍ تحميل المحتوى">{Array.from({ length: count }, (_, i) => <i key={i}/>)}</div>;
}
function State({ title, detail, retry }: { title: string; detail: string; retry?: () => void }) {
  return <div className="ac-state" role={retry ? 'alert' : 'status'}><BookOpen size={22}/><b>{title}</b><p>{detail}</p>{retry && <button className="ac-button" type="button" onClick={retry}>إعادة المحاولة</button>}</div>;
}
function errMessage(error: unknown) {
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status: unknown }).status) : 0;
  return status === 401 || status === 403 ? 'لا يمكن إتمام الطلب بهذا الحساب.' : 'تعذّر إتمام العملية. تحقق من الاتصال ثم حاول مجدداً.';
}
function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toLocaleString('ar', { maximumFractionDigits: 1 })} ك.ب` : `${(bytes / 1024 / 1024).toLocaleString('ar', { maximumFractionDigits: 1 })} م.ب`;
}

export function AcademyPage() {
  const subjects = useListAcademySubjects();
  const skills = useGetAcademySkillSuggestions();
  const apply = useApplyAcademySkillSuggestions();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [applyMessage, setApplyMessage] = useState('');
  const [search, setSearch] = useState('');
  if (subjects.isLoading) return <div className="academy"><Head title="تعلّم يصنع دليلاً" detail="مسار من المعرفة إلى مهارات تستطيع شرحها."/><Loading/></div>;
  if (subjects.isError || !subjects.data) return <div className="academy"><Head title="تعلّم يصنع دليلاً" detail="مسار من المعرفة إلى مهارات تستطيع شرحها."/><State title="تعذّر تحميل المواد" detail="حاول مرة أخرى بعد لحظات." retry={() => subjects.refetch()}/></div>;
  return <main className="academy">
     <section className="ac-hero"><div><span className="ac-kicker">من التعلّم إلى أثر موثّق</span><h2>تعلّم. اختبر فهمك.<br/>واحتفظ بدليل نموّك.</h2><p>ارفع محاضراتك، أنشئ ملخصًا ذكيًا، واختبر فهمك بنتيجة خاصة تساعدك على معرفة ما يحتاج إلى مراجعة.</p><div className="ac-actions"><Link href="/academy/files" className="ac-button ac-button-primary"><Upload size={15}/> مكتبتي وأدوات المذاكرة</Link><Link href="/academy/assistant" className="ac-button"><Brain size={15}/> اسأل مساعد أثر</Link></div></div><div className="ac-hero-mark"><GraduationCap size={38}/></div></section>
     <section className="ac-grid ac-study-entry-cards" aria-label="أدوات المذاكرة الذكية">
       <Link href="/academy/files" className="ac-card ac-study-entry-card"><span className="ac-row-icon"><NotebookPen size={19}/></span><h3>ارفع محاضراتك</h3><p>اجمع ملفاتك التعليمية الخاصة في مكتبة واحدة، ثم أنشئ منها ملخصات واختبارات.</p><span className="ac-button">افتح مكتبتي <ArrowLeft size={14}/></span></Link>
       <Link href="/academy/assistant" className="ac-card ac-study-entry-card"><span className="ac-row-icon"><Brain size={19}/></span><h3>اسأل مساعد أثر</h3><p>اسأل عن فكرة في محاضراتك، واحصل على إجابة مرتبطة بمقاطع من مصادرك.</p><span className="ac-button">اسأل سؤالًا <ArrowLeft size={14}/></span></Link>
     </section>
    <section className="ac-panel" aria-label="البحث في المذاكرة">
      <form className="ac-form" role="search" onSubmit={(e: FormEvent) => { e.preventDefault(); if (search.trim()) navigate(`/academy/search?q=${encodeURIComponent(search.trim())}`); }}>
        <label className="ac-sr" htmlFor="academy-search">ابحث في موادك التعليمية</label><Search size={18}/>
        <input id="academy-search" className="ac-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث في الدروس والملفات التي تملكها"/>
        <button className="ac-button ac-button-primary" type="submit" disabled={!search.trim()}>بحث</button>
      </form>
    </section>
    <Head title="المواد المنشورة" detail="ابدأ بالمادة التي تخدم تعلّمك، ثم وثّق ما تتقنه."/>
    {!subjects.data.length ? <State title="لا توجد مواد منشورة بعد" detail="ستظهر هنا المواد التعليمية التي يتيحها فريق أثر."/> :
      <div className="ac-grid">{subjects.data.map(item => {
        const progress = item.lessonCount ? Math.round(item.completedLessons / item.lessonCount * 100) : 0;
        return <article className="ac-card" key={item.id}>
          <div className="ac-meta"><span className="ac-chip">{item.level}</span><span>{item.lessonCount.toLocaleString('ar')} درس</span></div>
          <h2>{item.title}</h2><p>{item.description}</p>
          <div className="ac-tags">{item.skillTags.map(tag => <span className="ac-tag" key={tag}>{tag}</span>)}</div>
          <div className="ac-meta">{item.enrolled ? <><span>{item.completedLessons.toLocaleString('ar')} من {item.lessonCount.toLocaleString('ar')} مكتملة</span><span className="ac-progress" style={{ flex: 1 }}><span style={{ width: `${progress}%` }}/></span></> : <span>استكشف الدروس والاختبارات</span>}</div>
          <Link href={`/academy/subjects/${encodeURIComponent(item.id)}`} className="ac-button ac-button-primary">عرض المادة <ArrowLeft size={15}/></Link>
        </article>;
      })}</div>}
    <section className="ac-panel">
      <div className="ac-meta"><Lightbulb size={17}/><span className="ac-kicker">اقتراحات مرتبطة بخطتك</span></div>
      <h2 style={{ margin: '4px 0 7px', fontSize: 17 }}>مهارات من المواد المسجّل بها</h2>
      {skills.isLoading ? <Loading count={1}/> : skills.isError ? <State title="تعذّر تحميل الاقتراحات" detail="يمكنك إعادة المحاولة." retry={() => skills.refetch()}/> : !skills.data?.skills.length ?
        <p style={{ color: 'var(--ac-muted)', fontSize: 12, lineHeight: 1.8 }}>ستظهر الاقتراحات بعد تسجيلك في مادة تتضمن مهارات مرتبطة.</p> :
        <>
          <div className="ac-tags">{skills.data.skills.map(s => <span className="ac-tag" key={s}>{s}</span>)}</div>
          {!!skills.data.subjects.length && <p style={{ color: 'var(--ac-muted)', fontSize: 11, marginTop: 9 }}>من: {skills.data.subjects.map(s => s.title).join('، ')}</p>}
          <div className="ac-actions" style={{ marginTop: 14 }}>
            <button className="ac-button ac-button-primary" type="button" disabled={apply.isPending} onClick={() => { setApplyMessage(''); apply.mutate(undefined, { onSuccess: result => { setApplyMessage(`أُضيفت ${result.added.toLocaleString('ar')} مهارة إلى تركيز خطتك مع الحفاظ على بقية الخطة.`); qc.invalidateQueries({ queryKey: getGetAcademySkillSuggestionsQueryKey() }); qc.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() }); }, onError: e => setApplyMessage(errMessage(e)) }); }}>
              {apply.isPending ? 'جارٍ التطبيق…' : 'أضف المهارات إلى خطتي'}
            </button>
            {applyMessage && <span role="status" style={{ fontSize: 11, color: 'var(--ac-muted)' }}>{applyMessage}</span>}
          </div>
        </>}
     </section>
     <CommunityCoursesPanel/>
  </main>;
}

export function AcademySubjectPage() {
  const [, params] = useRoute('/academy/subjects/:subjectId');
  const id = params?.subjectId ?? '';
  const q = useGetAcademySubject(id);
  const enroll = useEnrollAcademySubject();
  const begin = useBeginAcademyExam();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [error, setError] = useState('');
  if (q.isLoading) return <div className="academy"><Loading/></div>;
  if (q.isError || !q.data) return <div className="academy"><State title="تعذّر فتح المادة" detail="قد تكون المادة غير متاحة حالياً." retry={() => q.refetch()}/></div>;
  const subject = q.data;
  return <main className="academy">
    <Head kicker="المواد التعليمية" title={subject.title} detail={subject.description} action={<Link href="/academy" className="ac-button"><ArrowLeft size={15}/> كل المواد</Link>}/>
    <div className="ac-tags">{subject.skillTags.map(tag => <span className="ac-tag" key={tag}>{tag}</span>)}</div>
    <section className="ac-panel">
      <div className="ac-meta"><span className="ac-chip">{subject.level}</span><span>{subject.completedLessons.toLocaleString('ar')} من {subject.lessonCount.toLocaleString('ar')} درس مكتمل</span></div>
      <div className="ac-progress"><span style={{ width: `${subject.lessonCount ? subject.completedLessons / subject.lessonCount * 100 : 0}%` }}/></div>
      {!subject.enrolled && <div className="ac-actions" style={{ marginTop: 14 }}>
        <button className="ac-button ac-button-primary" type="button" disabled={enroll.isPending} onClick={() => { setError(''); enroll.mutate({ subjectId: subject.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetAcademySubjectQueryKey(subject.id) }); qc.invalidateQueries({ queryKey: getListAcademySubjectsQueryKey() }); }, onError: e => setError(errMessage(e)) }); }}>{enroll.isPending ? 'جارٍ التسجيل…' : 'سجّل في المادة'}</button>
        {error && <span role="alert">{error}</span>}
      </div>}
    </section>
    <h2 style={{ fontSize: 18 }}>مسار الدروس</h2>
    {subject.lessons.length ? <ol className="ac-list">{subject.lessons.map((lesson, index) => <li className="ac-row" key={lesson.id}>
      <span className="ac-row-icon">{lesson.completed ? <Check size={18}/> : <span>{(index + 1).toLocaleString('ar')}</span>}</span>
      <div className="ac-row-copy"><b>{lesson.title}</b><small>{lesson.summary} · {lesson.estimatedMinutes.toLocaleString('ar')} دقيقة</small></div>
      {subject.enrolled && <Link className="ac-button" href={`/academy/lessons/${encodeURIComponent(lesson.id)}`}>{lesson.completed ? 'مراجعة الدرس' : 'افتح الدرس'} <ArrowLeft size={14}/></Link>}
    </li>)}</ol> : <State title="لا توجد دروس منشورة" detail="ستظهر الدروس هنا عند إتاحتها."/>}
    <h2 style={{ marginTop: 26, fontSize: 18 }}>الاختبارات</h2>
    {subject.exams.length ? <div className="ac-grid">{subject.exams.map(exam => <article className="ac-card" key={exam.id}>
      <span className="ac-chip">{exam.questionCount.toLocaleString('ar')} سؤال</span><h3>{exam.title}</h3><p>{exam.description}</p>
      <div className="ac-meta"><span>درجة الاجتياز {exam.passingScore.toLocaleString('ar')}٪</span><span>{exam.timeLimitSeconds ? `${Math.ceil(exam.timeLimitSeconds / 60).toLocaleString('ar')} دقيقة` : 'دون توقيت'}</span></div>
      {subject.enrolled && <button type="button" className="ac-button ac-button-primary" disabled={begin.isPending} onClick={() => { setError(''); begin.mutate({ examId: exam.id }, { onSuccess: attempt => navigate(`/academy/attempts/${encodeURIComponent(attempt.id)}`), onError: e => setError(errMessage(e)) }); }}>{begin.isPending ? 'جارٍ بدء الاختبار…' : 'ابدأ الاختبار'} <ArrowLeft size={14}/></button>}
    </article>)}</div> : <State title="لا توجد اختبارات متاحة" detail="ستظهر الاختبارات المنشورة بعد التسجيل في المادة."/>}
    {error && <p role="alert" style={{ color: '#a63e37' }}>{error}</p>}
  </main>;
}

export function AcademyLessonPage() {
  const [, params] = useRoute('/academy/lessons/:lessonId');
  const id = params?.lessonId ?? '';
  const q = useGetAcademyLesson(id);
  const complete = useCompleteAcademyLesson();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  if (q.isLoading) return <div className="academy"><Loading count={2}/></div>;
  if (q.isError || !q.data) return <div className="academy"><State title="تعذّر تحميل الدرس" detail="قد لا يكون هذا الدرس متاحاً لحسابك." retry={() => q.refetch()}/></div>;
  const lesson = q.data;
  return <main className="academy">
    <Head kicker={lesson.subjectTitle} title={lesson.title} detail={`${lesson.summary} · ${lesson.estimatedMinutes.toLocaleString('ar')} دقيقة`}/>
    <article className="ac-panel ac-prose">{lesson.body}</article>
    <section className="ac-panel"><h2 style={{ fontSize: 16 }}>مواد الدرس</h2>{lesson.files.length ? <ul className="ac-list">{lesson.files.map(file => <li className="ac-row" key={file.id}><span className="ac-row-icon"><FileText size={18}/></span><div className="ac-row-copy"><b>{file.title}</b><small>{file.originalName} · {formatSize(file.size)}</small>{!file.mime.startsWith('video/') && file.size > 10 * 1024 * 1024 && <small>مرفق كبير للقراءة والتنزيل، غير مفهرس للمساعد الذكي.</small>}</div>{file.mime.startsWith('video/') ? <AcademyVideoPlayer scope={`academy-lesson-${lesson.id}`} id={file.id} url={file.downloadUrl} title={file.title}/> : <a className="ac-button" href={file.downloadUrl} target="_blank" rel="noreferrer"><Download size={15}/> فتح الملف</a>}</li>)}</ul> : <p style={{ color: 'var(--ac-muted)', fontSize: 12 }}>لا توجد ملفات أو فيديوهات مرفقة بهذا الدرس.</p>}</section>
    <div className="ac-actions"><button type="button" className="ac-button ac-button-primary" disabled={lesson.completed || complete.isPending} onClick={() => { setMessage(''); complete.mutate({ lessonId: lesson.id }, { onSuccess: () => { setMessage('تم توثيق إكمال الدرس.'); qc.invalidateQueries({ queryKey: getGetAcademyLessonQueryKey(lesson.id) }); qc.invalidateQueries({ queryKey: getGetAcademySubjectQueryKey(lesson.subjectId) }); qc.invalidateQueries({ queryKey: getListAcademySubjectsQueryKey() }); }, onError: e => setMessage(errMessage(e)) }); }}>{lesson.completed ? <><CheckCircle2 size={16}/> أُكمل هذا الدرس</> : complete.isPending ? 'جارٍ الحفظ…' : 'أكملت قراءة الدرس'}</button><Link className="ac-button" href={`/academy/subjects/${encodeURIComponent(lesson.subjectId)}`}>العودة للمادة</Link>{message && <span role="status">{message}</span>}</div>
  </main>;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toLocaleString('ar', { minimumIntegerDigits: 2 })}:${(seconds % 60).toLocaleString('ar', { minimumIntegerDigits: 2 })}`;
}
export function AcademyAttemptPage() {
  const [, params] = useRoute('/academy/attempts/:attemptId');
  const id = params?.attemptId ?? '';
  const q = useGetAcademyAttempt(id);
  const submit = useSubmitAcademyAttempt();
  const mark = useMarkAcademyAttemptReviewed();
  const convert = useConvertAcademyAttemptToAchievement();
  const convertGrowth = useConvertAcademyGrowthToAchievement();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [reviewRead, setReviewRead] = useState(false);
  const [message, setMessage] = useState('');
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (!q.data?.timeLimitSeconds || q.data.submittedAt) return;
    const started = new Date(q.data.startedAt).getTime();
    const tick = () => setRemaining(Math.max(0, q.data!.timeLimitSeconds! - Math.floor((Date.now() - started) / 1000)));
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [q.data?.startedAt, q.data?.timeLimitSeconds, q.data?.submittedAt]);
  const attempt = q.data;
  const sendAnswers = (expired = false) => {
    if (!attempt || attempt.submittedAt || submit.isPending) return;
    const unanswered = attempt.questions.some(question => answers[question.id] === undefined);
    if (unanswered && !expired) { setMessage('أجب عن جميع الأسئلة قبل التسليم.'); return; }
    const answeredQuestions = attempt.questions.filter(question => answers[question.id] !== undefined);
    if (!answeredQuestions.length) { setMessage('انتهى الوقت، لكن لا توجد إجابات لإرسالها. أعد المحاولة عند الاستعداد.'); return; }
    autoSubmitted.current = true;
    submit.mutate({ attemptId: attempt.id, data: { answers: answeredQuestions.map(question => ({ questionId: question.id, selectedOption: answers[question.id] })) } }, { onSuccess: () => { setMessage(expired ? 'انتهى الوقت وتم تسليم الإجابات المسجلة.' : 'تم تسليم إجاباتك.'); qc.invalidateQueries({ queryKey: getGetAcademyAttemptQueryKey(attempt.id) }); }, onError: e => { autoSubmitted.current = false; setMessage(errMessage(e)); } });
  };
  useEffect(() => { if (remaining === 0 && attempt && !attempt.submittedAt && !autoSubmitted.current) sendAnswers(true); }, [remaining, attempt?.id, attempt?.submittedAt]);
  if (q.isLoading) return <div className="academy"><Loading count={3}/></div>;
  if (q.isError || !attempt) return <div className="academy"><State title="تعذّر فتح الاختبار" detail="تحقق من الرابط أو أعد المحاولة." retry={() => q.refetch()}/></div>;
  const done = !!attempt.submittedAt;
  return <main className="academy">
    <Head kicker="اختبار أكاديمي" title={attempt.examTitle} detail={done ? 'راجع الإجابات والتفسيرات لتوثيق ما تعلّمته.' : 'اختر إجابة لكل سؤال. لا تظهر الإجابات الصحيحة قبل التسليم.'} action={!done && attempt.timeLimitSeconds ? <span className="ac-chip"><Clock3 size={14}/> {formatTime(remaining ?? attempt.timeLimitSeconds)}</span> : undefined}/>
    {done && <section className="ac-hero"><div><span className="ac-kicker">نتيجتك</span><h2>{attempt.score === null ? 'اكتملت المحاولة' : `${attempt.score.toLocaleString('ar')}٪`}</h2><p>أكمل مراجعة الأسئلة وتفسيراتها قبل توثيق المراجعة.</p></div><div className="ac-hero-mark"><Award size={34}/></div></section>}
    {!done ? <form onSubmit={e => { e.preventDefault(); sendAnswers(); }}>
      <div className="ac-list">{attempt.questions.map((question, index) => <fieldset className="ac-question" key={question.id}>
        <legend className="ac-sr">السؤال {index + 1}</legend><h3><span className="ac-chip">{(index + 1).toLocaleString('ar')}</span> {question.prompt}</h3>
        <div className="ac-options">{question.options.map((option, optionIndex) => <label className="ac-option" key={`${question.id}-${optionIndex}`}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(v => ({ ...v, [question.id]: optionIndex }))}/><span>{option}</span></label>)}</div>
      </fieldset>)}</div>
      {message && <p role="alert">{message}</p>}
      <button className="ac-button ac-button-primary" type="submit" disabled={submit.isPending}>{submit.isPending ? 'جارٍ تسليم الإجابات…' : 'تسليم الاختبار'} <Check size={15}/></button>
    </form> : <>
      <div className="ac-list" style={{ marginTop: 18 }}>{attempt.review.map((item, index) => <article className={`ac-question ${item.isCorrect ? 'ac-review-good' : 'ac-review-bad'}`} key={item.questionId}>
        <h3>{(index + 1).toLocaleString('ar')}. {item.prompt}</h3><p style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--ac-muted)' }}>إجابتك: {item.selectedOption === null ? 'لم تُجب' : item.options[item.selectedOption]}</p><p style={{ fontSize: 12, lineHeight: 1.8 }}><b>الإجابة الصحيحة:</b> {item.options[item.correctOption]}</p><p style={{ fontSize: 12, lineHeight: 1.9, margin: 0 }}>{item.explanation}</p>
      </article>)}</div>
      {!attempt.reviewedAt && <label className="ac-privacy" style={{ marginTop: 14 }}><input type="checkbox" checked={reviewRead} onChange={e => setReviewRead(e.target.checked)}/> <span>قرأت مراجعة جميع الأسئلة وتفسيرات الإجابات.</span></label>}
      {message && <p role="status">{message}</p>}
      {!attempt.reviewedAt && <button className="ac-button ac-button-primary" type="button" disabled={!reviewRead || mark.isPending} onClick={() => mark.mutate({ attemptId: attempt.id }, { onSuccess: () => { setMessage('تم توثيق مراجعة الاختبار.'); qc.invalidateQueries({ queryKey: getGetAcademyAttemptQueryKey(attempt.id) }); }, onError: e => setMessage(errMessage(e)) })}>{mark.isPending ? 'جارٍ التوثيق…' : 'أكملت مراجعة الاختبار'}</button>}
      {attempt.canConvertAchievement && attempt.score !== null && attempt.score >= 85 && <section className="ac-panel"><h3>حوّل نتيجتك إلى إنجاز موثّق</h3><p style={{ color: 'var(--ac-muted)', fontSize: 12, lineHeight: 1.8 }}>سيُضاف إنجاز إلى ملفك المهني بناءً على هذه المحاولة.</p><button className="ac-button ac-button-primary" disabled={convert.isPending} type="button" onClick={() => convert.mutate({ attemptId: attempt.id }, { onSuccess: () => { setMessage('تمت إضافة الإنجاز إلى ملفك.'); qc.invalidateQueries({ queryKey: getGetAcademyAttemptQueryKey(attempt.id) }); qc.invalidateQueries({ queryKey: getListAchievementsQueryKey() }); }, onError: e => setMessage(errMessage(e)) })}>{convert.isPending ? 'جارٍ الإضافة…' : 'أضف النتيجة إلى إنجازاتي'} <Award size={15}/></button></section>}
      {attempt.improvement && !attempt.improvement.achievementId && <section className="ac-panel"><h3>تحسّن موثّق في المحاولة</h3><p style={{ color: 'var(--ac-muted)', fontSize: 12 }}>من {attempt.improvement.fromScore.toLocaleString('ar')}٪ إلى {attempt.improvement.toScore.toLocaleString('ar')}٪</p><button type="button" className="ac-button" disabled={convertGrowth.isPending} onClick={() => convertGrowth.mutate({ evidenceId: attempt.improvement!.id }, { onSuccess: () => { setMessage('تم توثيق التحسّن كإنجاز.'); qc.invalidateQueries({ queryKey: getGetAcademyAttemptQueryKey(attempt.id) }); qc.invalidateQueries({ queryKey: getListAchievementsQueryKey() }); }, onError: e => setMessage(errMessage(e)) })}>{convertGrowth.isPending ? 'جارٍ التوثيق…' : 'وثّق تحسّني كإنجاز'} <Sparkles size={15}/></button></section>}
    </>}
  </main>;
}

export function AcademySearchPage() {
  const [loc] = useLocation();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(loc.split('?')[1] ?? ''), [loc]);
  const query = params.get('q')?.trim() ?? '';
  const searchParams = useMemo(() => ({ q: query }), [query]);
  const q = useSearchAcademy(searchParams, { query: { queryKey: getSearchAcademyQueryKey(searchParams), enabled: query.length > 0 } });
  return <main className="academy"><Head title="بحث في مصادر التعلّم" detail="نتائج من الدروس المنشورة وملفاتك الخاصة، مع رابط مباشر إلى المصدر."/>
    <form className="ac-form ac-panel" onSubmit={e => { e.preventDefault(); const val = new FormData(e.currentTarget).get('q')?.toString().trim(); if (val) navigate(`/academy/search?q=${encodeURIComponent(val)}`); }}>
      <Search size={18}/><input className="ac-input" name="q" aria-label="عبارة البحث" defaultValue={query} placeholder="اكتب عبارة للبحث"/><button className="ac-button ac-button-primary" disabled={!query}>بحث</button>
    </form>
    {!query ? <State title="اكتب ما تبحث عنه" detail="سيظهر هنا نص مطابق مع رابط إلى الدرس أو الملف المصدر."/> : q.isLoading ? <Loading/> : q.isError ? <State title="تعذّر إكمال البحث" detail="حاول مرة أخرى." retry={() => q.refetch()}/> : !q.data?.length ? <State title="لا توجد مقاطع مطابقة" detail="جرّب كلمات أخرى أو تأكد من وجود الدروس والملفات المناسبة."/> :
      <><p className="ac-meta">{q.data.length.toLocaleString('ar')} نتيجة لعبارة «{query}»</p><div className="ac-list">{q.data.map((source: AcademySearchSource) => <article className="ac-card" key={`${source.sourceType}-${source.id}-${source.position}`}><div className="ac-meta"><span className="ac-chip">{source.sourceType === 'lesson' ? 'درس' : source.sourceType === 'course_file' ? 'ملف مقرر' : 'ملفك الخاص'}</span><span>{source.title}</span></div><p className="ac-citation">{source.excerpt}</p><a className="ac-button" href={source.href}>افتح المصدر <ArrowLeft size={14}/></a></article>)}</div></>}
  </main>;
}

export function AcademyAssistantPage() {
  const subjects = useListAcademySubjects();
  const ask = useAskAcademyAssistant();
  const [question, setQuestion] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [consent, setConsent] = useState(false);
  const [response, setResponse] = useState<AcademyAssistantResponse | null>(null);
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); if (question.trim().length < 3) return; setError(''); setResponse(null); ask.mutate({ data: { question: question.trim(), subjectId: subjectId || null, allowOpenAi: consent } }, { onSuccess: result => setResponse(result), onError: err => setError(errMessage(err)) }); };
  const validCitations = response?.citations.filter(c => c.href && c.excerpt) ?? [];
  return <main className="academy"><Head title="اسأل مساعد المذاكرة" detail="إجابة تستند إلى موادك ومصادرك فقط. عند غياب الدليل المناسب، سنخبرك بذلك."/>
    {subjects.isError && <p role="alert" className="ac-meta">تعذّر تحميل قائمة المواد؛ يمكنك السؤال دون تحديد مادة.</p>}
    <form className="ac-panel ac-form-stack" onSubmit={submit}>
      <label className="ac-field"><span>سؤالك <RequiredMark/></span><textarea rows={4} minLength={3} maxLength={2000} required value={question} onChange={e => setQuestion(e.target.value)} placeholder="اسأل عن مفهوم أو فكرة وردت في مصادرك"/></label>
      <label className="ac-field">تقييد الإجابة بمادة<select value={subjectId} onChange={e => setSubjectId(e.target.value)}><option value="">كل المصادر المتاحة</option>{subjects.data?.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <label className="ac-privacy"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span><b>أوافق على استخدام OpenAI لهذا السؤال.</b><br/>عند تفعيل الخيار، تُرسل المقاطع المطابقة فقط عبر Replit AI Integrations، ويُستهلك ذلك من أرصدة Replit. يبقى هذا الخيار غير محدد حتى توافق صراحة.</span></label>
      <button className="ac-button ac-button-primary" type="submit" disabled={ask.isPending || question.trim().length < 3}>{ask.isPending ? 'جارٍ البحث في المصادر…' : 'ابحث عن إجابة موثّقة'} <Send size={15}/></button>
    </form>
    {error && <State title="لم تكتمل الإجابة" detail={error}/>}
    {response && (response.notFound || !validCitations.length) ? <State title="لم يُعثر على إجابة موثّقة" detail="لم نجد مقاطع صالحة للاستشهاد في مصادرك. جرّب سؤالاً آخر أو راجع الملفات والدروس."/> :
      response && <section className="ac-panel"><div className="ac-meta"><ShieldCheck size={17}/><b>إجابة مرتبطة بمصادرك</b></div><div className="ac-answer">{response.answer}</div><h3 style={{ fontSize: 14, marginTop: 18 }}>المقاطع المستشهد بها</h3>{validCitations.map((citation, i) => <a className="ac-citation" href={citation.href} key={`${citation.id}-${i}`}><b>{citation.title}</b><br/>{citation.excerpt}</a>)}</section>}
  </main>;
}

function studentFileMime(name: string): AcademyStudentFileInputMime | null {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  const additional: Record<string, AcademyStudentFileInputMime> = {
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc: 'application/msword', ppt: 'application/vnd.ms-powerpoint', xls: 'application/vnd.ms-excel',
    csv: 'text/csv', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
    m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
  };
  if (ext && additional[ext]) return additional[ext];
  return null;
}
export function AcademyFilesPage() {
  const q = useListAcademyFiles();
  const request = useRequestAcademyFileUpload();
  const confirm = useConfirmAcademyFileUpload();
  const del = useDeleteAcademyFile();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{
    name: string; percent: number; index: number; total: number;
    stage: 'preparing' | 'uploading' | 'confirming';
  } | null>(null);
  const [quizFile, setQuizFile] = useState<AcademyStudentFile | null>(null);
  const [guideFile, setGuideFile] = useState<AcademyStudentFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true); setMessage('');
    setUploadProgress(null);
    let uploadedCount = 0;
    const failures: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const mime = studentFileMime(file.name);
        if (!mime) { failures.push(`${file.name} (نوع غير مدعوم)`); continue; }
        if (!Number.isSafeInteger(file.size) || file.size < 1) { failures.push(`${file.name} (الملف فارغ أو حجمه غير صالح)`); continue; }
        try {
          setUploadProgress({ name: file.name, percent: 0, index: index + 1, total: files.length, stage: 'preparing' });
          const signed = await request.mutateAsync({ data: { originalName: file.name.slice(0, 180), mime, size: file.size } });
          setUploadProgress({ name: file.name, percent: 0, index: index + 1, total: files.length, stage: 'uploading' });
          await uploadFile(signed.uploadUrl, file, mime, percent => {
            setUploadProgress({ name: file.name, percent, index: index + 1, total: files.length, stage: 'uploading' });
          });
          setUploadProgress({ name: file.name, percent: 100, index: index + 1, total: files.length, stage: 'confirming' });
          await confirm.mutateAsync({ fileId: signed.id });
          uploadedCount += 1;
        } catch {
          failures.push(file.name);
        }
      }
      if (uploadedCount) void qc.invalidateQueries({ queryKey: getListAcademyFilesQueryKey() });
      const failureMessage = failures.length ? ` تعذّر رفع ${failures.length.toLocaleString('ar')}: ${failures.slice(0, 3).join('، ')}${failures.length > 3 ? '…' : ''}.` : '';
      setMessage(uploadedCount
        ? `أُضيف ${uploadedCount.toLocaleString('ar')} ملف${uploadedCount > 1 ? 'ات' : ''} إلى مكتبتك الخاصة.${failureMessage}`
        : `لم يكتمل رفع الملفات.${failureMessage}`);
    } finally { setBusy(false); setUploadProgress(null); if (inputRef.current) inputRef.current.value = ''; }
  }
  return <main className="academy"><Head title="مكتبتك وأدوات المذاكرة" detail="ارفع محاضراتك، لخّصها، اختبر فهمك، وتابع تقدّمك التدريبي." action={<button className="ac-button ac-button-primary" type="button" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={15}/>{busy ? 'جارٍ رفع الملفات…' : 'أضف ملفات'}</button>}/>
    <input ref={inputRef} className="ac-sr" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mp3,.m4a,.wav,.ogg" onChange={e => void upload(Array.from(e.target.files ?? []))}/>
    <div className="ac-privacy"><LockKeyhole size={17}/><span>ارفع PDF وWord وPowerPoint وExcel وCSV وTXT والصور، أو صوت MP3 وM4A وWAV وOGG وفيديو MP4 وWebM. لا نضع حد ١٠ م.ب للحفظ؛ حدود التخزين والاتصال الفعلية تظل سارية. التلخيص والاختبارات للملفات المقروءة والصور حتى ١٠ م.ب؛ الملفات القديمة والصوت والفيديو للتنزيل فقط حاليًا. ملفاتك خاصة، ولا يُرسل المحتوى إلى OpenAI إلا بموافقتك، ولا تُضاف نتائج التدريب إلى السيرة.</span></div>
    {message && <p role="status" className="ac-meta">{message}</p>}
    {uploadProgress && <div className="ac-upload-progress" role="status" aria-live="polite" data-testid="status-academy-file-upload">
      <div className="ac-upload-progress-head">
        <span>{uploadProgress.stage === 'preparing' ? 'جارٍ تجهيز الرفع' : uploadProgress.stage === 'confirming' ? 'اكتمل النقل، جارٍ حفظ الملف' : 'جارٍ رفع الملف'} · الملف {uploadProgress.index.toLocaleString('ar')} من {uploadProgress.total.toLocaleString('ar')}</span>
        {uploadProgress.stage !== 'preparing' && <strong>{uploadProgress.percent.toLocaleString('ar')}٪</strong>}
      </div>
      <progress max={100} value={uploadProgress.stage === 'preparing' ? undefined : uploadProgress.percent} aria-label="نسبة رفع الملف"/>
      <small dir="auto">{uploadProgress.name}</small>
    </div>}
    {q.isLoading ? <Loading/> : q.isError ? <State title="تعذّر تحميل ملفاتك" detail="أعد المحاولة بعد التحقق من الاتصال." retry={() => q.refetch()}/> : !q.data?.length ? <State title="مكتبتك فارغة" detail="أضف ملفاً تعليمياً للبحث في محتواه الخاص."/> :
      <ul className="ac-list" style={{ marginTop: 14 }}>{q.data.map((file: AcademyStudentFile) => <li className="ac-row ac-file-row" key={file.id}>
        <span className="ac-row-icon">{file.mime.startsWith('image/') ? <ImageIcon size={18}/> : <FileText size={18}/>}</span>
         <div className="ac-row-copy"><b>{file.originalName}</b><small>{file.originalName.split('.').pop()?.toUpperCase()} · {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString('ar')}</small><small>{file.studyMessage}</small></div>
        {file.mime.startsWith('image/') && <a className="ac-file-thumb" href={`/api/academy/files/${encodeURIComponent(file.id)}/preview`} target="_blank" rel="noreferrer" aria-label={`عرض ${file.originalName}`}><img src={`/api/academy/files/${encodeURIComponent(file.id)}/preview`} alt={file.originalName} loading="lazy"/></a>}
        <div className="ac-actions">
          <a className="ac-button" href={`/api/academy/files/${encodeURIComponent(file.id)}/download`}><Download size={14}/> تنزيل</a>
           <button className="ac-button" type="button" disabled={file.studyAvailable === false} title={file.studyMessage} onClick={() => setGuideFile(guideFile?.id === file.id ? null : file)}><FileText size={14}/>{guideFile?.id === file.id ? 'إغلاق الملخص' : 'ملخص ذكي'}</button>
           <button className="ac-button" type="button" disabled={file.studyAvailable === false} title={file.studyMessage} onClick={() => setQuizFile(quizFile?.id === file.id ? null : file)}><Sparkles size={14}/>{quizFile?.id === file.id ? 'إغلاق الاختبار' : 'اختبر مستواك'}</button>
          <button className="ac-button ac-button-danger" type="button" aria-label={`حذف ${file.originalName}`} disabled={del.isPending} onClick={() => { if (window.confirm(`حذف الملف «${file.originalName}»؟ سيُحذف أيضًا الملخص وسجل الاختبارات الخاصان به.`)) del.mutate({ fileId: file.id }, { onSuccess: () => { setQuizFile(null); setGuideFile(null); qc.invalidateQueries({ queryKey: getListAcademyFilesQueryKey() }); }, onError: e => setMessage(errMessage(e)) }); }}><Trash2 size={14}/> حذف</button>
        </div>
        {guideFile?.id === file.id && <AcademyFileStudyGuide key={`guide-${file.id}`} file={file}/>}
        {quizFile?.id === file.id && <AcademyFileQuizBuilder key={file.id} file={file}/>}
      </li>)}</ul>}
  </main>;
}
