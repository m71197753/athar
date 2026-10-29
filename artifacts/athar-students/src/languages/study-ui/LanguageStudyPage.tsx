import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, CircleAlert, Headphones, LockKeyhole, RotateCcw, Volume2, Heart, Gem, Flame, Shield, Trophy, Bell, Vibrate } from 'lucide-react';
import {
  getGetLanguageGamificationQueryKey,
  getGetLanguageLearningProgressQueryKey,
  getGetLanguagePlatformSettingsQueryKey,
  getListLanguageLearningContentQueryKey,
  useGetLanguagePlatformSettings,
  useListLanguageLearningContent,
  useGetLanguageGamification,
  useGetLanguageLearningProgress,
  usePurchaseLanguageStreakFreeze,
  useSubmitLanguageLearningSession,
  useUpdateLanguageGamificationSettings,
} from '@workspace/api-client-react';
import type {
  LanguageContentItem as LanguageContentItemDto,
  LanguageGamificationSummary,
  LanguagePlatformSettings,
  LanguageSessionInput,
} from '@workspace/api-client-react';
import { languageLabels, languageLocales, starterQuestionModes, supportedLanguages } from '../content/sample-a1';
import type { LanguageContentItem, LanguageQuestionMode, SupportedLanguageCode } from '../content/sample-a1';
import { scoreSpokenText } from './speech-match';
import { gradeLanguageAnswer } from '@workspace/language-content';
import { getExperimentVariant, trackDailyEventOnce, trackEvent, trackNextDayReturn } from '../../analytics/tracking';
import './language-study.css';
import { LanguageConversationPanel } from './LanguageConversationPanel';

type Answer = LanguageSessionInput['answers'][number];
type ResponseRecord = Answer & {
  isCorrect: boolean;
  correctAnswer: string;
  explanation?: string;
  pronunciationScore?: number | null;
};
type Question = { item: StudyContentItem; mode: LanguageQuestionMode };
type PracticeMode = 'mixed' | 'listening' | 'speaking';
type DraftAnswer = {
  contentId: string;
  mode: LanguageQuestionMode;
  isCorrect: boolean;
  responseMs: number;
  correctAnswer: string;
  explanation?: string;
  submittedAnswer?: string;
  responseText?: string;
  pronunciationScore?: number | null;
};
type Draft = { sessionRef: string; startedAt: number; index: number; answers: DraftAnswer[]; questionIds?: string[]; sessionKind?: LanguageSessionInput['sessionKind']; practiceMode?: PracticeMode; audioOnly?: boolean };
type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type StudyContentItem = LanguageContentItem & { active: boolean };
type SpeechRecognizer = {
  lang: string;
  interimResults: boolean;
  onstart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const draftKey = (userId: string, languageCode: SupportedLanguageCode, level: LanguageSessionInput['level']) => `athar-language-study:${userId}:${languageCode}:${level}`;
const freshId = () => globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const modeName: Record<LanguageQuestionMode, string> = {
  choice: 'معنى الكلمة', listening: 'الاستماع', order: 'ترتيب الجملة', recall: 'استرجاع', pronunciation: 'النطق',
};
const modeHint: Record<LanguageQuestionMode, string> = {
  choice: 'اختر الكلمة باللغة التي تتعلمها والمطابقة للمعنى العربي.',
  listening: 'استمع إلى الكلمة أو العبارة، ثم اختر معناها بالعربية.',
  order: 'رتّب الكلمات لتكوين جملة صحيحة.',
  recall: 'اكتب الكلمة باللغة التي تتعلمها من ذاكرتك.',
  pronunciation: 'استمع إلى النطق، ثم قل الكلمة أو العبارة.',
};

function toStudyContent(item: LanguageContentItemDto): StudyContentItem {
  return {
    id: item.id,
    languageCode: item.languageCode,
    level: item.level,
    kind: item.kind,
    category: item.category,
    partOfSpeech: item.partOfSpeech ?? undefined,
    english: item.english,
    arabic: item.arabic,
    pronunciationArabic: item.pronunciationArabic ?? undefined,
    exampleEnglish: item.exampleEnglish ?? undefined,
    exampleArabic: item.exampleArabic ?? undefined,
    grammarNote: item.grammarNote ?? undefined,
    difficulty: item.difficulty,
    relatedWordIds: item.relatedWordIds,
    active: item.active,
  };
}

const defaultLanguageSettings: LanguagePlatformSettings = {
  page: {
    title: 'خطوة صغيرة، لغة أقوى',
    subtitle: 'جلسة من ٣ إلى ٥ دقائق، فيها أسئلة تنتقل من المعنى إلى الاسترجاع والنطق.',
    accentColor: '#4338CA',
    enabledLanguages: ['en', 'fr', 'es', 'de', 'tr'],
    showConversation: true,
    showGamification: true,
    showProgress: true,
    showReviewList: true,
    showLeague: true,
    showFreeze: true,
    showPreferences: true,
    layoutOrder: 'learning-first',
  },
  game: { maxHearts: 5, heartRegenMinutes: 240, baseXp: 10, accuracyBonusXp: 5, reviewBonusXp: 5, streakGemInterval: 7, freezeCost: 5, maxFreezeCredits: 3, promotionCount: 6, demotionCount: 6 },
};

function buildQuestions(contentItems: StudyContentItem[], dueIds: string[], languageCode: SupportedLanguageCode, practiceMode: PracticeMode = 'mixed'): Question[] {
  const dueSet = new Set(dueIds);
  const available = contentItems.filter(item => item.languageCode === languageCode && (item.active || dueSet.has(item.id)));
  const prioritizeDue = (items: StudyContentItem[]) => [
    ...items.filter(item => dueSet.has(item.id)),
    ...items.filter(item => !dueSet.has(item.id)),
  ];
  const contentForLanguage = available;
  const words = prioritizeDue(contentForLanguage.filter(item => item.kind === 'word'));
  const sentences = prioritizeDue(contentForLanguage.filter(item => item.kind === 'sentence'));
  const preferred = [
    ...words.slice(0, 3),
    ...sentences.slice(0, 3),
    ...words.slice(3, 6),
    ...sentences.slice(3, 6),
  ];
  const content: StudyContentItem[] = [];
  const included = new Set<string>();
  for (const item of [...preferred, ...words, ...sentences]) {
    if (included.has(item.id)) continue;
    included.add(item.id);
    content.push(item);
    if (content.length === 12) break;
  }
  return content.map((item, index) => ({
    item,
    mode: practiceMode === 'listening' ? 'listening' : practiceMode === 'speaking' ? 'pronunciation' : starterQuestionModes[index],
  }));
}

function makeOptions(item: StudyContentItem, content: StudyContentItem[]): string[] {
  const alternatives = content
    .filter(candidate => candidate.id !== item.id && candidate.kind === item.kind)
    .map(candidate => candidate.english);
  const list = [item.english, ...alternatives.slice(0, 3)];
  return list.sort((a, b) => a.localeCompare(b));
}

function makeListeningOptions(item: StudyContentItem, content: StudyContentItem[]): string[] {
  const alternatives = content
    .filter(candidate => candidate.id !== item.id && candidate.kind === item.kind)
    .map(candidate => candidate.arabic)
    .filter((value, index, values) => value !== item.arabic && values.indexOf(value) === index);
  return [item.arabic, ...alternatives.slice(0, 3)].sort((a, b) => a.localeCompare(b, 'ar'));
}

function shuffledTokens(sentence: string): string[] {
  const words = sentence.split(/\s+/);
  if (words.length < 2) return words;
  return [...words.slice(1), words[0]];
}

export function LanguageStudyPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [languageCode, setLanguageCode] = useState<SupportedLanguageCode>('en');
  const [level, setLevel] = useState<LanguageSessionInput['level']>('A1');
  const languageSettingsQuery = useGetLanguagePlatformSettings({
    query: { queryKey: getGetLanguagePlatformSettingsQueryKey(), staleTime: 60_000 },
  });
  const pageSettings = languageSettingsQuery.data?.page ?? defaultLanguageSettings.page;
  const enabledLanguages = pageSettings.enabledLanguages as SupportedLanguageCode[];
  const progressParams = useMemo(() => ({ languageCode }), [languageCode]);
  const progressLevelParams = useMemo(() => ({ languageCode, level }), [languageCode, level]);
  const contentQuery = useListLanguageLearningContent(progressLevelParams, {
    query: { queryKey: getListLanguageLearningContentQueryKey(progressLevelParams), staleTime: 60_000 },
  });
  const contentItems = useMemo(
    () => (contentQuery.data ?? []).map(toStudyContent),
    [contentQuery.data],
  );
  const progressQuery = useGetLanguageLearningProgress(progressLevelParams, {
    query: { queryKey: getGetLanguageLearningProgressQueryKey(progressLevelParams), staleTime: 30_000 },
  });
  const gamificationQuery = useGetLanguageGamification(progressParams, {
    query: { queryKey: getGetLanguageGamificationQueryKey(progressParams), staleTime: 30_000 },
  });
  const submitSession = useSubmitLanguageLearningSession();
  const updateSettings = useUpdateLanguageGamificationSettings();
  const purchaseFreeze = usePurchaseLanguageStreakFreeze();
  const dueIds = useMemo(
    () => (progressQuery.data?.dueReviews ?? []).map(review => review.contentId),
    [progressQuery.data?.dueReviews],
  );
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('mixed');
  const questions = useMemo(() => buildQuestions(contentItems, dueIds, languageCode, practiceMode), [contentItems, dueIds, languageCode, practiceMode]);
  const storageKey = user?.id ? draftKey(user.id, languageCode, level) : null;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ResponseRecord[]>([]);
  const [questionOrder, setQuestionOrder] = useState<Question[]>([]);
  const [draftSessionRef, setDraftSessionRef] = useState<string>(freshId);
  const [startedAt, setStartedAt] = useState(Date.now);
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now);
  const [choice, setChoice] = useState('');
  const [typedAnswer, setTypedAnswer] = useState('');
  const [orderAnswer, setOrderAnswer] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState('');
  const [speechScore, setSpeechScore] = useState<number | null>(null);
  const [speechDurationMs, setSpeechDurationMs] = useState<number | null>(null);
  const [speechDurationSource, setSpeechDurationSource] = useState<'speech-events' | 'recognition-window' | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioRate, setAudioRate] = useState(0.75);
  const [sessionResult, setSessionResult] = useState<Awaited<ReturnType<typeof submitSession.mutateAsync>> | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [ready, setReady] = useState(false);
  const [sessionKind, setSessionKind] = useState<LanguageSessionInput['sessionKind']>('lesson');
  const [displayHearts, setDisplayHearts] = useState<number | null>(null);
  const [reaction, setReaction] = useState<'correct' | 'wrong' | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reminderVariant, setReminderVariant] = useState<'early' | 'late' | null>(null);
  const recognitionRef = useRef<SpeechRecognizer | null>(null);
  const recognitionStartedAtRef = useRef<number | null>(null);
  const speechStartedAtRef = useRef<number | null>(null);
  const measuredSpeechDurationRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedStorageKey = useRef<string | null>(null);
  const trackedSessionStart = useRef<string | null>(null);
  const trackedSessionCompletion = useRef<string | null>(null);
  const question = questionOrder[index];

  useEffect(() => {
    const variant = getExperimentVariant('streak_reminder_timing');
    setReminderVariant(variant === 'early' || variant === 'late' ? variant : null);
    trackNextDayReturn('language_study');
  }, []);

  useEffect(() => {
    if (!ready || sessionResult || trackedSessionStart.current === draftSessionRef) return;
    trackedSessionStart.current = draftSessionRef;
    trackEvent('language_session_started', { level, session_kind: sessionKind, language_code: languageCode, practice_mode: practiceMode });
  }, [draftSessionRef, ready, sessionKind, sessionResult, languageCode, level, practiceMode]);

  useEffect(() => {
    if (!storageKey || !progressQuery.data || !gamificationQuery.data || !contentQuery.data) return;
    if (loadedStorageKey.current === storageKey) return;
    loadedStorageKey.current = storageKey;
    let restoredPracticeMode: PracticeMode = 'mixed';
    let restoredOrder = questions;
    let restoredSessionKind: LanguageSessionInput['sessionKind'] | undefined;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const draft = JSON.parse(saved) as Draft;
        if (draft.answers.length <= 12 && draft.sessionRef) {
          restoredPracticeMode = draft.practiceMode
            ?? (draft.audioOnly ? 'listening' : 'mixed');
          restoredOrder = buildQuestions(contentItems, dueIds, languageCode, restoredPracticeMode);
          const byId = new Map(restoredOrder.map(entry => [entry.item.id, entry]));
          const orderMatches = !draft.questionIds || (
            draft.questionIds.length === restoredOrder.length &&
            draft.questionIds.every(id => byId.has(id))
          );
          if (orderMatches) {
            if (draft.questionIds?.length) restoredOrder = draft.questionIds.map(id => byId.get(id)!);
            setDraftSessionRef(draft.sessionRef);
            restoredSessionKind = draft.sessionKind;
            setIndex(Math.min(draft.index, Math.max(0, restoredOrder.length - 1)));
            setAnswers(draft.answers.map(answer => ({
              contentId: answer.contentId,
              mode: answer.mode,
              submittedAnswer: (answer.submittedAnswer ?? answer.responseText ?? answer.correctAnswer).slice(0, 512),
              isCorrect: Boolean(answer.isCorrect),
              responseMs: answer.responseMs,
              correctAnswer: answer.correctAnswer,
              explanation: answer.explanation,
              pronunciationScore: answer.pronunciationScore,
            })));
            if (draft.answers.length === restoredOrder.length && restoredOrder.length >= 10) {
              setSubmitError('تعذّر حفظ الجلسة. أعد المحاولة؛ ستبقى إجاباتك محفوظة على هذا الجهاز.');
            }
            setStartedAt(draft.startedAt);
          } else {
            setDraftSessionRef(freshId());
            setIndex(0);
            setAnswers([]);
            setStartedAt(Date.now());
          }
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
    const reviewAvailable = progressQuery.data.dueReviews.length >= 10;
    const canReviewAtZero = gamificationQuery.data.profile.hearts === 0 && reviewAvailable;
    const nextSessionKind = restoredSessionKind === 'review' && reviewAvailable
      ? 'review'
      : restoredSessionKind === 'lesson'
        ? 'lesson'
        : canReviewAtZero ? 'review' : 'lesson';
    setSessionKind(nextSessionKind);
    setPracticeMode(nextSessionKind === 'lesson' ? restoredPracticeMode : 'mixed');
    setDisplayHearts(gamificationQuery.data.profile.hearts);
    setQuestionOrder(restoredOrder);
    setReady(true);
  }, [storageKey, progressQuery.data, gamificationQuery.data, contentQuery.data, contentItems, questions, dueIds, languageCode]);

  useEffect(() => {
    if (!ready || !storageKey || sessionResult) return;
    const hasSpeechAnswers = answers.some(answer => answer.mode === 'pronunciation');
    const draft: Draft = hasSpeechAnswers
      ? {
          sessionRef: draftSessionRef,
          startedAt: Date.now(),
          index: 0,
          answers: [],
          questionIds: questionOrder.map(entry => entry.item.id),
          sessionKind,
          practiceMode,
        }
      : {
          sessionRef: draftSessionRef, startedAt, index, answers,
          questionIds: questionOrder.map(entry => entry.item.id),
          sessionKind,
          practiceMode,
        };
    localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [ready, storageKey, sessionResult, draftSessionRef, startedAt, index, answers, questionOrder, sessionKind, practiceMode]);

  useEffect(() => {
    if (!ready || sessionResult) return;
    const interval = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, [ready, sessionResult, startedAt]);

  useEffect(() => {
    recognitionRef.current?.stop?.();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsAudioPlaying(false);
    setChoice('');
    setTypedAnswer('');
    setOrderAnswer([]);
    setChecked(false);
    setCorrectionMode(false);
    setRecognitionStatus('');
    setSpeechScore(null);
    setSpeechDurationMs(null);
    setSpeechDurationSource(null);
    recognitionStartedAtRef.current = null;
    speechStartedAtRef.current = null;
    measuredSpeechDurationRef.current = null;
    setIsListening(false);
    setReaction(null);
    setQuestionStartedAt(Date.now());
  }, [index]);

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const options = question?.mode === 'choice'
    ? makeOptions(question.item, contentItems)
    : question?.mode === 'listening' ? makeListeningOptions(question.item, contentItems) : [];
  const tokens = question?.mode === 'order' ? shuffledTokens(question.item.english) : [];
  const pronunciationMatchScore = question?.mode === 'pronunciation'
    ? speechScore ?? (typedAnswer.trim() ? scoreSpokenText(question.item.english, typedAnswer) : null)
    : null;
  const isCorrect = question
    ? question.mode === 'pronunciation'
      ? pronunciationMatchScore !== null && pronunciationMatchScore >= 80
      : resolveCorrect(question, choice, typedAnswer, orderAnswer)
    : false;
  const canCheck = !isListening && (
    question?.mode === 'choice' || question?.mode === 'listening'
      ? !!choice
      : question?.mode === 'order' ? orderAnswer.length > 0 : !!typedAnswer.trim()
  );
  const canRewriteSentence = question?.item.kind === 'sentence' &&
    (question.mode === 'recall' || question.mode === 'pronunciation');
  const speechDurationLabel = speechDurationMs === null
    ? ''
    : (speechDurationMs / 1000).toLocaleString('ar', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function resolveCorrect(current: Question, selected: string, typed: string, ordered: string[]) {
    const response = current.mode === 'choice' || current.mode === 'listening'
      ? selected
      : current.mode === 'order'
        ? ordered.join(' ')
        : typed;
    return gradeLanguageAnswer(current.item, current.mode, response)?.isCorrect ?? false;
  }

  const nextQuestion = () => {
    if (!question || !checked) return;
    const sentenceNeedsRewrite = question.item.kind === 'sentence' && (question.mode === 'recall' || question.mode === 'pronunciation');
    if (sentenceNeedsRewrite && !isCorrect) {
      setDisplayHearts(current => Math.max(0, (current ?? gamificationQuery.data?.profile.hearts ?? 0) - 1));
    }
    const correctAnswer = question.mode === 'listening' ? question.item.arabic : question.item.english;
    const submittedAnswer = (question.mode === 'choice' || question.mode === 'listening'
      ? choice
      : question.mode === 'order'
        ? orderAnswer.join(' ')
        : typedAnswer).slice(0, 512);
    const record: ResponseRecord = {
      contentId: question.item.id, mode: question.mode, isCorrect,
      submittedAnswer,
      responseMs: Math.min(120_000, Math.max(0, Date.now() - questionStartedAt)),
      correctAnswer, explanation: !isCorrect ? question.item.grammarNote : undefined,
      pronunciationScore: question.mode === 'pronunciation' ? pronunciationMatchScore : null,
    };
    const nextAnswers = [...answers.filter(answer => answer.contentId !== record.contentId), record];
    const nextIndex = index + 1;
    const recent = nextAnswers.slice(-3);
    const recentAccuracy = recent.filter(answer => answer.isCorrect).length / recent.length;
    const recentTime = recent.reduce((sum, answer) => sum + answer.responseMs, 0) / recent.length;
    const makeEasier = recentAccuracy < 0.5 || recentTime > 13_000;
    const remaining = questionOrder.slice(index + 1);
    const phaseOrdered = (['choice', 'listening', 'order', 'recall', 'pronunciation'] as LanguageQuestionMode[])
      .flatMap(mode => remaining.filter(entry => entry.mode === mode)
        .sort((a, b) => makeEasier ? a.item.difficulty - b.item.difficulty : b.item.difficulty - a.item.difficulty));
    setQuestionOrder([...questionOrder.slice(0, index + 1), ...phaseOrdered]);
    setAnswers(nextAnswers);
    if (nextIndex < questionOrder.length) setIndex(nextIndex);
    else {
      const input: LanguageSessionInput = {
        sessionRef: draftSessionRef,
        languageCode,
        level,
        sessionKind,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        elapsedSeconds: Math.min(3600, Math.floor((Date.now() - startedAt) / 1000)),
        answers: nextAnswers.map(({ contentId, mode, submittedAnswer: response, responseMs }) => ({
          contentId, mode, submittedAnswer: response, responseMs,
        })),
      };
      setSubmitError('');
      submitSession.mutate({ data: input }, {
        onSuccess: async result => {
          if (trackedSessionCompletion.current !== draftSessionRef) {
            trackedSessionCompletion.current = draftSessionRef;
            trackEvent('language_session_completed', {
              level,
              session_kind: sessionKind,
              correct_answers: result.answerResults.filter(answer => answer.isCorrect).length,
              total_questions: result.answerResults.length,
            });
          }
          const verified = new Map(result.answerResults.map(answer => [answer.contentId, answer]));
          setAnswers(current => current.map(answer => {
            const resultForAnswer = verified.get(answer.contentId);
            return resultForAnswer
              ? { ...answer, isCorrect: resultForAnswer.isCorrect, pronunciationScore: resultForAnswer.pronunciationScore }
              : answer;
          }));
          setSessionResult(result);
          if (result.gamification) {
            setDisplayHearts(result.gamification.profile.hearts);
            queryClient.setQueryData(getGetLanguageGamificationQueryKey(progressParams), result.gamification);
          }
          if (storageKey) localStorage.removeItem(storageKey);
          await queryClient.invalidateQueries({ queryKey: getGetLanguageLearningProgressQueryKey(progressLevelParams) });
        },
        onError: () => setSubmitError(
          answers.some(answer => answer.mode === 'pronunciation')
            ? 'تعذّر حفظ الجلسة. إجابات النطق لا تُحفظ على الجهاز؛ أعد المحاولة من الصفحة الحالية.'
            : 'تعذّر حفظ الجلسة. أعد المحاولة؛ ستبقى إجاباتك محفوظة على هذا الجهاز.',
        ),
      });
    }
  };

  const retrySave = () => {
    if (answers.length < 10 || answers.length !== questionOrder.length) return;
    const input: LanguageSessionInput = {
      sessionRef: draftSessionRef, languageCode, level,
      sessionKind,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      elapsedSeconds: Math.min(3600, Math.floor((Date.now() - startedAt) / 1000)),
      answers: answers.map(({ contentId, mode, submittedAnswer, responseMs }) => ({
        contentId, mode, submittedAnswer, responseMs,
      })),
    };
    setSubmitError('');
    submitSession.mutate({ data: input }, {
      onSuccess: async result => {
        if (trackedSessionCompletion.current !== draftSessionRef) {
          trackedSessionCompletion.current = draftSessionRef;
          trackEvent('language_session_completed', {
            level,
            session_kind: sessionKind,
            correct_answers: result.answerResults.filter(answer => answer.isCorrect).length,
            total_questions: result.answerResults.length,
          });
        }
        const verified = new Map(result.answerResults.map(answer => [answer.contentId, answer]));
        setAnswers(current => current.map(answer => {
          const resultForAnswer = verified.get(answer.contentId);
          return resultForAnswer
            ? { ...answer, isCorrect: resultForAnswer.isCorrect, pronunciationScore: resultForAnswer.pronunciationScore }
            : answer;
        }));
        setSessionResult(result);
        if (result.gamification) {
          setDisplayHearts(result.gamification.profile.hearts);
          queryClient.setQueryData(getGetLanguageGamificationQueryKey(progressParams), result.gamification);
        }
        if (storageKey) localStorage.removeItem(storageKey);
        await queryClient.invalidateQueries({ queryKey: getGetLanguageLearningProgressQueryKey(progressLevelParams) });
      },
      onError: () => setSubmitError('تعذّر حفظ الجلسة. تحقق من الاتصال ثم حاول مرة أخرى.'),
    });
  };

  const speak = () => {
    if (!question || !('speechSynthesis' in window)) {
      setRecognitionStatus('ميزة النطق الصوتي غير متاحة في هذا المتصفح.');
      return;
    }
    if (isAudioPlaying) {
      window.speechSynthesis.cancel();
      setIsAudioPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question.item.english);
    utterance.lang = languageLocales[languageCode];
    utterance.rate = audioRate;
    utterance.onend = () => setIsAudioPlaying(false);
    utterance.onerror = () => {
      setIsAudioPlaying(false);
      setRecognitionStatus('تعذّر تشغيل الصوت؛ جرّب مرة أخرى.');
    };
    window.speechSynthesis.speak(utterance);
    setIsAudioPlaying(true);
    setRecognitionStatus('استمع جيدًا، يمكنك إعادة تشغيل الصوت.');
  };

  const startRecognition = () => {
    const SpeechRecognitionApi = (window as Window & { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognizer }).webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      setRecognitionStatus('التعرّف الصوتي غير متاح هنا؛ اكتب إجابتك في الحقل.');
      setSpeechScore(null);
      inputRef.current?.focus();
      return;
    }
    recognitionRef.current?.stop?.();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsAudioPlaying(false);
    setTypedAnswer('');
    setSpeechScore(null);
    setSpeechDurationMs(null);
    setSpeechDurationSource(null);
    recognitionStartedAtRef.current = performance.now();
    speechStartedAtRef.current = null;
    measuredSpeechDurationRef.current = null;
    const recognition = new SpeechRecognitionApi();
    recognition.lang = languageLocales[languageCode];
    recognition.interimResults = false;
    recognition.onstart = () => {
      recognitionStartedAtRef.current = performance.now();
    };
    recognition.onspeechstart = () => {
      speechStartedAtRef.current = performance.now();
      measuredSpeechDurationRef.current = null;
      setSpeechDurationMs(null);
      setSpeechDurationSource(null);
    };
    recognition.onspeechend = () => {
      if (speechStartedAtRef.current === null) return;
      const duration = Math.max(0, Math.round(performance.now() - speechStartedAtRef.current));
      measuredSpeechDurationRef.current = duration;
      setSpeechDurationMs(duration);
      setSpeechDurationSource('speech-events');
    };
    recognition.onresult = event => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setTypedAnswer(transcript);
      setSpeechScore(transcript && question ? scoreSpokenText(question.item.english, transcript) : null);
      if (measuredSpeechDurationRef.current === null) {
        const start = speechStartedAtRef.current ?? recognitionStartedAtRef.current;
        if (start !== null) {
          const duration = Math.max(0, Math.round(performance.now() - start));
          measuredSpeechDurationRef.current = duration;
          setSpeechDurationMs(duration);
          setSpeechDurationSource('recognition-window');
        }
      }
      setRecognitionStatus(transcript ? `سمعنا: ${transcript}` : 'لم نلتقط عبارة واضحة؛ يمكنك الكتابة.');
    };
    recognition.onerror = () => {
      setIsListening(false);
      setRecognitionStatus('تعذّر إكمال التعرّف؛ تحقق من إذن الميكروفون أو اكتب إجابتك.');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    setRecognitionStatus('تحدّث الآن، وسنعرض مدى تطابق الكلمات.');
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setRecognitionStatus('تعذّر تشغيل الميكروفون؛ تحقق من إذن المتصفح.');
    }
  };

  const restart = () => {
    const zeroHearts = gamificationQuery.data?.profile.hearts === 0;
    const canReview = dueReviewCount >= 10;
    const nextKind = zeroHearts && canReview ? 'review' : 'lesson';
    setSessionResult(null);
    setSubmitError('');
    setAnswers([]);
    setQuestionOrder(buildQuestions(contentItems, nextKind === 'review' ? dueIds : [], languageCode, 'mixed'));
    setPracticeMode('mixed');
    setIndex(0);
    setDraftSessionRef(freshId());
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    setSessionKind(nextKind);
    setDisplayHearts(gamificationQuery.data?.profile.hearts ?? null);
  };

  const selectSession = (kind: LanguageSessionInput['sessionKind'], mode: PracticeMode = 'mixed') => {
    setSessionKind(kind);
    setPracticeMode(mode);
    setQuestionOrder(buildQuestions(contentItems, kind === 'review' ? dueIds : [], languageCode, mode));
    setIndex(0);
    setAnswers([]);
    setDraftSessionRef(freshId());
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    setSubmitError('');
  };

  const changeLanguage = (nextLanguage: SupportedLanguageCode) => {
    if (nextLanguage === languageCode) return;
    setLanguageCode(nextLanguage);
    setPracticeMode('mixed');
    setSessionKind('lesson');
    setLevel('A1');
    setReady(false);
    loadedStorageKey.current = null;
    setQuestionOrder([]);
    setIndex(0);
    setAnswers([]);
    setSessionResult(null);
    setSubmitError('');
    setDraftSessionRef(freshId());
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    setDisplayHearts(null);
    setReady(false);
    loadedStorageKey.current = null;
  };

  const changeLevel = (nextLevel: LanguageSessionInput['level']) => {
    if (nextLevel === level) return;
    setLevel(nextLevel);
    setReady(false);
    loadedStorageKey.current = null;
    setQuestionOrder([]);
    setIndex(0);
    setAnswers([]);
    setSessionResult(null);
    setSubmitError('');
    setDraftSessionRef(freshId());
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    setSessionKind('lesson');
    setPracticeMode('mixed');
  };

  useEffect(() => {
    if (enabledLanguages.length && !enabledLanguages.includes(languageCode)) {
      changeLanguage(enabledLanguages[0]);
    }
  }, [enabledLanguages, languageCode]);

  const checkAnswer = () => {
    if (!canCheck || checked) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsAudioPlaying(false);
    setChecked(true);
    setReaction(isCorrect ? 'correct' : 'wrong');
    window.setTimeout(() => setReaction(null), 700);
    const sentenceNeedsRewrite = question?.item.kind === 'sentence' && (question.mode === 'recall' || question.mode === 'pronunciation');
    if (!isCorrect) {
      trackEvent('language_answer_incorrect', { level, mode: question?.mode ?? 'unknown' });
      if (!sentenceNeedsRewrite) {
        setDisplayHearts(current => Math.max(0, (current ?? gamificationQuery.data?.profile.hearts ?? 0) - 1));
      }
    } else if (correctionMode) {
      setRecognitionStatus('أحسنت، صححت الجملة بعد إعادة كتابتها.');
    }
    const profile = gamificationQuery.data?.profile;
    const duration = isCorrect ? 0.13 : 0.16;
    if (profile?.soundEnabled && 'AudioContext' in window) {
      try {
        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = isCorrect ? 'sine' : 'triangle';
        oscillator.frequency.value = isCorrect ? 660 : 220;
        gain.gain.setValueAtTime(0.035, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(); oscillator.stop(audio.currentTime + duration);
        oscillator.onended = () => void audio.close();
      } catch { /* Audio feedback is optional. */ }
    }
    if (profile?.vibrationEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(isCorrect ? 28 : 90);
    }
  };

  const retrySentence = () => {
    setCorrectionMode(true);
    setChecked(false);
    setTypedAnswer('');
    setSpeechScore(null);
    setSpeechDurationMs(null);
    setSpeechDurationSource(null);
    setRecognitionStatus('اكتب الجملة مرة أخرى أو انطقها من جديد.');
    recognitionStartedAtRef.current = null;
    speechStartedAtRef.current = null;
    measuredSpeechDurationRef.current = null;
    setQuestionStartedAt(Date.now());
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const toggleSetting = (setting: 'soundEnabled' | 'vibrationEnabled', value: boolean) => {
    setSettingsError('');
    updateSettings.mutate({ data: { languageCode, [setting]: value } }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetLanguageGamificationQueryKey(progressParams) });
      },
      onError: () => setSettingsError('تعذّر حفظ الإعداد. حاول مرة أخرى.'),
    });
  };

  const buyFreeze = () => {
    setPurchaseMessage('');
    purchaseFreeze.mutate({ data: { languageCode } }, {
      onSuccess: async () => {
        setPurchaseMessage('أضيف رصيد تجميد السلسلة إلى حسابك.');
        await queryClient.invalidateQueries({ queryKey: getGetLanguageGamificationQueryKey(progressParams) });
      },
      onError: () => setPurchaseMessage('تعذّر إتمام الشراء. تحقق من رصيد الجواهر وحاول مجددًا.'),
    });
  };

  const dueById = useMemo(() => new Map((progressQuery.data?.dueReviews ?? []).map(review => [review.contentId, review])), [progressQuery.data?.dueReviews]);
  const dueReviewCount = progressQuery.data?.dueReviews?.length ?? 0;
  const zeroHeartSessionBlocked = gamificationQuery.data?.profile.hearts === 0
    && (sessionKind !== 'review' || dueReviewCount < 10);
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');
  const languageName = languageLabels[languageCode];
  const practiceName = practiceMode === 'listening' ? 'جلسة استماع' : practiceMode === 'speaking' ? 'تمرين نطق' : 'درس متنوع';

  return (
    <main className={`language-study ${pageSettings.layoutOrder === 'game-first' ? 'is-game-first' : ''}`} style={{ '--language-accent': pageSettings.accentColor } as CSSProperties} dir="rtl">
      <header className="ls-head">
        <div className="ls-brand" aria-label="أثر">
          <img src={`${import.meta.env.BASE_URL}athar-wordmark.png`} alt="أثر" onError={event => { event.currentTarget.style.display = 'none'; }} />
        </div>
        <span className="ls-head-divider" />
        <span className="ls-head-title">مساحة التعلّم · {languageName}</span>
        <div className="ls-private"><LockKeyhole size={14} aria-hidden="true" /> تقدّمك محفوظ لحسابك</div>
      </header>

      <div className="ls-wrap">
        <div className="ls-heading">
          <div>
            <span className="ls-eyebrow">مراجعة وتعلّم</span>
            <h1>{pageSettings.title}</h1>
            <p>{pageSettings.subtitle}</p>
          </div>
            <div className="ls-language-switch">
              <label className="ls-language-select"><span>اللغة</span><select value={languageCode} onChange={event => changeLanguage(event.target.value as SupportedLanguageCode)} aria-label="اختر اللغة" data-testid="select-language">
                {supportedLanguages.filter(language => enabledLanguages.includes(language.code)).map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
              </select></label>
              <label className="ls-language-select"><span>المستوى</span><select value={level} onChange={event => changeLevel(event.target.value as LanguageSessionInput['level'])} aria-label="اختر المستوى">
                {(['A1', 'A2', 'B1', 'B2'] as const).map(value => <option key={value}>{value}</option>)}
              </select></label>
            </div>
        </div>

        {pageSettings.showConversation && <LanguageConversationPanel languageCode={languageCode}/>}

        <div className="ls-main-grid">
          <section className="ls-workspace" aria-label={`جلسة تعلّم ${languageName}`}>
            {(progressQuery.isLoading || gamificationQuery.isLoading || contentQuery.isLoading) && <div aria-label="جارٍ تحميل الدرس"><div className="ls-skeleton" /><div className="ls-skeleton" /><div className="ls-skeleton" /></div>}
            {(progressQuery.isError || gamificationQuery.isError || contentQuery.isError || languageSettingsQuery.isError) && (
              <div className="ls-state" role="alert">
                <CircleAlert size={27} />
                <h2>تعذّر تحميل بيانات التعلّم</h2>
                <p>تحقق من اتصالك ثم أعد المحاولة. لن نفقد المسودة المحفوظة على هذا الجهاز.</p>
                <button className="ls-secondary" data-testid="button-retry-progress" onClick={() => { void progressQuery.refetch(); void gamificationQuery.refetch(); void contentQuery.refetch(); void languageSettingsQuery.refetch(); }}><RotateCcw size={14} /> إعادة المحاولة</button>
              </div>
            )}
            {!progressQuery.isLoading && !gamificationQuery.isLoading && !contentQuery.isLoading && !progressQuery.isError && !gamificationQuery.isError && !contentQuery.isError && !languageSettingsQuery.isError && !ready && <div aria-label="استعادة المسودة"><div className="ls-skeleton" /><div className="ls-skeleton" /></div>}
            {!progressQuery.isLoading && !gamificationQuery.isLoading && !contentQuery.isLoading && !progressQuery.isError && !gamificationQuery.isError && !contentQuery.isError && !languageSettingsQuery.isError && ready && (
              sessionResult ? (
                <div className="ls-result" data-testid="status-session-saved">
                  <div className="ls-result-icon"><Check size={27} /></div>
                  <span className="ls-eyebrow">اكتملت الجلسة</span>
                  <h2>أحسنت التقدّم</h2>
                  <div className="ls-score"><strong>{sessionResult.session.correctAnswers}</strong><span>من</span><strong>{sessionResult.session.totalQuestions}</strong><span>إجابة صحيحة</span></div>
                  <p>حُفظت إجاباتك ومواعيد المراجعة القادمة في حسابك.</p>
                  <span className="ls-saved"><Check size={14} /> تم الحفظ {sessionResult.duplicate ? 'مسبقًا' : 'بنجاح'}</span>
                  {sessionResult.gamification && <div className="ls-earned" role="status"><b>مكاسب هذه الجلسة</b><span>{sessionResult.gamification.profile.xpTotal} نقطة خبرة إجمالًا</span><span>{sessionResult.gamification.profile.gems} جوهرة في رصيدك</span></div>}
                  <div className="ls-explanations">
                    <h3>مراجعة إجاباتك</h3>
                    {answers.map((answer, answerIndex) => {
                      const item = contentItems.find(entry => entry.id === answer.contentId);
                      if (!item) return null;
                      return (
                        <div className="ls-explanation" key={answer.contentId} data-testid={`review-answer-${answerIndex}`}>
                          <b dir="ltr">{item.english}</b>
                          <p>{item.arabic} · {answer.isCorrect ? 'إجابة صحيحة' : `${answer.mode === 'listening' ? 'المعنى الصحيح' : 'الإجابة الصحيحة'}: ${answer.correctAnswer}`}</p>
                          {!answer.isCorrect && answer.explanation && <p>{answer.explanation}</p>}
                          {item.exampleEnglish && <p dir="ltr">{item.exampleEnglish}</p>}
                        </div>
                      );
                    })}
                  </div>
                  <button className="ls-secondary" data-testid="button-start-another-session" onClick={restart}><RotateCcw size={14} /> جلسة جديدة</button>
                </div>
              ) : questionOrder.length >= 10 && answers.length === questionOrder.length && submitError ? (
                <div className="ls-state" role="alert">
                  <CircleAlert size={27} />
                  <h2>إجاباتك جاهزة للحفظ</h2>
                  <p>{submitError}</p>
                  <button className="ls-primary" data-testid="button-retry-save-session" disabled={submitSession.isPending} onClick={retrySave}>
                    {submitSession.isPending ? 'جارٍ الحفظ…' : 'إعادة حفظ الجلسة'}
                  </button>
                </div>
              ) : question && questionOrder.length >= 10 && !zeroHeartSessionBlocked ? (
                <>
                  {answers.length === 0 && index === 0 && <div className="ls-session-switch" aria-label="اختيار نوع الجلسة">
                    <button className={sessionKind === 'lesson' && practiceMode === 'mixed' ? 'is-active' : ''} disabled={gamificationQuery.data?.profile.hearts === 0} onClick={() => selectSession('lesson')} data-testid="button-select-lesson">
                      درس متنوع <small>{questionOrder.length} سؤالًا بأنماط متعددة</small>
                    </button>
                    <button className={sessionKind === 'lesson' && practiceMode === 'listening' ? 'is-active' : ''} disabled={gamificationQuery.data?.profile.hearts === 0} onClick={() => selectSession('lesson', 'listening')} data-testid="button-select-listening">
                      تعلّم بالاستماع <small>{questionOrder.length} سؤالًا صوتيًا</small>
                    </button>
                    <button className={sessionKind === 'lesson' && practiceMode === 'speaking' ? 'is-active' : ''} disabled={gamificationQuery.data?.profile.hearts === 0} onClick={() => selectSession('lesson', 'speaking')} data-testid="button-select-speaking">
                      تدرّب على النطق <small>قل الكلمات والعبارات</small>
                    </button>
                    <button className={sessionKind === 'review' ? 'is-active' : ''} disabled={dueReviewCount < 10} onClick={() => selectSession('review')} data-testid="button-select-review">
                      مراجعة مستحقة <small>{dueReviewCount} عناصر</small>
                    </button>
                  </div>}
                  <div className="ls-progress-top">
                    <span>{sessionKind === 'review' ? 'مراجعة مستحقة · ' : practiceMode !== 'mixed' ? `${practiceName} · ` : ''}السؤال {index + 1} من {questionOrder.length}{dueById.has(question.item.id) ? ' · مراجعة مستحقة' : ''}</span>
                    <strong dir="ltr">{minutes}:{seconds}</strong>
                  </div>
                  <div className="ls-progress-track" aria-label={`التقدم ${Math.round(((index + 1) / questionOrder.length) * 100)}%`}><span style={{ width: `${((index + 1) / questionOrder.length) * 100}%` }} /></div>
                  <div className="ls-question" key={`${question.item.id}-${question.mode}`}>
                    <div className="ls-q-meta"><span className="ls-mode-tag">{modeName[question.mode]}</span><span>{question.item.kind === 'word' ? question.item.category : 'عبارة قصيرة'}</span></div>
                    <h2 className="ls-prompt" dir={question.mode === 'pronunciation' ? 'ltr' : 'rtl'}>
                      {question.mode === 'pronunciation'
                        ? question.item.english
                        : question.mode === 'listening'
                          ? question.item.kind === 'word' ? 'ما معنى الكلمة التي سمعتها؟' : 'ما معنى العبارة التي سمعتها؟'
                          : question.item.arabic}
                    </h2>
                    <p className="ls-instruction">{modeHint[question.mode]}</p>

                    {question.mode === 'listening' && <div className="ls-audio-practice" data-testid="listening-practice">
                      <div className="ls-audio-practice-copy"><Headphones size={18}/><div><b>استمع إلى {languageName}</b><span>يمكنك إعادة الصوت أو إبطاؤه. لا نحتاج إلى تسجيل صوتك.</span></div></div>
                      <div className="ls-audio-controls">
                        <button className="ls-icon-button" type="button" aria-pressed={isAudioPlaying} data-testid="button-play-listening-audio" onClick={speak}>
                          <Volume2 size={15}/>{isAudioPlaying ? 'إيقاف الصوت' : 'تشغيل الصوت'}
                        </button>
                        <label className="ls-audio-speed"><span>سرعة الصوت</span><select value={audioRate} onChange={event => setAudioRate(Number(event.target.value))} aria-label="سرعة الصوت" data-testid="select-listening-speed">
                          <option value={0.75}>بطيء</option><option value={0.95}>طبيعي</option>
                        </select></label>
                      </div>
                      {recognitionStatus && <p className="ls-speech-hint" role="status">{recognitionStatus}</p>}
                    </div>}

                    {question.mode === 'choice' && (
                      <div className="ls-options" role="group" aria-label="خيارات المعنى">
                        {options.map((option, optionIndex) => {
                          const selected = choice === option;
                          const state = checked ? option === question.item.english ? 'correct' : selected ? 'wrong' : '' : selected ? 'selected' : '';
                          return <button key={option} className={`ls-option ${state}`} data-testid={`choice-option-${optionIndex}`} disabled={checked} onClick={() => setChoice(option)}>
                            <span className="ls-option-key">{String.fromCharCode(65 + optionIndex)}</span><span dir="ltr">{option}</span>
                          </button>;
                        })}
                      </div>
                    )}
                    {question.mode === 'listening' && (
                      <div className="ls-options ls-listening-options" role="group" aria-label="اختر معنى الصوت">
                        {options.map((option, optionIndex) => {
                          const selected = choice === option;
                          const correctOption = option === question.item.arabic;
                          const state = checked ? correctOption ? 'correct' : selected ? 'wrong' : '' : selected ? 'selected' : '';
                          return <button key={option} className={`ls-option ${state}`} data-testid={`listening-option-${optionIndex}`} disabled={checked} onClick={() => setChoice(option)}>
                            <span className="ls-option-key">{String.fromCharCode(65 + optionIndex)}</span><span dir="rtl">{option}</span>
                          </button>;
                        })}
                      </div>
                    )}
                    {question.mode === 'order' && (
                      <>
                        <div className="ls-order-zone" aria-label="الكلمات المرتبة">
                          {orderAnswer.length ? orderAnswer.map((token, tokenIndex) => <button className="ls-token" key={`${token}-${tokenIndex}`} disabled={checked} onClick={() => setOrderAnswer(orderAnswer.filter((_, position) => position !== tokenIndex))}>{token}</button>) : <span className="ls-speech-hint">اختر الكلمات بالترتيب لتكوين العبارة</span>}
                        </div>
                        <div className="ls-options" dir="ltr">
                          {tokens.map((token, tokenIndex) => {
                            const used = orderAnswer.filter(value => value === token).length;
                            const available = tokens.slice(0, tokenIndex).filter(value => value === token).length >= used;
                            return <button key={`${token}-${tokenIndex}`} className={`ls-token ${!available ? 'ls-token-muted' : ''}`} disabled={!available || checked} onClick={() => setOrderAnswer([...orderAnswer, token])}>{token}</button>;
                          })}
                        </div>
                      </>
                    )}
                    {question.mode === 'recall' && (
                      <input ref={inputRef} className="ls-answer-input" data-testid="input-recall-answer" value={typedAnswer} maxLength={512} onChange={event => setTypedAnswer(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && canCheck && !checked) checkAnswer(); }} placeholder="اكتب الكلمة باللغة التي تتعلمها" dir="ltr" disabled={checked} />
                    )}
                    {question.mode === 'pronunciation' && (
                      <>
                        <div className="ls-speech-row">
                          <button className="ls-icon-button" data-testid="button-play-pronunciation" onClick={speak}><Volume2 size={15} /> استمع</button>
                          <button className="ls-icon-button" data-testid="button-start-recognition" aria-pressed={isListening} disabled={isListening || checked} onClick={startRecognition}><Headphones size={15} /> {isListening ? 'جارٍ الاستماع…' : `قل ${question.item.kind === 'word' ? 'الكلمة' : 'العبارة'}`}</button>
                        </div>
                        <input ref={inputRef} className="ls-answer-input" data-testid="input-pronunciation-answer" value={typedAnswer} maxLength={512} onChange={event => { setTypedAnswer(event.target.value); setSpeechScore(null); setSpeechDurationMs(null); setSpeechDurationSource(null); }} onKeyDown={event => { if (event.key === 'Enter' && canCheck && !checked) checkAnswer(); }} placeholder={`اكتب ${question.item.kind === 'word' ? 'الكلمة' : 'العبارة'} كما سمعتها`} dir="ltr" disabled={checked} />
                        {recognitionStatus && <p className="ls-speech-hint" role="status">{recognitionStatus}</p>}
                        {pronunciationMatchScore !== null && (
                          <div className={`ls-pronunciation-score ${pronunciationMatchScore >= 80 ? 'is-strong' : ''}`} role="status" data-testid="pronunciation-match-score">
                            <div className="ls-pronunciation-score-heading"><b>تقدير مطابقة الكلمات</b><strong>{pronunciationMatchScore.toLocaleString('ar')}٪</strong></div>
                            <div className="ls-pronunciation-score-meter" role="meter" aria-label="تقدير تقريبي لمطابقة الكلمات التي تعرف عليها المتصفح" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pronunciationMatchScore}>
                              <span style={{ width: `${pronunciationMatchScore}%` }} />
                            </div>
                            <small>{speechScore !== null ? 'تقدير تقريبي للكلمات التي التقطها المتصفح، وليس قياسًا دقيقًا لجودة الصوت أو اللهجة.' : 'مطابقة النص المكتوب لا تقيس النطق الصوتي.'} تُقبل الإجابة عند ٨٠٪ فأكثر.</small>
                          </div>
                        )}
                        {speechDurationMs !== null && (
                          <div className="ls-speech-duration" role="status" data-testid="text-pronunciation-duration">
                            <div><b>{pronunciationMatchScore !== null && pronunciationMatchScore >= 80 ? 'تطابق المتصفح مع الإجابة خلال' : 'مدة المحاولة'}</b><strong>{speechDurationLabel} ث</strong></div>
                            <small>{speechDurationSource === 'speech-events' ? 'قياس تقريبي من بداية النطق إلى نهايته حسب المتصفح.' : 'وقت تقريبي حتى ظهور النص، وقد يشمل تأخر التعرّف.'}</small>
                          </div>
                        )}
                        <p className="ls-speech-hint">قد تعتمد المعالجة على المتصفح؛ لا يحفظ أثر التسجيل أو النص المنطوق في حسابك.</p>
                      </>
                    )}
                    {checked && (
                      <div className={`ls-feedback ${isCorrect ? '' : 'is-wrong'}`} data-testid="status-answer-feedback">
                        <strong>{correctionMode && isCorrect ? 'أحسنت، صححت الجملة بعد إعادة كتابتها.' : isCorrect ? 'إجابة صحيحة' : `${question.mode === 'listening' ? 'المعنى الصحيح' : 'الإجابة الصحيحة'}: ${question.mode === 'listening' ? question.item.arabic : question.item.english}`}</strong>
                        {canRewriteSentence && (
                          <div className="ls-sentence-correction" data-testid="sentence-correction">
                            <p><b>إجابتك</b><span dir="ltr">{typedAnswer}</span></p>
                            <p><b>الصياغة الصحيحة</b><span dir="ltr">{question.item.english}</span></p>
                          </div>
                        )}
                        {!isCorrect && question.item.grammarNote && <p>{question.item.grammarNote}</p>}
                        {question.item.exampleEnglish && <p dir="ltr">{question.item.exampleEnglish}</p>}
                        {canRewriteSentence && !isCorrect && (
                          <button className="ls-rewrite-button" type="button" onClick={retrySentence} data-testid="button-retry-sentence">
                            <RotateCcw size={14} /> امسح الجملة واكتبها تاني
                          </button>
                        )}
                      </div>
                    )}
                    <div className="ls-controls">
                      <span className="ls-speech-hint">{checked ? (isCorrect ? 'واصل بنفس الإيقاع.' : 'الخطأ فرصة لتثبيت المعلومة.') : 'خذ وقتك؛ السرعة ليست أهم من الفهم.'}</span>
                      {!checked
                        ? <button className="ls-primary" data-testid="button-check-answer" disabled={!canCheck} onClick={checkAnswer}>تحقّق <ChevronLeft size={15} /></button>
                        : <button className="ls-primary" data-testid="button-next-question" disabled={submitSession.isPending} onClick={nextQuestion}>
                          {index === questionOrder.length - 1 ? submitSession.isPending ? 'جارٍ حفظ الجلسة…' : 'إنهاء وحفظ' : 'السؤال التالي'} <ChevronLeft size={15} />
                        </button>}
                    </div>
                    {submitError && <p className="ls-error" role="alert">{submitError}</p>}
                  </div>
                  <div className="ls-workspace-foot"><span>{sessionKind === 'review' ? 'كل مراجعة تساعد على تثبيت ما تعلّمته.' : practiceMode === 'listening' ? `استمع إلى كل كلمة أو عبارة باللغة ${languageName} قبل اختيار معناها.` : practiceMode === 'speaking' ? 'انطق الكلمات والعبارات، وتابع تقدير مطابقتها.' : 'تبدأ بالتعرّف ثم تنتقل إلى الاسترجاع والاستماع والنطق.'}</span><span>{answers.filter(answer => answer.isCorrect).length} إجابة صحيحة حتى الآن</span></div>
                </>
              ) : (
                <div className="ls-state">
                  <Heart size={27} />
                  <h2>{gamificationQuery.data?.profile.hearts === 0 ? 'نستعيد طاقتك بهدوء' : 'لا توجد أسئلة متاحة الآن'}</h2>
                  <p>{gamificationQuery.data?.profile.hearts === 0
                    ? dueReviewCount >= 10
                      ? `يمكنك إكمال مراجعة من ${questionOrder.length} سؤالًا الآن. يعود القلب التالي ${gamificationQuery.data.profile.nextHeartAt ? new Date(gamificationQuery.data.profile.nextHeartAt).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' }) : 'بعد اكتمال وقت الاستعادة'}.`
                      : `تحتاج المراجعة إلى 10 عناصر مستحقة على الأقل. يعود القلب التالي ${gamificationQuery.data.profile.nextHeartAt ? new Date(gamificationQuery.data.profile.nextHeartAt).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' }) : 'بعد اكتمال وقت الاستعادة'}.`
                    : questionOrder.length < 10
                      ? `يحتاج هذا المستوى إلى 10 عناصر نشطة على الأقل قبل بدء الجلسة. المتاح الآن: ${questionOrder.length}.`
                      : 'تعذر تجهيز محتوى هذه الجلسة. أعد تحميل المراجعة للمتابعة.'}</p>
                  {gamificationQuery.data?.profile.hearts === 0 && dueReviewCount >= 10 && <button className="ls-primary" onClick={() => selectSession('review')} data-testid="button-start-zero-heart-review">ابدأ مراجعة مستحقة</button>}
                  <button className="ls-secondary" data-testid="button-refresh-empty" onClick={() => { void progressQuery.refetch(); void gamificationQuery.refetch(); }}><RotateCcw size={14} /> إعادة المحاولة</button>
                </div>
              )
            )}
          </section>

          <aside className="ls-aside">
            {pageSettings.showGamification && <section className="ls-aside-card ls-gamification">
              <div className="ls-aside-title"><h2>رصيدك اليوم</h2><Flame size={16} /></div>
              {gamificationQuery.isLoading ? <><div className="ls-skeleton" /><div className="ls-skeleton" /></>
                : gamificationQuery.isError || !gamificationQuery.data ? <div className="ls-query-error" role="alert"><span>تعذّر تحميل الرصيد.</span><button onClick={() => gamificationQuery.refetch()}>إعادة المحاولة</button></div>
                : <GamificationCard summary={gamificationQuery.data} hearts={displayHearts ?? gamificationQuery.data.profile.hearts} reaction={reaction} reminderVariant={reminderVariant} settingsPending={updateSettings.isPending} purchasePending={purchaseFreeze.isPending} settingsError={settingsError} purchaseMessage={purchaseMessage} onSettingChange={toggleSetting} onBuyFreeze={buyFreeze} showLeague={pageSettings.showLeague} showFreeze={pageSettings.showFreeze} showPreferences={pageSettings.showPreferences} gameRules={languageSettingsQuery.data?.game ?? defaultLanguageSettings.game} />}
            </section>}
            {pageSettings.showProgress && <section className="ls-aside-card">
              <div className="ls-aside-title"><h2>تقدّم {languageName}</h2><Check size={16} /></div>
              {progressQuery.isLoading ? <><div className="ls-skeleton" /><div className="ls-skeleton" /></>
                : progressQuery.isError ? <div className="ls-state"><CircleAlert size={20} /><p>بيانات التقدّم غير متاحة مؤقتًا.</p></div>
                  : progressQuery.data ? <div className="ls-stat-grid">
                    <div className="ls-stat"><strong>{progressQuery.data.dueCount}</strong><span>مراجعات مستحقة</span></div>
                    <div className="ls-stat"><strong>{progressQuery.data.reviewedCount}</strong><span>مفردات وعبارات راجعتها</span></div>
                    <div className="ls-stat"><strong>{progressQuery.data.masteredCount}</strong><span>مفردات وعبارات أتقنتها</span></div>
                    <div className="ls-stat"><strong>{progressQuery.data.sessionsCompleted}</strong><span>جلسات مكتملة</span></div>
                  </div> : <div className="ls-state"><p>ابدأ جلستك الأولى لتظهر هنا مراجعاتك.</p></div>}
            </section>}
            {pageSettings.showReviewList && <section className="ls-aside-card">
              <div className="ls-aside-title"><h2>على قائمة المراجعة</h2><ChevronRight size={16} /></div>
              {progressQuery.isLoading ? <div className="ls-skeleton" />
                : progressQuery.data?.dueReviews.length ? <div className="ls-review-list">
                  {progressQuery.data.dueReviews.slice(0, 4).map(review => {
                    const item = contentItems.find(entry => entry.id === review.contentId);
                    return <div className="ls-review-row" key={review.contentId}><b dir="ltr">{item?.english ?? `مراجعة ${languageName}`}</b><span>{new Date(review.dueAt).toLocaleDateString('ar', { month: 'short', day: 'numeric' })}</span></div>;
                  })}
                </div> : !progressQuery.isError && <div className="ls-state"><p>قائمتك خالية الآن. ستضاف الكلمات بعد مراجعتها.</p></div>}
            </section>}
            <section className="ls-aside-card">
              <div className="ls-privacy"><LockKeyhole size={15} /><span>الإجابات تُحفظ لحسابك فقط. جلسة التدريب غير المكتملة تُستعاد من هذا الجهاز.</span></div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

type GamificationCardProps = {
  summary: LanguageGamificationSummary;
  hearts: number;
  reaction: 'correct' | 'wrong' | null;
  reminderVariant: 'early' | 'late' | null;
  settingsPending: boolean;
  purchasePending: boolean;
  settingsError: string;
  purchaseMessage: string;
  onSettingChange: (setting: 'soundEnabled' | 'vibrationEnabled', value: boolean) => void;
  onBuyFreeze: () => void;
  showLeague: boolean;
  showFreeze: boolean;
  showPreferences: boolean;
  gameRules: LanguagePlatformSettings['game'];
};

const tierLabel: Record<LanguageGamificationSummary['league']['tier'], string> = {
  bronze: 'البرونزي', silver: 'الفضي', gold: 'الذهبي', diamond: 'الألماسي',
};

function GamificationCard({ summary, hearts, reaction, reminderVariant, settingsPending, purchasePending, settingsError, purchaseMessage, onSettingChange, onBuyFreeze, showLeague, showFreeze, showPreferences, gameRules }: GamificationCardProps) {
  const { profile, league } = summary;
  const reminderHour = reminderVariant === 'early' ? 17 : 20;
  const showStreakReminder = Boolean(
    reminderVariant && profile.streakAtRisk && !profile.todayStudied && new Date().getHours() >= reminderHour,
  );
  const virtualRowsPresent = league.members.some(member => member.isVirtual);
  const currentMember = league.members.find(member => member.isCurrentUser);
  const shownMembers = currentMember && currentMember.rank > 5
    ? [...league.members.slice(0, 4), currentMember]
    : league.members.slice(0, 5);

  useEffect(() => {
    if (showStreakReminder && reminderVariant) {
      trackDailyEventOnce('streak_reminder_shown', {
        experiment: 'streak_reminder_timing',
        variant: reminderVariant,
      });
    }
  }, [reminderVariant, showStreakReminder]);

  const getRange = (slotCount: number, top: boolean) => {
    if (!slotCount) return 'لا توجد هذا الأسبوع';
    const start = top ? 1 : Math.max(1, league.participantCount - slotCount + 1);
    const end = top ? slotCount : league.participantCount;
    return start === end
      ? `المركز ${start.toLocaleString('ar')}`
      : `المراكز ${start.toLocaleString('ar')}–${end.toLocaleString('ar')}`;
  };
  return (
    <>
      <div className="ls-companion-banner">
        <div className={`ls-companion-art ${reaction ? `is-${reaction}` : ''}`} aria-hidden="true">
          <svg viewBox="0 0 92 76" role="img">
            <path d="M16 62c3-17 14-26 30-26s27 9 30 26" fill="var(--athar-primary-soft)" stroke="var(--athar-primary)" strokeWidth="2" />
            <path d="M31 36c0-15 6-25 16-25s16 10 16 25c0 12-7 19-16 19s-16-7-16-19Z" fill="#f5d8b7" stroke="var(--athar-primary)" strokeWidth="2" />
            <path d="M29 34c1-16 7-27 19-27 12 0 18 10 18 25-5-4-9-10-11-16-5 7-14 12-26 13Z" fill="var(--athar-primary-deep)" />
            <circle cx="40" cy="37" r="1.8" fill="#23364c" /><circle cx="54" cy="37" r="1.8" fill="#23364c" />
            <path d="M43 44c2 2 5 2 7 0" fill="none" stroke="#a45b50" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M10 25h16M18 17v16M72 22h10" stroke="#6acdc7" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div><b>{profile.todayStudied ? 'أنجزت تعلّمك اليوم' : 'خطوة اليوم تكفي'}</b><span>{profile.todayStudied ? 'رائع، حافظ على هذا الإيقاع الهادئ.' : 'جلسة قصيرة اليوم تحافظ على سلسلتك.'}</span></div>
      </div>
      {showStreakReminder && <p className="ls-streak-reminder" role="status">باقي لك وقت اليوم لتثبيت سلسلتك؛ حتى مراجعة قصيرة تُحتسب.</p>}
      <div className="ls-currency-row" aria-label="رصيد التعلّم">
        <div><span className="ls-currency-icon ls-xp"><Flame size={16} /></span><b>{profile.xpTotal.toLocaleString('ar')}</b><small>نقطة خبرة</small></div>
        <div><span className="ls-currency-icon ls-gem"><Gem size={16} /></span><b>{profile.gems.toLocaleString('ar')}</b><small>جوهرة</small></div>
        <div><span className="ls-currency-icon ls-heart"><Heart size={16} fill="currentColor" /></span><b>{hearts} / {profile.maxHearts}</b><small>قلوب</small></div>
      </div>
      {hearts < profile.maxHearts && profile.nextHeartAt && <p className="ls-next-heart">القلب التالي {new Date(profile.nextHeartAt).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' })}</p>}
      <div className="ls-streak-line"><Flame size={15} /><b>{profile.currentStreak}</b><span>يومًا متتاليًا</span><span className="ls-streak-best">الأفضل {profile.bestStreak}</span></div>
      {showLeague && <section className="ls-league">
        <div className="ls-league-heading"><div><span>الدوري الأسبوعي</span><b>{tierLabel[league.tier]}</b></div><Trophy size={19} /></div>
        <div className="ls-rank-summary"><b>المركز {league.rank.toLocaleString('ar')}</b><span>من {league.participantCount.toLocaleString('ar')} مشاركًا</span><span>النقاط الأسبوعية {league.weeklyXp.toLocaleString('ar')}</span></div>
        <div className="ls-league-zones">
          <div><small>ترقية</small><b>{getRange(league.promotionSlots, true)}</b></div>
          <div><small>هبوط</small><b>{getRange(league.demotionSlots, false)}</b></div>
        </div>
        <div className="ls-member-list">
          {shownMembers.map(member => <div className={`ls-member-row ${member.isCurrentUser ? 'is-current' : ''}`} key={member.id}>
            <span className="ls-member-rank">{member.rank.toLocaleString('ar')}</span><span className="ls-member-name">{member.displayName}</span><b>{member.weeklyXp.toLocaleString('ar')} نقطة</b>
            {member.isVirtual && <span className="ls-virtual-pill">منافس افتراضي</span>}
          </div>)}
        </div>
        {virtualRowsPresent && <p className="ls-virtual-notice">تنويه: بعض صفوف هذا الدوري منافسون افتراضيون للمحافظة على حيوية الترتيب، وليست حسابات طلاب حقيقية.</p>}
      </section>}
      {showFreeze && <section className="ls-freeze">
        <div className="ls-freeze-title"><Shield size={16} /><b>تجميد السلسلة</b><span>{profile.streakFreezeCredits} رصيد</span></div>
        <p>اشترِ رصيدًا واحدًا بالجواهر. يُستخدم تلقائيًا بعد يوم واحد فقط من عدم التعلّم لحماية سلسلتك.</p>
        <button className="ls-secondary ls-buy-freeze" onClick={onBuyFreeze} disabled={purchasePending || profile.streakFreezeCredits >= gameRules.maxFreezeCredits || profile.gems < gameRules.freezeCost} data-testid="button-purchase-streak-freeze">
          {purchasePending ? 'جارٍ إتمام الشراء…' : profile.streakFreezeCredits >= gameRules.maxFreezeCredits ? 'الرصيد ممتلئ' : profile.gems < gameRules.freezeCost ? `تحتاج إلى ${gameRules.freezeCost.toLocaleString('ar')} جواهر` : `شراء رصيد تجميد · ${gameRules.freezeCost.toLocaleString('ar')} جواهر`}
        </button>
        {purchaseMessage && <p className="ls-mutation-note" role="status">{purchaseMessage}</p>}
      </section>}
      {showPreferences && <section className="ls-settings">
        <div className="ls-settings-title"><Bell size={15} /><b>تفضيلات الإجابة</b></div>
        <label className="ls-setting-row"><span><Volume2 size={15} /> صوت الإجابة</span><input aria-label="صوت الإجابة" type="checkbox" checked={profile.soundEnabled} disabled={settingsPending} onChange={event => onSettingChange('soundEnabled', event.target.checked)} data-testid="toggle-answer-sound" /></label>
        <label className="ls-setting-row"><span><Vibrate size={15} /> اهتزاز الإجابة</span><input aria-label="اهتزاز الإجابة" type="checkbox" checked={profile.vibrationEnabled} disabled={settingsPending} onChange={event => onSettingChange('vibrationEnabled', event.target.checked)} data-testid="toggle-answer-vibration" /></label>
        {settingsError && <p className="ls-mutation-note is-error" role="alert">{settingsError}</p>}
      </section>}
    </>
  );
}

export default LanguageStudyPage;
