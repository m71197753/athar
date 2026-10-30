import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileText, Pencil, Plus, Save, Trash2, Upload } from 'lucide-react';
import { RequiredMark } from '../components/RequiredMark';
import {
  getListAdminAcademyQueryKey, getListAdminAcademyCourseSubmissionsQueryKey, useConfirmAdminAcademyCourseFile,
  useCreateAdminAcademyExam, useCreateAdminAcademyLesson, useCreateAdminAcademySubject,
  useDeleteAdminAcademyCourseFile, useListAdminAcademy, useListAdminAcademyCourseSubmissions,
  useRequestAdminAcademyCourseFileUpload, useReviewAdminAcademyCourseSubmission,
  useSaveAdminAcademyQuestions, useUpdateAdminAcademyExam, useUpdateAdminAcademyLesson,
  useUpdateAdminAcademySubject,
} from '@workspace/api-client-react';
import type {
  AcademyAdminSubject, AcademyExamInput, AcademyLessonInput, AcademyQuestionInput, AcademySubjectInput,
  AcademyCourseFileInputMime,
} from '@workspace/api-client-react';
import './academy.css';
import { uploadFile } from '../lib/upload-file';

type Section = 'subjects' | 'lessons' | 'exams' | 'submissions';
const blankSubject: AcademySubjectInput = { slug: '', title: '', description: '', level: 'beginner', skillTags: [], position: 0, published: false };
const blankQuestion = (): AcademyQuestionInput => ({ prompt: '', options: ['', ''], correctOption: 0, explanation: '', skillTags: [] });
function displayError(error: unknown) {
  const code = typeof error === 'object' && error && 'status' in error ? Number((error as { status: unknown }).status) : 0;
  return code === 401 || code === 403 ? 'ليست لديك صلاحية لهذا الإجراء.' : 'تعذّر حفظ التغييرات. راجع البيانات وحاول مجدداً.';
}
function AdminState({ text }: { text: string }) { return <div className="ac-state" role="alert"><b>{text}</b></div>; }
function AdminSkeleton() { return <div className="ac-skeleton" role="status" aria-label="جارٍ تحميل بيانات المذاكرة"><i/><i/><i/></div>; }
function fileMime(name: string): AcademyCourseFileInputMime | null {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  return null;
}
const field = (label: string, value: string, onChange: (value: string) => void, props: { type?: string; required?: boolean; maxLength?: number; min?: number; max?: number; dir?: string } = {}) =>
  <label className="ac-field"><span>{label}{props.required && <RequiredMark/>}</span><input value={value} onChange={e => onChange(e.target.value)} {...props}/></label>;

export function AcademyAdminPanel({ focusSubmissions = false }: { focusSubmissions?: boolean }) {
  const catalog = useListAdminAcademy();
  const createSubject = useCreateAdminAcademySubject();
  const updateSubject = useUpdateAdminAcademySubject();
  const createLesson = useCreateAdminAcademyLesson();
  const updateLesson = useUpdateAdminAcademyLesson();
  const createExam = useCreateAdminAcademyExam();
  const updateExam = useUpdateAdminAcademyExam();
  const saveQuestions = useSaveAdminAcademyQuestions();
  const requestFile = useRequestAdminAcademyCourseFileUpload();
  const confirmFile = useConfirmAdminAcademyCourseFile();
  const deleteFile = useDeleteAdminAcademyCourseFile();
  const submissions = useListAdminAcademyCourseSubmissions();
  const reviewSubmission = useReviewAdminAcademyCourseSubmission();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>('subjects');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [subjectForm, setSubjectForm] = useState<AcademySubjectInput | null>(null);
  const [lessonForm, setLessonForm] = useState<AcademyLessonInput | null>(null);
  const [examForm, setExamForm] = useState<AcademyExamInput | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState('');
  const [editingLessonId, setEditingLessonId] = useState('');
  const [editingExamId, setEditingExamId] = useState('');
  const [questions, setQuestions] = useState<AcademyQuestionInput[]>([]);
  const [examQuestionsChanged, setExamQuestionsChanged] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (focusSubmissions) setSection('submissions');
  }, [focusSubmissions]);

  const subjects = catalog.data?.subjects ?? [];
  const selectedSubject = useMemo(() => subjects.find(s => s.id === selectedSubjectId) ?? subjects[0], [subjects, selectedSubjectId]);
  const selectedLesson = useMemo(() => selectedSubject?.lessons.find(l => l.id === selectedLessonId), [selectedSubject, selectedLessonId]);
  const invalidate = () => qc.invalidateQueries({ queryKey: getListAdminAcademyQueryKey() });
  const startNewSubject = () => { setEditingSubjectId(''); setSubjectForm({ ...blankSubject }); setError(''); setMessage(''); };
  const editSubject = (subject: AcademyAdminSubject) => { setEditingSubjectId(subject.id); setSubjectForm({ slug: subject.slug, title: subject.title, description: subject.description, level: subject.level as AcademySubjectInput['level'], skillTags: subject.skillTags, position: subject.position, published: subject.published }); setError(''); };
  const startNewLesson = () => { if (!selectedSubject) return; setEditingLessonId(''); setLessonForm({ subjectId: selectedSubject.id, title: '', summary: '', body: '', position: selectedSubject.lessons.length, estimatedMinutes: 10, published: false }); setError(''); };
  const editLesson = (lesson: AcademyAdminSubject['lessons'][number]) => { setEditingLessonId(lesson.id); setSelectedLessonId(lesson.id); setLessonForm({ subjectId: lesson.subjectId, title: lesson.title, summary: lesson.summary, body: lesson.body, position: lesson.position, estimatedMinutes: lesson.estimatedMinutes, published: lesson.published }); setError(''); };
  const startNewExam = () => { if (!selectedSubject) return; setEditingExamId(''); setExamForm({ subjectId: selectedSubject.id, lessonId: null, title: '', description: '', timeLimitSeconds: null, passingScore: 60, published: false }); setQuestions([]); setExamQuestionsChanged(true); setError(''); };
  const editExam = (exam: AcademyAdminSubject['exams'][number]) => { setEditingExamId(exam.id); setExamForm({ subjectId: exam.subjectId, lessonId: exam.lessonId, title: exam.title, description: exam.description, timeLimitSeconds: exam.timeLimitSeconds, passingScore: exam.passingScore, published: exam.published }); setQuestions(exam.questions.map(q => ({ prompt: q.prompt, options: [...q.options], correctOption: q.correctOption, explanation: q.explanation, skillTags: [...q.skillTags] }))); setExamQuestionsChanged(false); setError(''); };
  const saveSubject = (e: FormEvent) => {
    e.preventDefault(); if (!subjectForm) return;
    const data = { ...subjectForm, slug: subjectForm.slug.trim(), title: subjectForm.title.trim(), description: subjectForm.description.trim(), skillTags: subjectForm.skillTags.map(s => s.trim()).filter(Boolean) };
    setError('');
    const ok = { onSuccess: () => { invalidate(); setSubjectForm(null); setMessage('تم حفظ المادة.'); }, onError: (er: unknown) => setError(displayError(er)) };
    if (editingSubjectId) updateSubject.mutate({ subjectId: editingSubjectId, data }, ok); else createSubject.mutate({ data }, ok);
  };
  const saveLesson = (e: FormEvent) => {
    e.preventDefault(); if (!lessonForm) return;
    setError('');
    const ok = { onSuccess: () => { invalidate(); setLessonForm(null); setMessage('تم حفظ الدرس.'); }, onError: (er: unknown) => setError(displayError(er)) };
    if (editingLessonId) updateLesson.mutate({ lessonId: editingLessonId, data: lessonForm }, ok); else createLesson.mutate({ data: lessonForm }, ok);
  };
  const saveExam = (e: FormEvent) => {
    e.preventDefault(); if (!examForm) return;
    if (examForm.published && (questions.length < 10 || questions.length > 200 || questions.some(q => q.prompt.trim().length < 5 || q.explanation.trim().length < 5))) {
      setError('لا يمكن نشر الاختبار قبل إضافة ١٠ أسئلة على الأقل (وبحد أقصى ٢٠٠)، مع تفسير مكتمل لكل سؤال.'); return;
    }
    const data = { ...examForm, title: examForm.title.trim(), description: examForm.description.trim() };
    setError('');
    const finalize = (examId: string) => {
      const finish = () => {
        if (!data.published) { invalidate(); setExamForm(null); setMessage('تم حفظ الاختبار وأسئلته.'); return; }
        updateExam.mutate({ examId, data }, {
          onSuccess: () => { invalidate(); setExamForm(null); setMessage('تم حفظ الاختبار ونشره.'); },
          onError: er => setError(displayError(er)),
        });
      };
      if (!examQuestionsChanged || !questions.length) { finish(); return; }
      saveQuestions.mutate({ examId, data: { questions } }, { onSuccess: finish, onError: er => setError(displayError(er)) });
    };
    const safeToEdit = { ...data, published: false };
    if (editingExamId) updateExam.mutate({ examId: editingExamId, data: safeToEdit }, { onSuccess: result => finalize(result.id), onError: er => setError(displayError(er)) });
    else createExam.mutate({ data: safeToEdit }, { onSuccess: result => finalize(result.id), onError: er => setError(displayError(er)) });
  };
  async function uploadCourseFiles(files: File[]) {
    if (!files.length || !selectedLesson || uploadBusy) return;
    const lessonId = selectedLesson.id;
    const selected = files.map(file => ({ file, mime: fileMime(file.name) }));
    if (selected.some(({ file, mime }) => !mime || file.size < 1 || !Number.isSafeInteger(file.size))) {
      setError('اختر ملفات غير فارغة بصيغ PDF وDOCX وTXT وMP4 وWebM.'); return;
    }
    setUploadBusy(true); setError('');
    let completed = 0;
    try {
      for (const [index, { file, mime }] of selected.entries()) {
        setUploadPercent(0);
        setUploadLabel(`${index + 1} من ${selected.length}: ${file.name}`);
        const signed = await requestFile.mutateAsync({ lessonId, data: { title: file.name.slice(0, 160), originalName: file.name.slice(0, 180), mime: mime!, size: file.size } });
        await uploadFile(signed.uploadUrl, file, mime!, setUploadPercent);
        setUploadLabel(`جارٍ التحقق من ${file.name}`);
        await confirmFile.mutateAsync({ fileId: signed.id });
        completed++;
      }
      setMessage(`تم إرفاق ${completed.toLocaleString('ar')} ملف بالدرس.`);
    } catch {
      setError(`تعذّر إكمال الرفع. تم حفظ ${completed.toLocaleString('ar')} ملف بنجاح؛ أعد اختيار الملفات المتبقية فقط.`);
    } finally {
      if (completed) await invalidate();
      setUploadBusy(false);
    }
  }

  if (catalog.isLoading) return <div className="academy ac-admin"><AdminSkeleton/></div>;
  if (catalog.isError || !catalog.data) return <div className="academy ac-admin"><AdminState text="تعذّر تحميل مواد المذاكرة."/><button className="ac-button" type="button" onClick={() => catalog.refetch()}>إعادة المحاولة</button></div>;
  const busy = createSubject.isPending || updateSubject.isPending || createLesson.isPending || updateLesson.isPending || createExam.isPending || updateExam.isPending || saveQuestions.isPending;
  const setQuestion = (index: number, update: (q: AcademyQuestionInput) => AcademyQuestionInput) => setQuestions(old => old.map((q, i) => i === index ? update(q) : q));
  return <main className="academy ac-admin">
    <div className="ac-head"><div><span className="ac-kicker">إدارة المحتوى التعليمي</span><h1>إدارة المذاكرة</h1><p>إدارة المواد والدروس والاختبارات ومرفقاتها، مع التحقق من شروط النشر.</p></div><button type="button" className="ac-button ac-button-primary" onClick={startNewSubject}><Plus size={15}/> مادة جديدة</button></div>
     <nav className="ac-admin-tabs" aria-label="محتوى المذاكرة">{([['subjects','المواد'],['lessons','الدروس'],['exams','الاختبارات'],['submissions','مشاركات الأعضاء']] as const).map(([key,label]) => <button key={key} className={`ac-button ${section === key ? 'ac-button-primary' : ''}`} type="button" onClick={() => { setSection(key); setError(''); setMessage(''); }}>{label}</button>)}</nav>
    {(error || message) && <p role={error ? 'alert' : 'status'} style={{ color: error ? '#a63e37' : 'var(--ac-teal)', fontSize: 12 }}>{error || message}</p>}
     {(section === 'lessons' || section === 'exams') && <label className="ac-field" style={{ marginBottom: 13 }}>المادة<select value={selectedSubject?.id ?? ''} onChange={e => { setSelectedSubjectId(e.target.value); setSelectedLessonId(''); setLessonForm(null); setExamForm(null); }}><option value="">اختر مادة</option>{subjects.map(s => <option value={s.id} key={s.id}>{s.title}{s.published ? '' : ' — مسودة'}</option>)}</select></label>}
    {section === 'subjects' && <>
      {subjectForm && <form className="ac-admin-section ac-form-stack" onSubmit={saveSubject}><h3>{editingSubjectId ? 'تعديل مادة' : 'إنشاء مادة'}</h3>
        <div className="ac-grid">
          {field('المعرّف المختصر', subjectForm.slug, slug => setSubjectForm({ ...subjectForm, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') }), { required: true, maxLength: 80, dir: 'ltr' })}
          {field('عنوان المادة', subjectForm.title, title => setSubjectForm({ ...subjectForm, title }), { required: true, maxLength: 160 })}
          <label className="ac-field">المستوى<select value={subjectForm.level} onChange={e => setSubjectForm({ ...subjectForm, level: e.target.value as AcademySubjectInput['level'] })}><option value="beginner">مبتدئ</option><option value="intermediate">متوسط</option><option value="advanced">متقدم</option></select></label>
          {field('ترتيب العرض', String(subjectForm.position), value => setSubjectForm({ ...subjectForm, position: Number(value) || 0 }), { type: 'number', min: 0, max: 10000 })}
        </div>
        <label className="ac-field">الوصف<textarea rows={3} maxLength={1000} value={subjectForm.description} onChange={e => setSubjectForm({ ...subjectForm, description: e.target.value })}/></label>
        <label className="ac-field">المهارات، افصل بينها بفاصلة<textarea rows={2} maxLength={2000} value={subjectForm.skillTags.join('، ')} onChange={e => setSubjectForm({ ...subjectForm, skillTags: e.target.value.split(/[,،]/).map(s => s.trim()).filter(Boolean) })}/></label>
        <label className="ac-privacy"><input type="checkbox" checked={subjectForm.published} onChange={e => setSubjectForm({ ...subjectForm, published: e.target.checked })}/><span>نشر المادة للطلاب</span></label>
        <div className="ac-actions"><button className="ac-button ac-button-primary" type="submit" disabled={busy}><Save size={14}/>حفظ المادة</button><button className="ac-button" type="button" onClick={() => setSubjectForm(null)}>إلغاء</button></div>
      </form>}
      {subjects.length ? <div className="ac-list">{subjects.map(subject => <article className="ac-row" key={subject.id}><span className="ac-row-icon"><BookOpen size={18}/></span><div className="ac-row-copy"><b>{subject.title}</b><small dir="ltr">{subject.slug} · {subject.published ? 'منشورة' : 'مسودة'} · {subject.lessons.length.toLocaleString('ar')} درس · {subject.exams.length.toLocaleString('ar')} اختبار</small></div><button className="ac-button" type="button" onClick={() => editSubject(subject)}><Pencil size={14}/> تعديل</button></article>)}</div> : <AdminState text="لا توجد مواد بعد. أنشئ مادة جديدة للبدء."/>}
    </>}
    {section === 'lessons' && selectedSubject && <>
      <div className="ac-actions" style={{ marginBottom: 12 }}><button type="button" className="ac-button ac-button-primary" onClick={startNewLesson}><Plus size={14}/> درس جديد</button></div>
      {lessonForm && <form className="ac-admin-section ac-form-stack" onSubmit={saveLesson}><h3>{editingLessonId ? 'تعديل الدرس' : 'إنشاء درس'}</h3>
        {field('عنوان الدرس', lessonForm.title, title => setLessonForm({ ...lessonForm, title }), { required: true, min: 2, maxLength: 200 })}
        {field('ملخص', lessonForm.summary, summary => setLessonForm({ ...lessonForm, summary }), { maxLength: 1000 })}
         <label className="ac-field"><span>محتوى الدرس <RequiredMark/></span><textarea required minLength={20} maxLength={100000} rows={12} value={lessonForm.body} onChange={e => setLessonForm({ ...lessonForm, body: e.target.value })}/></label>
        <div className="ac-grid">{field('موضع الدرس', String(lessonForm.position), v => setLessonForm({ ...lessonForm, position: Number(v) || 0 }), { type: 'number', min: 0, max: 10000 })}{field('المدة بالدقائق', String(lessonForm.estimatedMinutes), v => setLessonForm({ ...lessonForm, estimatedMinutes: Number(v) || 1 }), { type: 'number', min: 1, max: 300 })}</div>
        <label className="ac-privacy"><input type="checkbox" checked={lessonForm.published} onChange={e => setLessonForm({ ...lessonForm, published: e.target.checked })}/><span>نشر الدرس للطلاب</span></label>
        <div className="ac-actions"><button className="ac-button ac-button-primary" type="submit" disabled={busy}><Save size={14}/>حفظ الدرس</button><button className="ac-button" type="button" onClick={() => setLessonForm(null)}>إلغاء</button></div>
      </form>}
      {selectedSubject.lessons.length ? <ul className="ac-list">{selectedSubject.lessons.map(lesson => <li className="ac-row" key={lesson.id}><span className="ac-row-icon"><FileText size={18}/></span><div className="ac-row-copy"><b>{lesson.title}</b><small>{lesson.published ? 'منشور' : 'مسودة'} · {lesson.estimatedMinutes.toLocaleString('ar')} دقيقة</small></div><button className="ac-button" type="button" onClick={() => editLesson(lesson)}><Pencil size={14}/> تحرير</button></li>)}</ul> : <AdminState text="لا توجد دروس لهذه المادة."/>}
      {selectedLesson && <section className="ac-admin-section"><h3>مواد الدرس: {selectedLesson.title}</h3>
        <p style={{ color: 'var(--ac-muted)', fontSize: 11, lineHeight: 1.8 }}>ملفات PDF وDOCX وTXT تدخل في البحث النصي؛ الفيديوهات تظهر للطلاب للمشاهدة بعد نشر الدرس.</p>
        <label className="ac-button" style={{ cursor: uploadBusy ? 'wait' : 'pointer' }}><Upload size={15}/>{uploadBusy ? 'جارٍ الرفع…' : 'إرفاق ملفات أو فيديوهات'}<input className="ac-sr" type="file" multiple disabled={uploadBusy} accept=".pdf,.docx,.txt,.mp4,.webm" onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void uploadCourseFiles(files); }}/></label>
        {uploadBusy && <div role="status"><p>{uploadLabel} — {uploadPercent.toLocaleString('ar')}٪</p><progress max={100} value={uploadPercent} aria-label="نسبة رفع مرفق الدرس" style={{ width: '100%' }}/></div>}
        <p className="ac-meta">لا نفرض حد الحجم السابق على مرفقات الدروس؛ يظل الرفع خاضعًا لخدمة التخزين والاتصال. المستندات الأكبر من ١٠ م.ب. متاحة للقراءة والتنزيل، لكنها لا تُفهرس للبحث أو المساعد الذكي.</p>
        {selectedLesson.files.length ? <ul className="ac-list" style={{ marginTop: 12 }}>{selectedLesson.files.map(file => <li className="ac-row" key={file.id}><span className="ac-row-icon"><FileText size={18}/></span><div className="ac-row-copy"><b>{file.title}</b><small>{file.originalName} · {file.mime}</small></div><button className="ac-button ac-button-danger" type="button" disabled={deleteFile.isPending} onClick={() => { if (window.confirm(`حذف الملف «${file.title}»؟`)) deleteFile.mutate({ fileId: file.id }, { onSuccess: invalidate, onError: e => setError(displayError(e)) }); }}><Trash2 size={14}/> حذف</button></li>)}</ul> : <p style={{ color: 'var(--ac-muted)', fontSize: 12 }}>لا توجد مرفقات.</p>}
      </section>}
    </>}
    {section === 'exams' && selectedSubject && <>
      <div className="ac-actions" style={{ marginBottom: 12 }}><button type="button" className="ac-button ac-button-primary" onClick={startNewExam}><Plus size={14}/> اختبار جديد</button></div>
      {examForm && <form className="ac-admin-section ac-form-stack" onSubmit={saveExam}><h3>{editingExamId ? 'تحرير الاختبار' : 'إنشاء اختبار'}</h3>
        {field('عنوان الاختبار', examForm.title, title => setExamForm({ ...examForm, title }), { required: true, min: 2, maxLength: 200 })}
        <label className="ac-field">الوصف<textarea rows={2} maxLength={1000} value={examForm.description} onChange={e => setExamForm({ ...examForm, description: e.target.value })}/></label>
        <div className="ac-grid"><label className="ac-field">الدرس المرتبط<select value={examForm.lessonId ?? ''} onChange={e => setExamForm({ ...examForm, lessonId: e.target.value || null })}><option value="">اختبار للمادة كاملة</option>{selectedSubject.lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label>
          {field('حد الوقت بالثواني (اتركه فارغاً بلا توقيت)', examForm.timeLimitSeconds == null ? '' : String(examForm.timeLimitSeconds), v => setExamForm({ ...examForm, timeLimitSeconds: v ? Number(v) : null }), { type: 'number', min: 60, max: 14400 })}
          {field('درجة الاجتياز', String(examForm.passingScore), v => setExamForm({ ...examForm, passingScore: Number(v) || 1 }), { type: 'number', min: 1, max: 100 })}
        </div>
        <label className="ac-privacy"><input type="checkbox" checked={examForm.published} onChange={e => setExamForm({ ...examForm, published: e.target.checked })}/><span>نشر الاختبار للطلاب — يتطلب ١٠ إلى ٢٠٠ سؤال وتفسيراً لكل سؤال</span></label>
        <div className="ac-inline"><b>الأسئلة ({questions.length.toLocaleString('ar')})</b><button type="button" className="ac-button" disabled={questions.length >= 200} onClick={() => { setQuestions([...questions, blankQuestion()]); setExamQuestionsChanged(true); }}><Plus size={14}/> أضف سؤالاً</button></div>
        {questions.map((question, i) => <div className="ac-question-editor" key={i}>
          <div className="ac-inline"><b>السؤال {(i + 1).toLocaleString('ar')}</b><button className="ac-button ac-button-danger" type="button" onClick={() => { setQuestions(questions.filter((_, n) => n !== i)); setExamQuestionsChanged(true); }}><Trash2 size={14}/> إزالة</button></div>
           <label className="ac-field"><span>نص السؤال <RequiredMark/></span><textarea required minLength={5} maxLength={2000} rows={2} value={question.prompt} onChange={e => { setQuestion(i, q => ({ ...q, prompt: e.target.value })); setExamQuestionsChanged(true); }}/></label>
           <div className="ac-grid">{question.options.map((option, oi) => <label className="ac-field" key={oi}><span>الخيار {(oi + 1).toLocaleString('ar')} <RequiredMark/></span><div className="ac-inline"><input required minLength={1} maxLength={500} value={option} onChange={e => { setQuestion(i, q => ({ ...q, options: q.options.map((v, j) => j === oi ? e.target.value : v) })); setExamQuestionsChanged(true); }}/><label style={{ display: 'flex', gap: 5, alignItems: 'center', whiteSpace: 'nowrap' }}><input type="radio" name={`correct-${i}`} checked={question.correctOption === oi} onChange={() => { setQuestion(i, q => ({ ...q, correctOption: oi })); setExamQuestionsChanged(true); }}/> صحيح</label><button type="button" className="ac-button ac-button-danger" disabled={question.options.length <= 2} aria-label="إزالة الخيار" onClick={() => { setQuestion(i, q => ({ ...q, options: q.options.filter((_, j) => j !== oi), correctOption: q.correctOption >= oi && q.correctOption > 0 ? q.correctOption - 1 : q.correctOption })); setExamQuestionsChanged(true); }}><Trash2 size={13}/></button></div></label>)}</div>
          <button type="button" className="ac-button" disabled={question.options.length >= 8} onClick={() => { setQuestion(i, q => ({ ...q, options: [...q.options, ''] })); setExamQuestionsChanged(true); }}><Plus size={13}/> إضافة خيار</button>
           <label className="ac-field"><span>تفسير الإجابة <RequiredMark/></span><textarea required minLength={5} maxLength={3000} rows={2} value={question.explanation} onChange={e => { setQuestion(i, q => ({ ...q, explanation: e.target.value })); setExamQuestionsChanged(true); }}/></label>
          <label className="ac-field">المهارات، افصل بينها بفاصلة<input value={question.skillTags.join('، ')} onChange={e => { setQuestion(i, q => ({ ...q, skillTags: e.target.value.split(/[,،]/).map(t => t.trim()).filter(Boolean) })); setExamQuestionsChanged(true); }}/></label>
        </div>)}
        <p className="ac-meta">الإجابة الصحيحة لا تظهر للطالب إلا بعد تسليم المحاولة.</p>
        {error && <AdminState text={error}/>}
        <div className="ac-actions"><button className="ac-button ac-button-primary" type="submit" disabled={busy}><Save size={14}/>{busy ? 'جارٍ الحفظ…' : 'حفظ الاختبار والأسئلة'}</button><button className="ac-button" type="button" onClick={() => setExamForm(null)}>إلغاء</button></div>
      </form>}
      {selectedSubject.exams.length ? <ul className="ac-list">{selectedSubject.exams.map(exam => <li className="ac-row" key={exam.id}><span className="ac-row-icon"><BookOpen size={18}/></span><div className="ac-row-copy"><b>{exam.title}</b><small>{exam.published ? 'منشور' : 'مسودة'} · {exam.questions.length.toLocaleString('ar')} سؤال</small></div><button type="button" className="ac-button" onClick={() => editExam(exam)}><Pencil size={14}/> تحرير</button></li>)}</ul> : <AdminState text="لا توجد اختبارات لهذه المادة."/>}
    </>}
     {section === 'submissions' && <section className="ac-admin-section">
       <h3>مراجعة المحتوى المرسل</h3>
       <p style={{ color: 'var(--ac-muted)', fontSize: 11, lineHeight: 1.8 }}>لا يظهر أي ملف أو رابط للطلاب قبل اعتماده. راجع المصدر ثم وافق أو ارفض المشاركة.</p>
       {submissions.isLoading ? <AdminSkeleton/> : submissions.isError || !submissions.data ? <AdminState text="تعذّر تحميل المشاركات."/> : submissions.data.items.length ? <div className="ac-list">
         {submissions.data.items.map(item => <article className="ac-row" key={item.id}>
           <span className="ac-row-icon"><FileText size={18}/></span>
           <div className="ac-row-copy">
             <b>{item.title}</b>
             <small>{item.description || 'بلا وصف'} · {item.status === 'pending' ? 'بانتظار المراجعة' : item.status === 'approved' ? 'معتمد' : item.status === 'rejected' ? 'مرفوض' : 'رفع غير مكتمل'}</small>
             {item.reviewNote && <small>ملاحظة المراجعة: {item.reviewNote}</small>}
           </div>
           {item.sourceUrl
             ? <a className="ac-button" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">فتح الرابط</a>
             : item.originalName && item.status !== 'rejected'
               ? <a className="ac-button" href={`/api/admin/academy/course-submissions/${item.id}/download`} target="_blank" rel="noopener noreferrer">معاينة الملف</a>
               : null}
           {item.status === 'pending' && <div className="ac-actions">
             <button className="ac-button ac-button-primary" type="button" disabled={reviewSubmission.isPending} onClick={() => reviewSubmission.mutate({ submissionId: item.id, data: { status: 'approved', reviewNote: submissionNotes[item.id] || undefined } }, { onSuccess: () => { setMessage('تم اعتماد المحتوى.'); invalidate(); void qc.invalidateQueries({ queryKey: getListAdminAcademyCourseSubmissionsQueryKey() }); }, onError: er => setError(displayError(er)) })}>اعتماد</button>
             <button className="ac-button ac-button-danger" type="button" disabled={reviewSubmission.isPending} onClick={() => reviewSubmission.mutate({ submissionId: item.id, data: { status: 'rejected', reviewNote: submissionNotes[item.id] || undefined } }, { onSuccess: () => { setMessage('تم رفض المشاركة.'); void qc.invalidateQueries({ queryKey: getListAdminAcademyCourseSubmissionsQueryKey() }); }, onError: er => setError(displayError(er)) })}>رفض</button>
           </div>}
           {item.status === 'pending' && <label className="ac-field ac-review-note">ملاحظة اختيارية<input maxLength={1000} value={submissionNotes[item.id] ?? ''} onChange={event => setSubmissionNotes({ ...submissionNotes, [item.id]: event.target.value })}/></label>}
         </article>)}
       </div> : <AdminState text="لا توجد مشاركات حتى الآن."/>}
     </section>}
  </main>;
}

export default AcademyAdminPanel;
