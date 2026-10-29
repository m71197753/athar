import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/react';
import { Link } from 'wouter';
import { ArrowLeft, Check, Clock3, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { getListLearningItemsQueryKey, useCreateLearningItem, useListLearningItems } from '@workspace/api-client-react';
import type { LearningItem } from '@workspace/api-client-react';
import { getExperimentVariant, trackEvent, trackNextDayReturn } from '../analytics/tracking';
import './guest-language-demo.css';

const STORAGE_KEY = 'athar.language-demo.progress.v1';
const SESSION_KEY = 'athar.language-demo.session.v1';
const DEMO_SECONDS = 60;

type Question = {
  prompt: string;
  hint: string;
  options: string[];
  answer: number;
};

const QUESTIONS: Question[] = [
  { prompt: 'I usually ___ breakfast before class.', hint: 'عادةً ما أتناول الفطور قبل المحاضرة.', options: ['have', 'has', 'having'], answer: 0 },
  { prompt: 'The library is ___ the café and the lab.', hint: 'المكتبة بين المقهى والمختبر.', options: ['under', 'between', 'through'], answer: 1 },
  { prompt: 'She ___ her notes right now.', hint: 'هي تراجع ملاحظاتها الآن.', options: ['reviews', 'reviewed', 'is reviewing'], answer: 2 },
  { prompt: 'Could you ___ me the time, please?', hint: 'هل يمكنك أن تخبرني بالوقت من فضلك؟', options: ['tell', 'say', 'speak'], answer: 0 },
  { prompt: 'We arrived ___ the lecture ten minutes early.', hint: 'وصلنا إلى المحاضرة قبل عشر دقائق.', options: ['at', 'on', 'in'], answer: 0 },
];

type DemoProgress = {
  index: number;
  answers: (number | null)[];
  startedAt: number;
  deadline: number;
  completed: boolean;
  timedOut?: boolean;
  elapsedSeconds?: number;
};

function freshProgress(now = Date.now()): DemoProgress {
  return { index: 0, answers: Array(QUESTIONS.length).fill(null), startedAt: now, deadline: now + DEMO_SECONDS * 1000, completed: false };
}

function readProgress(): DemoProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshProgress();
    const parsed = JSON.parse(raw) as DemoProgress;
    if (!Array.isArray(parsed.answers) || parsed.answers.length !== QUESTIONS.length || !Number.isFinite(parsed.deadline)) return freshProgress();
    return { ...parsed, index: Math.min(Math.max(0, parsed.index || 0), QUESTIONS.length - 1) };
  } catch {
    return freshProgress();
  }
}

function getSessionReference() {
  try {
    let reference = localStorage.getItem(SESSION_KEY);
    if (!reference) {
      reference = `language-demo-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      localStorage.setItem(SESSION_KEY, reference);
    }
    return reference;
  } catch {
    return `language-demo-${Date.now()}`;
  }
}

export type LanguageDemoResult = {
  answers: (number | null)[];
  score: number;
  elapsedSeconds: number;
  sessionReference: string;
};

function makeArabicSummary(result: LanguageDemoResult) {
  const lines = [
    'ملخص تجربة اللغة الإنجليزية القصيرة',
    `النتيجة: ${result.score} من ${QUESTIONS.length}`,
    `الوقت المستغرق: ${result.elapsedSeconds} ثانية`,
    '',
    ...QUESTIONS.map((question, index) => {
      const answerIndex = result.answers[index];
      const chosen = answerIndex === null ? 'لم يتم اختيار إجابة' : question.options[answerIndex];
      const correct = question.options[question.answer];
      return `${index + 1}. ${question.prompt}\nإجابة الطالب: ${chosen}\nالإجابة الصحيحة: ${correct}\nالمعنى: ${question.hint}`;
    }),
    '',
    'هذه نتيجة تجربة تعليمية قصيرة وليست مؤهلاً أو شهادة معتمدة.',
  ];
  return lines.join('\n');
}

export function GuestLanguageProgressTransfer({
  result,
  onSaved,
  autoSave = false,
}: {
  result: LanguageDemoResult;
  onSaved?: () => void;
  autoSave?: boolean;
}) {
  const { isSignedIn, isLoaded } = useUser();
  const itemsQuery = useListLearningItems(undefined, { query: { queryKey: getListLearningItemsQueryKey(), enabled: isLoaded && isSignedIn } });
  const create = useCreateLearningItem();
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);
  const autoAttempted = useRef(false);
  const [ctaVariant, setCtaVariant] = useState<'direct' | 'encouraging'>('direct');
  const source = 'تجربة اللغة الإنجليزية في أثر';

  useEffect(() => {
    const variant = getExperimentVariant('language_cta_copy');
    setCtaVariant(variant === 'encouraging' ? 'encouraging' : 'direct');
    trackEvent('language_cta_exposed', { experiment: 'language_cta_copy', variant });
  }, []);

  const save = useCallback(() => {
    if (!isSignedIn || !itemsQuery.data || create.isPending || saved) return;
    setSaveError(false);
    const notes = makeArabicSummary(result);
    const duplicate = (itemsQuery.data as LearningItem[]).some(item =>
      item.title === 'تجربة قصيرة في اللغة الإنجليزية' && item.source === source && item.notes === notes,
    );
    if (duplicate) {
      setSaved(true);
      onSaved?.();
      return;
    }
    create.mutate({
      data: {
        kind: 'lecture',
        title: 'تجربة قصيرة في اللغة الإنجليزية',
        source,
        subject: 'اللغة الإنجليزية',
         notes,
        status: 'completed',
      },
    }, {
      onSuccess: () => {
        setSaved(true);
        onSaved?.();
      },
      onError: () => setSaveError(true),
    });
  }, [create, isSignedIn, itemsQuery.data, onSaved, result, saved, source]);

  useEffect(() => {
    if (!autoSave || !isLoaded || !isSignedIn || !itemsQuery.data || autoAttempted.current) return;
    autoAttempted.current = true;
    save();
  }, [autoSave, isLoaded, isSignedIn, itemsQuery.data, save]);

  if (!isLoaded) return <div className="gld-transfer-note" role="status">جارٍ التحقق من الحساب…</div>;
  if (!isSignedIn) {
    return <Link href="/sign-up?from=language-demo" className="gld-save-link" data-testid="link-save-language-progress" onClick={() => trackEvent('language_cta_clicked', { experiment: 'language_cta_copy', variant: ctaVariant })}>
      <Save size={17} aria-hidden="true"/> {ctaVariant === 'encouraging' ? 'انقل تقدّمك وواصل التعلّم' : 'احفظ تقدّمك في حسابك'} <ArrowLeft size={16} aria-hidden="true"/>
    </Link>;
  }
  if (saved) return <div className="gld-transfer-success" role="status"><Check size={17}/> حُفظت التجربة في تعلّمك.<Link href="/languages/study" className="gld-next-learning">ابدأ التعلّم في أثر <ArrowLeft size={15}/></Link></div>;
  if (itemsQuery.isLoading) return <div className="gld-transfer-note" role="status">جارٍ تجهيز حفظ نتيجتك…</div>;
  if (itemsQuery.isError) return <div className="gld-transfer-error" role="alert">
    تعذّر تحميل عناصر تعلّمك للتحقق من التكرار.
    <button type="button" onClick={() => itemsQuery.refetch()}>حاول مجددًا</button>
  </div>;
  return <div className="gld-transfer-wrap">
    {saveError && <p className="gld-transfer-error" role="alert">لم تُحفظ النتيجة بعد. تقدّمك ما زال محفوظًا على هذا الجهاز.</p>}
    <button className="gld-save-link" type="button" onClick={save} disabled={create.isPending} data-testid="button-save-language-progress">
      <Save size={17} aria-hidden="true"/>{create.isPending ? 'جارٍ الحفظ…' : saveError ? 'إعادة محاولة الحفظ' : 'احفظ النتيجة في تعلّمك'}<ArrowLeft size={16} aria-hidden="true"/>
    </button>
  </div>;
}

export function GuestLanguageDemoPage() {
  const [progress, setProgress] = useState<DemoProgress>(readProgress);
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((readProgress().deadline - Date.now()) / 1000)));
  const [sessionReference, setSessionReference] = useState(getSessionReference);
  const [storageWarning, setStorageWarning] = useState(false);
  const autoSave = new URLSearchParams(window.location.search).get('from') === 'language-demo';
  const handleProgressSaved = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {
      setStorageWarning(true);
    }
  }, []);

  const score = useMemo(() => progress.answers.reduce<number>((total, answer, index) =>
    total + (answer === QUESTIONS[index].answer ? 1 : 0), 0), [progress.answers]);
  const result = useMemo<LanguageDemoResult>(() => ({
    answers: progress.answers,
    score,
    elapsedSeconds: progress.elapsedSeconds ?? Math.min(DEMO_SECONDS, Math.max(1, Math.floor((Date.now() - progress.startedAt) / 1000))),
    sessionReference,
  }), [progress, score, sessionReference]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }, [progress]);

  useEffect(() => {
    if (progress.completed) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((progress.deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) {
        setProgress(current => current.completed ? current : {
          ...current,
          completed: true,
          timedOut: true,
          elapsedSeconds: DEMO_SECONDS,
        });
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [progress.completed, progress.deadline]);

  const selectAnswer = (choice: number) => setProgress(current => {
    if (current.completed) return current;
    const answers = [...current.answers];
    answers[current.index] = choice;
    return { ...current, answers };
  });

  const advance = () => setProgress(current => {
    if (current.completed) return current;
    const answer = current.answers[current.index];
    if (answer !== null && answer !== QUESTIONS[current.index].answer) {
      trackEvent('language_answer_incorrect', { surface: 'guest_demo', question_number: current.index + 1 });
    }
    if (current.index === QUESTIONS.length - 1) {
      return {
        ...current,
        completed: true,
        elapsedSeconds: Math.min(DEMO_SECONDS, Math.max(1, Math.floor((Date.now() - current.startedAt) / 1000))),
      };
    }
    return { ...current, index: current.index + 1 };
  });

  const restart = () => {
    const nextReference = `language-demo-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    try { localStorage.setItem(SESSION_KEY, nextReference); } catch { /* local progress remains usable in restricted storage */ }
    setSessionReference(nextReference);
    const next = freshProgress();
    setProgress(next);
    setRemaining(DEMO_SECONDS);
  };

  const current = QUESTIONS[progress.index];
  const selected = progress.answers[progress.index];
  const complete = progress.completed;
  const succeeded = score >= 3;
  const progressPercent = complete ? 100 : (progress.index / QUESTIONS.length) * 100;
  const trackedCompletion = useRef<number | null>(null);

  useEffect(() => {
    trackNextDayReturn('language_demo');
  }, []);

  useEffect(() => {
    trackEvent('language_demo_started', { surface: 'guest_demo' });
  }, [progress.startedAt]);

  useEffect(() => {
    if (!progress.completed || trackedCompletion.current === progress.startedAt) return;
    trackedCompletion.current = progress.startedAt;
    trackEvent('language_demo_completed', {
      correct_answers: score,
      total_questions: QUESTIONS.length,
      elapsed_seconds: progress.elapsedSeconds ?? DEMO_SECONDS,
      timed_out: Boolean(progress.timedOut),
    });
  }, [progress.completed, progress.elapsedSeconds, progress.startedAt, progress.timedOut, score]);

  return <main className="guest-language-demo" dir="rtl">
    <header className="gld-header">
      <a className="gld-brand" href="/" aria-label="العودة إلى أثر">
        <img src={`${import.meta.env.BASE_URL}athar-wordmark.png`} alt="أثر" />
      </a>
      <span className="gld-header-label">تجربة اللغة الإنجليزية</span>
      <Link href="/about" className="gld-about-link">عن أثر</Link>
        <span className="gld-private"><ShieldCheck size={15}/>{storageWarning ? 'لن يُحفظ التقدم بعد إغلاق الصفحة' : 'تقدّمك محفوظ على هذا الجهاز'}</span>
    </header>

    <section className="gld-layout" aria-labelledby="gld-title">
      <aside className="gld-intro">
        <span className="gld-kicker">دقيقة واحدة · خمس أسئلة</span>
        <h1 id="gld-title">الإنجليزية<br/><em>في مواقفك اليومية.</em></h1>
        <p>اختر الإجابة الأنسب، وابدأ فوراً. هذه تجربة قصيرة للتعلّم وليست اختباراً رسمياً.</p>
        <div className="gld-side-art" aria-hidden="true">
          <span className="gld-art-ring gld-ring-one"/><span className="gld-art-ring gld-ring-two"/>
          <span className="gld-art-word">A</span><span className="gld-art-caption">مفردات · قواعد · استخدام</span>
        </div>
        <div className="gld-side-foot"><span>٠١ / ٠٥</span><span>ابدأ من هنا</span></div>
      </aside>

      <section className="gld-quiz" aria-live="polite">
        <div className="gld-quiz-top">
          <div className="gld-step-label">{complete ? 'اكتملت التجربة' : `السؤال ${String(progress.index + 1).padStart(2, '0')} من ٠٥`}</div>
          <div className={`gld-timer ${remaining <= 10 && !complete ? 'gld-timer-low' : ''}`} aria-label={`الوقت المتبقي ${remaining} ثانية`}>
            <Clock3 size={17}/><span>{complete ? '٠٠:٠٠' : `٠${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}</span>
          </div>
        </div>
        <div className="gld-progress" role="progressbar" aria-label="تقدّم التجربة" aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={complete ? QUESTIONS.length : progress.index}>
          <span style={{ width: `${complete ? 100 : ((progress.index + 1) / QUESTIONS.length) * 100}%` }}/>
        </div>

        {!complete ? <div className="gld-question-stage" key={progress.index}>
          <span className="gld-question-index">اختيار من متعدد</span>
          <h2 className="gld-prompt" dir="ltr">{current.prompt}</h2>
          <p className="gld-hint">{current.hint}</p>
          <fieldset className="gld-options">
            <legend className="gld-sr">اختر الإجابة الصحيحة</legend>
            {current.options.map((option, index) => (
              <label className={`gld-option ${selected === index ? 'gld-option-selected' : ''}`} key={option}>
                <input
                  type="radio"
                  name={`answer-${progress.index}`}
                  value={index}
                  checked={selected === index}
                  onChange={() => selectAnswer(index)}
                  data-testid={`radio-language-answer-${progress.index}-${index}`}
                />
                <span className="gld-option-letter">{String.fromCharCode(65 + index)}</span>
                <span dir="ltr">{option}</span>
                {selected === index && <Check className="gld-option-check" size={17} aria-hidden="true"/>}
              </label>
            ))}
          </fieldset>
          <div className="gld-quiz-actions">
            <span className="gld-answer-hint">{selected === null ? 'اختر إجابة للمتابعة' : 'إجابة واحدة فقط'}</span>
            <button className="gld-next" type="button" onClick={advance} disabled={selected === null} data-testid="button-language-next">
              {progress.index === QUESTIONS.length - 1 ? 'اعرض النتيجة' : 'السؤال التالي'} <ArrowLeft size={17}/>
            </button>
          </div>
        </div> : <div className="gld-result" data-testid="status-language-demo-result">
          <div className="gld-result-mark"><Check size={28}/></div>
          <span className="gld-question-index">{progress.timedOut ? 'انتهى الوقت' : succeeded ? 'أحسنت، أنهيت التجربة' : 'انتهت التجربة'}</span>
          <h2>{progress.timedOut ? <>انتهت الدقيقة،<br/><em>وهذه حصيلة إجاباتك.</em></> : succeeded ? <>خطوة صغيرة<br/><em>تضيف إلى معرفتك.</em></> : <>جرّب مرة أخرى،<br/><em>وستتحسن مع التدريب.</em></>}</h2>
          <div className="gld-score"><strong>{score}<small> / ٥</small></strong><span>إجابات صحيحة</span></div>
          <p>هذه نتيجة تدريبية للتأمل والتعلّم، وليست مؤهلاً أو شهادة معتمدة.</p>
          {succeeded ? <GuestLanguageProgressTransfer result={result} onSaved={handleProgressSaved} autoSave={autoSave}/> : <p className="gld-transfer-note">أجب عن ثلاثة أسئلة على الأقل لحفظ تقدّمك.</p>}
          <button className="gld-restart" type="button" onClick={restart} data-testid="button-language-restart"><RotateCcw size={15}/> ابدأ تجربة جديدة</button>
        </div>}
        {!complete && <div className="gld-quiz-foot"><span>تُحفظ إجاباتك تلقائياً على هذا الجهاز</span><span>اللغة الإنجليزية</span></div>}
      </section>
    </section>
    <footer className="gld-footer"><span>أثر</span><span>تعلّمك يبدأ بخطوة.</span></footer>
  </main>;
}

export default GuestLanguageDemoPage;
