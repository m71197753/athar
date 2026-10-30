import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  Flame,
  Heart,
  Headphones,
  LockKeyhole,
  Mic2,
  RotateCcw,
  Shuffle,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { languageLabels, supportedLanguages } from '../content/sample-a1';
import type { SupportedLanguageCode } from '../content/sample-a1';

export type LanguagePracticeMode = 'mixed' | 'listening' | 'speaking' | 'matching';
export type LanguageJourneyNodeStatus = 'completed' | 'current' | 'locked';

export type LanguageJourneyNode = {
  id: string;
  title: string;
  description: string;
  mode: LanguagePracticeMode;
  status: LanguageJourneyNodeStatus;
};

type LanguageJourneyPathProps = {
  title: string;
  subtitle: string;
  languageCode: SupportedLanguageCode;
  level: 'A1' | 'A2' | 'B1' | 'B2';
  enabledLanguages: SupportedLanguageCode[];
  nodes: LanguageJourneyNode[];
  xpTotal: number;
  hearts: number;
  maxHearts: number;
  currentStreak: number;
  dueReviewCount: number;
  activeContentCount: number;
  isLoading: boolean;
  hasError: boolean;
  showGamification: boolean;
  showProgress: boolean;
  resumeAvailable: boolean;
  onLanguageChange: (language: SupportedLanguageCode) => void;
  onLevelChange: (level: 'A1' | 'A2' | 'B1' | 'B2') => void;
  onStartNode: (mode: LanguagePracticeMode) => void;
  onStartReview: () => void;
  onResume: () => void;
  onRetry: () => void;
};

const modeIcons = {
  mixed: BookOpen,
  listening: Headphones,
  matching: Shuffle,
  speaking: Mic2,
};

export function LanguageJourneyPath({
  title,
  subtitle,
  languageCode,
  level,
  enabledLanguages,
  nodes,
  xpTotal,
  hearts,
  maxHearts,
  currentStreak,
  dueReviewCount,
  activeContentCount,
  isLoading,
  hasError,
  showGamification,
  showProgress,
  resumeAvailable,
  onLanguageChange,
  onLevelChange,
  onStartNode,
  onStartReview,
  onResume,
  onRetry,
}: LanguageJourneyPathProps) {
  const languageName = languageLabels[languageCode];
  const completedNodeCount = nodes.filter(node => node.status === 'completed').length;
  const progressPercent = nodes.length ? Math.round((completedNodeCount / nodes.length) * 100) : 0;

  return (
    <section className="ls-journey" aria-label="مسار تعلّم اللغة">
      <div className="ls-journey-heading">
        <div>
          <span className="ls-eyebrow">مسارك في أثر</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="ls-journey-selectors">
          <label className="ls-journey-select">
            <span>اللغة</span>
            <select value={languageCode} onChange={event => onLanguageChange(event.target.value as SupportedLanguageCode)} aria-label="اختر اللغة">
              {supportedLanguages.filter(language => enabledLanguages.includes(language.code)).map(language => (
                <option key={language.code} value={language.code}>{language.label}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true"/>
          </label>
          <label className="ls-journey-select">
            <span>المستوى</span>
            <select value={level} onChange={event => onLevelChange(event.target.value as 'A1' | 'A2' | 'B1' | 'B2')} aria-label="اختر المستوى">
              {(['A1', 'A2', 'B1', 'B2'] as const).map(value => <option key={value}>{value}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true"/>
          </label>
        </div>
      </div>

      {showGamification && (
        <div className="ls-journey-stats" aria-label="رصيد التعلّم">
          <div className="ls-journey-stat"><span className="ls-journey-stat-icon is-xp"><Sparkles size={17}/></span><b>{xpTotal.toLocaleString('ar')}</b><small>نقطة خبرة</small></div>
          <div className="ls-journey-stat"><span className="ls-journey-stat-icon is-heart"><Heart size={17} fill="currentColor"/></span><b>{hearts} / {maxHearts}</b><small>قلوب الطاقة</small></div>
          <div className="ls-journey-stat"><span className="ls-journey-stat-icon is-streak"><Flame size={17} fill="currentColor"/></span><b>{currentStreak.toLocaleString('ar')}</b><small>يومًا متتاليًا</small></div>
        </div>
      )}

      <div className="ls-journey-unit">
        <div className="ls-journey-unit-top">
          <div>
            <span>رحلتك الحالية</span>
            <h2>{languageName} · {level}</h2>
          </div>
          <span className="ls-journey-unit-mark"><BookOpen size={20}/></span>
        </div>
        {showProgress && (
          <div className="ls-journey-progress">
            <div><span>تقدمك في المسار</span><b>{completedNodeCount} من {nodes.length} دروس</b></div>
            <div className="ls-journey-progress-track" role="progressbar" aria-label="تقدم المسار" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><span style={{ width: `${progressPercent}%` }}/></div>
          </div>
        )}
      </div>

      {resumeAvailable && (
        <div className="ls-journey-resume" role="status">
          <div><b>لديك درس لم تكمله</b><span>إجاباتك محفوظة على هذا الجهاز.</span></div>
          <button className="ls-journey-resume-button" type="button" onClick={onResume}><RotateCcw size={15}/> استكمل الدرس</button>
        </div>
      )}

      {isLoading ? (
        <div className="ls-journey-loading" aria-label="جارٍ تحميل مسارك"><span/><span/><span/></div>
      ) : hasError ? (
        <div className="ls-journey-empty" role="alert">
          <LockKeyhole size={23}/>
          <h2>تعذّر تحميل مسارك</h2>
          <p>تحقق من الاتصال ثم أعد المحاولة.</p>
          <button className="ls-journey-secondary" type="button" onClick={onRetry}><RotateCcw size={14}/> إعادة المحاولة</button>
        </div>
      ) : activeContentCount < 10 ? (
        <div className="ls-journey-empty">
          <BookOpen size={23}/>
          <h2>نجهّز دروس هذا المستوى</h2>
          <p>يتوفر حاليًا {activeContentCount.toLocaleString('ar')} عناصر نشطة. ستظهر الدروس عندما يكتمل الحد الأدنى اللازم لتمرين متوازن.</p>
        </div>
      ) : (
        <div className="ls-journey-map" aria-label="دروس المسار">
          {nodes.map((node, index) => {
            const Icon = modeIcons[node.mode];
            const locked = node.status === 'locked';
            return (
              <div className={`ls-journey-step ${node.status}`} key={node.id}>
                <span className="ls-journey-connector" aria-hidden="true"/>
                <button
                  className="ls-journey-node"
                  type="button"
                  disabled={locked}
                  onClick={() => onStartNode(node.mode)}
                  aria-label={`${node.status === 'locked' ? 'مقفل' : node.status === 'completed' ? 'مكتمل' : 'ابدأ'}: ${node.title}`}
                  data-testid={`button-language-node-${index}`}
                >
                  <span className="ls-journey-node-icon">{node.status === 'completed' ? <Check size={21}/> : locked ? <LockKeyhole size={19}/> : <Icon size={21}/>}</span>
                  <span className="ls-journey-node-copy"><b>{node.title}</b><small>{node.description}</small></span>
                  <span className="ls-journey-node-status">{node.status === 'completed' ? 'مكتمل' : locked ? 'أكمل الدرس السابق' : 'ابدأ الدرس'}<ChevronLeft size={14}/></span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className={`ls-journey-review ${dueReviewCount >= 10 ? 'is-ready' : ''}`}>
        <span className="ls-journey-review-icon"><Volume2 size={18}/></span>
        <div><b>مراجعة الكلمات المستحقة</b><small>{dueReviewCount.toLocaleString('ar')} عناصر جاهزة للمراجعة</small></div>
        <button className="ls-journey-review-button" type="button" disabled={dueReviewCount < 10} onClick={onStartReview}>
          {dueReviewCount >= 10 ? 'ابدأ المراجعة' : 'تحتاج ١٠ عناصر'}<ChevronLeft size={14}/>
        </button>
      </div>

      <p className="ls-journey-private"><LockKeyhole size={13}/> تقدّمك ومكافآتك محفوظة لحسابك في أثر.</p>
    </section>
  );
}
