import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, CircleAlert, FileText, LoaderCircle, RefreshCw, Sparkles,
} from "lucide-react";
import {
  getGetAcademyFileStudyGuideQueryKey,
  getListAcademyFileQuizAttemptsQueryKey,
  useGenerateAcademyFileQuiz,
  useGenerateAcademyFileStudyGuide,
  useGetAcademyFileStudyGuide,
  useListAcademyFileQuizAttempts,
  useSubmitAcademyFileQuiz,
} from "@workspace/api-client-react";
import type {
  AcademyGeneratedFileQuiz,
  AcademyStudentFileQuizAttemptSummary,
  AcademyStudentFileQuizResult,
  AcademyStudyGuide,
  AcademyStudentFile,
} from "@workspace/api-client-react";

function apiErrorMessage(error: unknown) {
  const status = typeof error === "object" && error && "status" in error
    ? Number((error as { status: unknown }).status)
    : 0;
  if (status === 401 || status === 403) return "لا يمكن إتمام العملية بهذا الحساب.";
  if (status === 422) return "المادة لا تحتوي على نص مقروء كافٍ. جرّب ملفًا أوضح.";
  return "تعذّر إتمام العملية. تحقق من الاتصال ثم حاول مرة أخرى.";
}

function levelLabel(level: string) {
  if (level === "strong") return "أداء قوي";
  if (level === "proficient") return "مستوى جيد";
  if (level === "developing") return "في مرحلة التأسيس";
  return "يحتاج مراجعة";
}

function ConsentNote({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="ac-privacy">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/>
      <span>أوافق على إرسال محتوى هذا الملف فقط إلى OpenAI عبر Replit AI Integrations. يُستهلك ذلك من أرصدة Replit، ولن يبدأ الإرسال دون موافقتي.</span>
    </label>
  );
}

export function AcademyFileStudyGuide({ file }: { file: AcademyStudentFile }) {
  const qc = useQueryClient();
  const saved = useGetAcademyFileStudyGuide(file.id);
  const generate = useGenerateAcademyFileStudyGuide();
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const guide = saved.data?.guide;

  function createGuide() {
    setMessage("");
    if (!consent || generate.isPending) return;
    generate.mutate({ fileId: file.id, data: { allowOpenAi: true } }, {
      onSuccess: result => {
        qc.setQueryData(getGetAcademyFileStudyGuideQueryKey(file.id), { guide: result });
        setConsent(false);
        setMessage("تم إعداد الملخص وحفظه في مكتبتك.");
      },
      onError: error => setMessage(apiErrorMessage(error)),
    });
  }

  return (
    <section className="ac-panel ac-file-study-guide" aria-label={`ملخص ${file.originalName}`}>
      <div className="ac-file-quiz-head">
        <div>
          <span className="ac-kicker">دليل مذاكرة خاص</span>
          <h3>{guide ? guide.title : "لخّص المحاضرة وراجع أهم أفكارها"}</h3>
          <p>ملخص من محتوى ملفك، مع نقاط أساسية ومصطلحات وأسئلة مراجعة.</p>
        </div>
        <FileText size={20} aria-hidden="true"/>
      </div>
      {saved.isLoading ? <p className="ac-meta" role="status">جارٍ فتح الملخص…</p> :
        saved.isError ? <p className="ac-file-quiz-error" role="alert">تعذّر تحميل الملخص المحفوظ. أعد فتحه بعد لحظات.</p> :
          guide ? <StudyGuideContent guide={guide}/> :
            <p className="ac-meta">سيُحفظ الملخص في حسابك لتراجعه لاحقًا.</p>}
      <ConsentNote checked={consent} onChange={setConsent}/>
      <div className="ac-actions">
        <button className="ac-button ac-button-primary" type="button" disabled={!consent || generate.isPending || saved.isLoading} onClick={createGuide}>
          {generate.isPending ? <><LoaderCircle className="ac-community-spin" size={15}/> جارٍ إعداد الدليل…</> :
            <><Sparkles size={15}/>{guide ? "تحديث الملخص" : "إنشاء ملخص ذكي"}</>}
        </button>
        {message && <span role="status" className="ac-meta">{message}</span>}
      </div>
      <p className="ac-ai-disclaimer">راجع الملخص مع المصدر الأصلي؛ نتيجة الذكاء الاصطناعي قد تحتاج إلى تصحيح.</p>
    </section>
  );
}

function StudyGuideContent({ guide }: { guide: AcademyStudyGuide }) {
  return (
    <div className="ac-study-guide-content">
      <p className="ac-study-overview">{guide.overview}</p>
      <div className="ac-study-guide-section">
        <h4>أهم الأفكار</h4>
        <ol className="ac-study-points">{guide.keyPoints.map((item, index) => (
          <li key={`${item.heading}-${index}`}><b>{item.heading}</b><span>{item.detail}</span></li>
        ))}</ol>
      </div>
      {!!guide.terms.length && <div className="ac-study-guide-section">
        <h4>مصطلحات للمراجعة</h4>
        <dl className="ac-study-terms">{guide.terms.map((item, index) => (
          <div key={`${item.term}-${index}`}><dt>{item.term}</dt><dd>{item.meaning}</dd></div>
        ))}</dl>
      </div>}
      <div className="ac-study-guide-section">
        <h4>استرجع ما تعلّمته</h4>
        <ol className="ac-study-questions">{guide.reviewQuestions.map((item, index) => (
          <li key={`${item.question}-${index}`}><b>{item.question}</b><span>{item.answer}</span></li>
        ))}</ol>
      </div>
      <small className="ac-study-generated">آخر تحديث: {new Date(guide.generatedAt).toLocaleString("ar")}</small>
    </div>
  );
}

export function AcademyFileQuizBuilder({ file }: { file: AcademyStudentFile }) {
  const qc = useQueryClient();
  const history = useListAcademyFileQuizAttempts(file.id);
  const generate = useGenerateAcademyFileQuiz();
  const submit = useSubmitAcademyFileQuiz();
  const [questionCount, setQuestionCount] = useState(10);
  const [consent, setConsent] = useState(false);
  const [quiz, setQuiz] = useState<AcademyGeneratedFileQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AcademyStudentFileQuizResult | null>(null);
  const [message, setMessage] = useState("");

  function createQuiz() {
    if (!consent || generate.isPending) return;
    setMessage("");
    setQuiz(null);
    setResult(null);
    setAnswers({});
    generate.mutate({ fileId: file.id, data: { questionCount, allowOpenAi: true } }, {
      onSuccess: setQuiz,
      onError: error => setMessage(apiErrorMessage(error)),
    });
  }

  function submitQuiz(event: FormEvent) {
    event.preventDefault();
    if (!quiz || result || submit.isPending || Object.keys(answers).length !== quiz.questions.length) return;
    setMessage("");
    submit.mutate({
      quizId: quiz.quizId,
      data: { answers: quiz.questions.map(question => ({ questionId: question.id, selectedOption: answers[question.id] })) },
    }, {
      onSuccess: saved => {
        setResult(saved);
        void qc.invalidateQueries({ queryKey: getListAcademyFileQuizAttemptsQueryKey(file.id) });
      },
      onError: error => setMessage(apiErrorMessage(error)),
    });
  }

  function retryQuiz() {
    setAnswers({});
    setResult(null);
    setMessage("");
  }

  return (
    <section className="ac-panel ac-file-quiz" aria-label={`اختبار تدريبي من ${file.originalName}`}>
      <div className="ac-file-quiz-head">
        <div>
          <span className="ac-kicker">اختبار تدريبي خاص</span>
          <h3>اختبر فهمك من نفس المادة</h3>
          <p>إجاباتك تُصحّح في الخادم، ونتيجتك تبقى خاصة بحسابك.</p>
        </div>
        <Sparkles size={20} aria-hidden="true"/>
      </div>

      <div className="ac-file-quiz-controls">
        <label className="ac-field">عدد الأسئلة
          <select value={questionCount} disabled={!!quiz} onChange={event => setQuestionCount(Number(event.target.value))}>
            {[5, 10, 15, 20].map(count => <option key={count} value={count}>{count.toLocaleString("ar")} أسئلة</option>)}
          </select>
        </label>
        <button className="ac-button ac-button-primary" type="button" disabled={!consent || generate.isPending || !!quiz} onClick={createQuiz}>
          {generate.isPending ? <><LoaderCircle className="ac-community-spin" size={15}/> جارٍ إعداد الأسئلة…</> : <><Sparkles size={15}/> أنشئ اختبارًا</>}
        </button>
      </div>
      {!quiz && <ConsentNote checked={consent} onChange={setConsent}/>}
      {message && <p className="ac-file-quiz-error" role="alert">{message}</p>}

      {quiz && !result && <form className="ac-file-quiz-question-list" onSubmit={submitQuiz}>
        <p className="ac-meta">{quiz.title} · اختر إجابة لكل سؤال. الإجابات الصحيحة تظهر بعد التسليم.</p>
        {quiz.questions.map((question, index) => <fieldset className="ac-question" key={question.id}>
          <legend className="ac-sr">السؤال {index + 1}</legend>
          <h4><span className="ac-chip">{(index + 1).toLocaleString("ar")}</span> {question.question}</h4>
          <div className="ac-options">{question.options.map((option, optionIndex) => (
            <label className={`ac-option ${answers[question.id] === optionIndex ? "ac-option-selected" : ""}`} key={`${question.id}-${optionIndex}`}>
              <input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: optionIndex }))}/>
              <span>{option}</span>
            </label>
          ))}</div>
        </fieldset>)}
        <button className="ac-button ac-button-primary" type="submit" disabled={submit.isPending || Object.keys(answers).length !== quiz.questions.length}>
          {submit.isPending ? "جارٍ تصحيح إجاباتك…" : "اعرض نتيجتي"}
        </button>
      </form>}

      {result && <section className="ac-study-result" aria-live="polite">
        <div className="ac-study-score"><span className="ac-kicker">مستواك التدريبي في هذا الملف</span><strong>{result.score.toLocaleString("ar")}٪</strong><b>{levelLabel(result.level)}</b><small>{result.correctCount.toLocaleString("ar")} من {result.questionCount.toLocaleString("ar")} إجابات صحيحة</small></div>
        <p className="ac-ai-disclaimer">هذه نتيجة مراجعة ذاتية لهذه المادة فقط، وليست شهادة أو تقييمًا مهنيًا.</p>
        {!!result.topicResults.length && <div className="ac-study-guide-section"><h4>الموضوعات التي راجعتها</h4><div className="ac-study-topics">{result.topicResults.map(topic => (
          <div key={topic.topic}><span>{topic.topic}</span><b>{topic.score.toLocaleString("ar")}٪</b><small>{topic.correctCount.toLocaleString("ar")} / {topic.questionCount.toLocaleString("ar")}</small></div>
        ))}</div></div>}
        <div className="ac-study-guide-section"><h4>مراجعة الإجابات</h4><div className="ac-study-review">{result.review.map((item, index) => (
          <article className={`ac-study-review-item ${item.isCorrect ? "is-correct" : "is-wrong"}`} key={item.questionId}>
            <div className="ac-meta">{item.isCorrect ? <CheckCircle2 size={16}/> : <CircleAlert size={16}/>}<b>السؤال {(index + 1).toLocaleString("ar")} · {item.topic}</b></div>
            <p>{item.question}</p>
            <small>إجابتك: {item.selectedOption === null ? "لم تُجب" : item.options[item.selectedOption]}</small>
            {!item.isCorrect && <small>الإجابة الصحيحة: {item.options[item.correctIndex]}</small>}
            <span>{item.explanation}</span>
          </article>
        ))}</div></div>
        <div className="ac-actions">
          <button className="ac-button ac-button-primary" type="button" onClick={retryQuiz}><RefreshCw size={14}/> أعد المحاولة</button>
          <button className="ac-button" type="button" onClick={createQuiz} disabled={!consent || generate.isPending}><Sparkles size={14}/> اختبار جديد</button>
        </div>
        <ConsentNote checked={consent} onChange={setConsent}/>
      </section>}

      <section className="ac-study-history" aria-label="سجل نتائج الاختبارات">
        <h4>سجل مستواك في هذه المادة</h4>
        {history.isLoading ? <p className="ac-meta">جارٍ تحميل النتائج…</p> : history.isError ? <p className="ac-meta">تعذّر تحميل سجل النتائج.</p> : !history.data?.length ?
          <p className="ac-meta">ستظهر نتائجك السابقة بعد أول اختبار.</p> :
          <ul>{history.data.slice(0, 5).map((attempt: AcademyStudentFileQuizAttemptSummary) => (
            <li key={attempt.id}><span>{new Date(attempt.createdAt).toLocaleDateString("ar")}</span><b>{attempt.score.toLocaleString("ar")}٪</b><span>{levelLabel(attempt.level)}</span></li>
          ))}</ul>}
      </section>
    </section>
  );
}
