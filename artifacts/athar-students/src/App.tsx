import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { arSA } from '@clerk/localizations';
import { useTheme } from 'next-themes';
import { ThemeToggle } from './components/theme-toggle';
import { RequiredMark } from './components/RequiredMark';
const AdminPage = lazy(() => import('./admin/AdminPage'));
const PublishedContent = lazy(() => import('./admin/AdminPage').then(module => ({ default: module.PublishedContent })));
const PrivacyPage = lazy(() => import('./privacy/PrivacyPage'));
const AcademyHomePage = lazy(() => import('./academy').then(module => ({ default: module.AcademyPage })));
const AcademySubjectPage = lazy(() => import('./academy').then(module => ({ default: module.AcademySubjectPage })));
const AcademyLessonPage = lazy(() => import('./academy').then(module => ({ default: module.AcademyLessonPage })));
const AcademyAttemptPage = lazy(() => import('./academy').then(module => ({ default: module.AcademyAttemptPage })));
const AcademySearchPage = lazy(() => import('./academy').then(module => ({ default: module.AcademySearchPage })));
const AcademyAssistantPage = lazy(() => import('./academy').then(module => ({ default: module.AcademyAssistantPage })));
const AcademyFilesPage = lazy(() => import('./academy').then(module => ({ default: module.AcademyFilesPage })));
import { AdSlot } from './ads/AdSlot';
import { PageAdFrame, MiddlePageAd } from './components/page-ads';
const GuestLanguageDemoPage = lazy(() => import('./languages/GuestLanguageDemoPage').then(module => ({ default: module.GuestLanguageDemoPage })));
const LanguageStudyPage = lazy(() => import('./languages/study-ui/LanguageStudyPage').then(module => ({ default: module.LanguageStudyPage })));
const CustomSectionPage = lazy(() => import('./sections/CustomSectionPage').then(module => ({ default: module.CustomSectionPage })));
const ModuleSectionContent = lazy(() => import('./sections/ModuleSectionContent').then(module => ({ default: module.ModuleSectionContent })));
const GraduatesPage = lazy(() => import('./graduates/GraduatesPage').then(module => ({ default: module.GraduatesPage })));
const ResumeStudio = lazy(() => import('./resume/ResumeStudio'));
const ResumeTemplateStudio = lazy(() => import('./resume/ResumeTemplateStudio'));
const OfficeToolsPage = lazy(() => import('./office/OfficeToolsPage'));
const DemoDataPage = lazy(() => import('./demo/DemoDataPage').then(module => ({ default: module.DemoDataPage })));
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, Award, BookOpen, BriefcaseBusiness,
  Check, ChevronDown, CircleHelp, ClipboardList, Copy, Download, FileText, Filter,
  GraduationCap, HeartHandshake, Lightbulb, LoaderCircle, LogOut, Menu, Pencil,
  Paperclip, Plus, Search, Share2, Sparkles, Target, Trash2, TrendingUp, Upload, X, ShieldCheck, Route as RouteIcon, CircleCheck, Clock3,
  BookMarked, MessageCircle, Send, NotebookPen, Play, CheckCircle2, ExternalLink,
  PanelRightClose, PanelRightOpen, UserRound,
} from 'lucide-react';
import {
  useGetPlatformAccess, getGetPlatformAccessQueryKey,
  getGetCareerPlanQueryKey, getGetDashboardSummaryQueryKey, getGetStudentProfileQueryKey, getHealthCheckQueryKey,
  getGetPublicResumeQueryKey, getGetResumeShareSettingsQueryKey,
  getListAchievementAttachmentsQueryKey, getListAchievementsQueryKey,
  useConfirmAchievementAttachmentUpload, useCreateAchievement, useCreateAchievementAttachment,
  useDeleteAchievement, useDeleteAchievementAttachment, useListAchievementAttachments,
  useRequestAchievementAttachmentUpload,
  useGenerateAchievementDraft, useGetDashboardSummary, useGetStudentProfile,
  useHealthCheck, useListAchievements, useSaveStudentProfile, useUpdateAchievement,
  useGetPublicResume, useGetResumeShareSettings, useSaveResumeShareSettings,
  getListLearningItemsQueryKey, getGetAcademyProgressQueryKey, useListLearningItems,
  useCreateLearningItem, useUpdateLearningItem, useDeleteLearningItem,
  useGetAcademyProgress, useSaveAcademyProgress, useAskCareerAssistant, useCompareCareerAssistant,
  useCreateCareerTasks, useDeleteCareerTask, useGenerateCareerPlanSuggestions, useGetCareerPlan,
  useSaveCareerPlan, useUpdateCareerTask, useSaveCareerReminder, useSnoozeCareerReminder,
  useGetPlatformContent, getGetPlatformContentQueryKey,
} from '@workspace/api-client-react';
import type {
  Achievement, AchievementAttachment, AchievementAttachmentInput, AchievementDraftInput, AchievementInput, CareerPlanInput, CareerPlanOverview,
  CareerPlanSuggestions, CareerReminder, CareerTask, CareerTasksInput, CareerTaskUpdate, DashboardSummary,
  ModuleKey, StudentProfileInput, ResumeShareUpdate,
  LearningItem, LearningItemInput, LearningItemUpdate,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useRoute } from 'wouter';
import { prepareRoadmapPush, pushSupported } from './lib/roadmap-push';
import { applyPlatformAppearance, DEFAULT_APPEARANCE, getAppearancePrimary } from './lib/platform-appearance';
import { getSectionAccent, getSectionIcon } from './lib/section-appearance';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const categoryNames: Record<string, string> = {
  project: 'مشروع', internship: 'تدريب', volunteer: 'تطوع', competition: 'مسابقة',
  course: 'دورة', research: 'بحث', other: 'أخرى',
};
const categoryIcons: Record<string, typeof BriefcaseBusiness> = {
  project: BriefcaseBusiness, internship: GraduationCap, volunteer: HeartHandshake,
  competition: Award, course: BookOpen, research: Lightbulb, other: ClipboardList,
};
const categories = Object.keys(categoryNames);

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function BrowserBackGuard() {
  const [loc, setLocation] = useLocation();
  const locationRef = useRef(loc);
  useEffect(() => { locationRef.current = loc; }, [loc]);
  useEffect(() => {
    const appOrigin = window.location.origin;
    window.history.pushState({ atharBackGuard: true }, '', window.location.href);
    const handlePopState = (event: PopStateEvent) => {
      const path = window.location.pathname;
      const insideApp = window.location.origin === appOrigin &&
        (!basePath || path === basePath || path.startsWith(`${basePath}/`));
      const previousRoute = stripBase(path);
      const currentRoute = stripBase(locationRef.current.split('?')[0]);
      if (insideApp && previousRoute !== currentRoute) {
        window.dispatchEvent(new Event('athar:browser-back'));
        return;
      }

      event.stopImmediatePropagation();
      if (insideApp) {
        window.history.pushState({ atharBackGuard: true }, '', window.location.href);
        return;
      }
      if (currentRoute === '/' || currentRoute.startsWith('/sign-in') || currentRoute.startsWith('/sign-up')) {
        const appUrl = `${basePath}${locationRef.current.startsWith('/') ? locationRef.current : `/${locationRef.current}`}`;
        window.history.pushState({ atharBackGuard: true }, '', appUrl || '/');
        return;
      }
      window.dispatchEvent(new Event('athar:browser-back'));
      setLocation('/dashboard');
    };
    window.addEventListener('popstate', handlePopState, true);
    return () => window.removeEventListener('popstate', handlePopState, true);
  }, [setLocation]);
  return null;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/athar-wordmark-3d.png`,
  },
  variables: {
    colorPrimary: '#4338CA', colorForeground: '#1E293B', colorMutedForeground: '#64748B',
    colorDanger: '#BE123C', colorBackground: '#F8FAFC', colorInput: '#FFFFFF',
    colorInputForeground: '#1E293B', colorNeutral: '#E2E8F0',
    fontFamily: '"IBM Plex Sans Arabic", sans-serif', borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center z-[1]',
    cardBox: 'bg-[var(--athar-auth-bg)] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[var(--athar-auth-fg)] font-bold', headerSubtitle: 'text-[var(--athar-auth-muted)]',
    socialButtonsBlockButtonText: 'text-[var(--athar-auth-fg)] font-medium',
    formFieldLabel: 'text-[var(--athar-auth-fg)] font-medium', footerActionLink: 'text-[var(--athar-auth-link)] font-semibold',
    footerActionText: 'text-[var(--athar-auth-muted)]', dividerText: 'text-[var(--athar-auth-muted)]',
    identityPreviewEditButton: 'text-[var(--athar-auth-link)]', formFieldSuccessText: 'text-[var(--athar-auth-success)]',
    alertText: 'text-[var(--athar-auth-danger)]', logoBox: 'rounded-xl bg-[#101827]', logoImage: 'rounded-lg',
    socialButtonsBlockButton: 'border border-[var(--athar-auth-border)] rounded-xl',
    formButtonPrimary: 'bg-[var(--athar-auth-primary)] hover:bg-[var(--athar-auth-primary-hover)] text-white rounded-xl',
    formFieldInput: 'bg-[var(--athar-auth-input)] border-[var(--athar-auth-border)] rounded-xl text-[var(--athar-auth-fg)]',
    footerAction: 'text-[var(--athar-auth-muted)]', dividerLine: 'bg-[var(--athar-auth-border)]', alert: 'rounded-xl',
    otpCodeFieldInput: 'bg-[var(--athar-auth-input)] border-[var(--athar-auth-border)] rounded-lg',
    formFieldRow: 'text-[var(--athar-auth-fg)]', main: 'text-[var(--athar-auth-fg)]',
  },
};

function Brand({ small = false }: { small?: boolean }) {
  return <span className={`brand-lockup ${small ? 'brand-small' : ''}`}><img className="brand-image" src={`${basePath}/athar-wordmark-3d.png`} alt="أثر" data-testid="img-brand-logo" /></span>;
}

function formatAchievementCount(count: number) {
  if (count === 0) return 'لا توجد إنجازات';
  if (count === 1) return 'إنجاز واحد';
  if (count === 2) return 'إنجازان';
  const localized = count.toLocaleString('ar');
  return count <= 10 ? `${localized} إنجازات` : `${localized} إنجازاً`;
}

function formatStepCount(count: number) {
  if (count === 0) return 'لا توجد خطوات';
  if (count === 1) return 'خطوة واحدة';
  if (count === 2) return 'خطوتان';
  const localized = count.toLocaleString('ar');
  return count <= 10 ? `${localized} خطوات` : `${localized} خطوة`;
}

function Home() {
  return <main className="landing" dir="rtl">
    <header className="landing-nav"><Link href="/about" className="nav-brand" data-testid="link-home-brand"><Brand /></Link>
      <div className="landing-actions"><ThemeToggle/><Link href="/sign-in" className="text-link" data-testid="link-sign-in">تسجيل الدخول</Link><Link href="/sign-up" className="button button-primary button-compact" data-testid="link-sign-up">ابدأ رحلتك <ArrowLeft size={16}/></Link></div>
    </header>
    <AdSlot page="home" slot="top"/>
    <AdSlot page="home" slot="floating-start"/>
    <AdSlot page="home" slot="floating-end"/>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow"><span className="eyebrow-dot"/> مساحتك لبناء مستقبل مهني يشبهك</span>
        <h1>كل تجربة<br/>تستحق <em>أن تُروى.</em></h1>
        <p>حوّل ما أنجزته في الجامعة وخارجها إلى دليل واضح على مهاراتك. يساعدك أثر على رؤية قيمة ما أنجزته ومشاركتها بثقة.</p>
        <div className="hero-cta"><Link href="/sign-up" className="button button-primary" data-testid="button-hero-start">ابدأ ببناء أثرك <ArrowLeft size={18}/></Link><a href="#how-it-works" className="button button-quiet" data-testid="link-how-it-works">اكتشف كيف يعمل <ArrowDownLeft size={17}/></a></div>
        <div className="hero-proof"><div className="proof-orbit"><span>م</span><span>ن</span><span>س</span></div><span>مساحة آمنة لتبدأ من حيث أنت</span></div>
      </div>
      <div className="hero-art" aria-label="مسار من التجارب إلى الفرص">
        <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
        <div className="art-note note-top"><span className="mini-check"><Check size={13}/></span><div><b>تجربة حقيقية</b><small>مشروع تخرج · ٢٠٢٥</small></div></div>
        <div className="art-core"><div className="core-sun"><span>أ</span></div><div className="core-ring ring-a"/><div className="core-ring ring-b"/><span className="core-label">أثرُك المهني</span></div>
        <div className="art-note note-bottom"><span className="note-spark"><Sparkles size={16}/></span><div><b>إنجازك صار قصة</b><small>مهارات · نتائج · ثقة</small></div></div>
        <span className="floating-dot dot-a"/><span className="floating-dot dot-b"/><span className="floating-dot dot-c"/>
        <span className="art-caption">من هنا تبدأ الحكاية</span>
      </div>
    </section>
    <AdSlot page="home" slot="middle"/>
    <div className="home-ad-side"><AdSlot page="home" slot="side"/></div>
    <section className="landing-band" id="how-it-works"><div className="band-label">من التجربة إلى الفرصة</div><h2>ما أنجزته مهم.<br/><span>لنرتّبه معاً.</span></h2><p>لا تحتاج إلى خبرة طويلة كي يكون لديك ما يستحق أن تحكيه. مشروع صغير، أو مبادرة، أو موقف تعلّمت منه؛ كلها ملامح في صورتك المهنية.</p>
      <div className="journey-steps">
         <div className="journey-step"><span className="step-no">٠١</span><div className="step-icon"><ClipboardList/></div><h3>دوّن ما حدث</h3><p>اكتب التحدي الذي واجهته، وما قمت به، والنتيجة التي حققتها.</p></div>
        <span className="journey-arrow"><ArrowLeft/></span>
        <div className="journey-step"><span className="step-no">٠٢</span><div className="step-icon step-icon-gold"><Sparkles/></div><h3>اكتشف مهاراتك</h3><p>اربط كل تجربة بمهارات واضحة، واحتفظ بأمثلة تشرحها.</p></div>
        <span className="journey-arrow"><ArrowLeft/></span>
        <div className="journey-step"><span className="step-no">٠٣</span><div className="step-icon step-icon-coral"><FileText/></div><h3>قدّم نفسك بصدق</h3><p>أنشئ سيرة مهنية تعبّر عنك، لا عن قالب جاهز.</p></div>
      </div>
    </section>
    <section className="landing-quote"><div className="quote-mark">“</div><blockquote>ليس المهم أين بدأت، بل ما الذي صنعته<br/>بما كان بين يديك.</blockquote><span>أثر — مساحتك لتلاحظ نموك</span><div className="quote-seal">أثر<span>•</span>ينمو</div></section>
    <AdSlot page="home" slot="bottom"/>
    <footer className="landing-footer"><Brand small/><span>مساحتك المهنية، على مهل وبثقة.</span><Link href="/privacy" className="text-link">سياسة الخصوصية</Link><Link href="/sign-up" className="footer-cta" data-testid="link-footer-start">ابدأ الآن <ArrowLeft size={15}/></Link></footer>
  </main>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useUser();
  // The public landing must remain available even if authentication is slow.
  return isLoaded && isSignedIn ? <Redirect to="/dashboard"/> : <Home/>;
}
function SignInPage() {
  const preserveDemo = new URLSearchParams(window.location.search).get('from') === 'language-demo';
  const languageRedirect = `${basePath}/languages?from=language-demo`;
  return <div className="auth-page" dir="rtl"><Link href="/" className="auth-back" data-testid="link-auth-home"><Brand small/><span>العودة إلى أثر</span></Link><div className="auth-theme-toggle"><ThemeToggle/></div><div className="auth-mood"><span className="auth-mood-kicker">كل خطوة لها أثر</span><p>مكانك محفوظ.<br/>أكمل من حيث توقفت.</p><div className="auth-decor">أ</div></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={preserveDemo ? `${basePath}/sign-up?from=language-demo` : `${basePath}/sign-up`} forceRedirectUrl={preserveDemo ? languageRedirect : undefined}/></div>;
}
function SignUpPage() {
  const preserveDemo = new URLSearchParams(window.location.search).get('from') === 'language-demo';
  const languageRedirect = `${basePath}/languages?from=language-demo`;
  return <div className="auth-page" dir="rtl"><Link href="/" className="auth-back" data-testid="link-auth-home"><Brand small/><span>العودة إلى أثر</span></Link><div className="auth-theme-toggle"><ThemeToggle/></div><div className="auth-mood"><span className="auth-mood-kicker">ابدأ من تجربتك</span><p>أنت أكثر من<br/>مجرد سطر في سيرتك الذاتية.</p><div className="auth-decor">أ</div></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={preserveDemo ? `${basePath}/sign-in?from=language-demo` : `${basePath}/sign-in`} forceRedirectUrl={preserveDemo ? languageRedirect : undefined}/></div>;
}

function ClerkCacheReset() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  useEffect(() => {
    let prev: string | null | undefined;
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prev !== undefined && prev !== id) cache.clear();
      prev = id;
    });
  }, [addListener, cache]);
  return null;
}

function Shell({ children: content }: { children: ReactNode }) {
  const children = <PageAdFrame>{content}</PageAdFrame>;
  const [loc, setLocation] = useLocation();
  const { user } = useUser();
  const access = useGetPlatformAccess({ query: { queryKey: getGetPlatformAccessQueryKey(), retry: false, staleTime: 0, refetchInterval: 30000 } });
  const { signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const backStackRef = useRef<string[]>([]);
  const lastLocationRef = useRef<string | null>(null);
  const browserBackRef = useRef(false);
  const skipLocationRecordRef = useRef(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false } });
  const platform = useGetPlatformContent({ query: { queryKey: getGetPlatformContentQueryKey(), staleTime: 30_000 } });
  const navItems = [
    { href: '/dashboard', label: 'الرئيسية', icon: Target },
    { href: '/profile', label: 'ملفي الشخصي', icon: GraduationCap },
    { href: '/resume-templates', label: 'قوالب السيرة', icon: FileText },
    { href: '/office', label: 'المستندات والجداول', icon: NotebookPen },
    ...(access.data?.role === 'admin' || access.data?.enabledModules.includes('graduates') ? [{ href: '/graduates', label: 'مساحة الخريجين', icon: BriefcaseBusiness }] : []),
    ...(platform.data?.sections ?? []).map(section => ({
      href: `/sections/${section.slug}`, label: section.title,
      icon: getSectionIcon(section.iconKey ?? (section.kind === 'module' ? 'book' : 'file')),
    })),
    ...(access.data?.role === 'admin' ? [{ href: '/admin', label: 'إدارة المنصة', icon: ShieldCheck }] : []),
  ];
  // Mobile destinations intentionally remain independent from the desktop sidebar.
  const mobileItems = [
    { href: '/dashboard', label: 'الرئيسية', icon: Target },
    { href: '/achievements', label: 'إنجازاتي', icon: Award },
    { href: '/resume', label: 'سيرتي المهنية', icon: FileText },
    { href: '/office', label: 'المستندات', icon: NotebookPen },
    ...(access.data?.role === 'admin' || access.data?.enabledModules.includes('graduates') ? [{ href: '/graduates', label: 'مساحة الخريجين', icon: BriefcaseBusiness }] : []),
    { href: '/profile', label: 'ملفي الشخصي', icon: GraduationCap },
  ];
  const routeTitles: Record<string, string> = {
    '/dashboard': 'الرئيسية', '/profile': 'ملفي الشخصي', '/admin': 'إدارة المنصة',
    '/achievements': 'إنجازاتي', '/learning': 'تعلّمي', '/academy': 'المذاكرة',
    '/graduates': 'مساحة الخريجين',
    '/languages': 'تعلّم اللغات', '/roadmap': 'خطتي المهنية', '/resume': 'سيرتي المهنية',
    '/resume-templates': 'قوالب السيرة',
    '/office': 'المستندات والجداول',
    '/assistant': 'المساعد',
  };
  const currentPath = stripBase(loc.split('?')[0]);
  const crumbPath = Object.keys(routeTitles).sort((a, b) => b.length - a.length)
    .find(path => currentPath === path || currentPath.startsWith(`${path}/`));
  const customSectionTitle = currentPath.startsWith('/sections/')
    ? platform.data?.sections.find(section => `/sections/${section.slug}` === currentPath)?.title
    : undefined;
  useEffect(() => {
    const markBrowserBack = () => { browserBackRef.current = true; };
    window.addEventListener('athar:browser-back', markBrowserBack);
    return () => window.removeEventListener('athar:browser-back', markBrowserBack);
  }, []);
  useEffect(() => {
    const previous = lastLocationRef.current;
    if (previous && previous !== loc) {
      if (browserBackRef.current) backStackRef.current.pop();
      else if (!skipLocationRecordRef.current) {
        backStackRef.current.push(previous);
        if (backStackRef.current.length > 40) backStackRef.current.shift();
      }
    }
    lastLocationRef.current = loc;
    browserBackRef.current = false;
    skipLocationRecordRef.current = false;
  }, [loc]);
  const goBackWithinApp = () => {
    const previous = backStackRef.current.pop() ?? '/dashboard';
    if (previous === loc) return;
    skipLocationRecordRef.current = true;
    setLocation(previous);
  };
  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
        profileTriggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileMenuOpen]);
  const openNewAchievement = () => {
    if (loc.split('?')[0] === '/achievements') {
      window.dispatchEvent(new Event('athar:new-achievement'));
    } else {
      setLocation('/achievements?new=1');
    }
  };
  return <div className="app-frame" dir="rtl">
    {menuOpen && <button className="mobile-scrim" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)} data-testid="button-close-menu"/>}
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Link href="/dashboard" className="side-brand" data-testid="link-sidebar-brand"><Brand/></Link>
       <div className="side-caption">مساحة الطالب</div>
      <nav className="side-nav">{navItems.map(item => {
        const Icon = item.icon;
        const active = loc === item.href || (item.href === '/academy' && loc.startsWith('/academy/'));
         return <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`side-link ${active ? 'side-link-active' : ''}`} aria-label={sidebarCollapsed ? item.label : undefined} title={sidebarCollapsed ? item.label : undefined} data-testid={`link-nav-${item.href.slice(1)}`}><Icon size={19}/><span>{item.label}</span>{active && <span className="nav-current"/>}</Link>;
      })}</nav>
      <div className="side-grow"/>
      <div className="side-help"><div className="help-icon"><img src={`${basePath}/athar-icon-3d.png`} alt="" width={20} height={20}/></div><b>خطوة بخطوة</b><p>دوّن ما تعلّمته اليوم، واجعل كل خطوة واضحة في مسارك.</p></div>
      <div className="sidebar-status"><span className={`status-indicator ${health?.status ? '' : 'status-muted'}`}/>{health?.status ? 'المساحة تعمل' : 'جارٍ الاتصال'}</div>
       <div className="side-user"><span className="user-avatar">{user?.firstName?.slice(0, 1) || 'ط'}</span><span className="user-meta"><b>{user?.fullName || 'طالب أثر'}</b><small>مساحتك الشخصية</small></span></div>
    </aside>
        <div className="main-column"><header className="topbar"><button className="app-back-button" type="button" onClick={goBackWithinApp} aria-label="الرجوع للصفحة السابقة داخل أثر" title="الرجوع للصفحة السابقة داخل أثر" data-testid="button-app-back"><ArrowRight size={18}/><span>رجوع</span></button><button className="mobile-menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة" data-testid="button-open-menu"><Menu size={20}/></button><Link href="/dashboard" className="mobile-header-brand" data-testid="link-mobile-header-brand"><Brand small/></Link><span className="topbar-crumb">مساحة الطالب <span>/</span> {customSectionTitle ?? (crumbPath ? routeTitles[crumbPath] : 'أثر')}</span><button type="button" className="sidebar-toggle" aria-label={sidebarCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'} title={sidebarCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed(value => !value)} data-testid="button-sidebar-toggle">{sidebarCollapsed ? <PanelRightOpen size={18}/> : <PanelRightClose size={18}/>}</button><ThemeToggle/><div className="topbar-right"><span className="topbar-note">وثّق ما تعلّمته اليوم</span><div className="profile-menu-wrap" ref={profileMenuRef}><button ref={profileTriggerRef} type="button" className="avatar-mini avatar-trigger" aria-label="فتح قائمة الحساب" aria-haspopup="menu" aria-expanded={profileMenuOpen} aria-controls="topbar-profile-menu" onClick={() => setProfileMenuOpen(open => !open)} data-testid="button-profile-menu">{user?.firstName?.slice(0,1) || 'ط'}</button>{profileMenuOpen && <div className="profile-menu" id="topbar-profile-menu" role="menu" dir="rtl"><div className="profile-menu-heading"><b>{user?.fullName || 'طالب أثر'}</b><small>{user?.primaryEmailAddress?.emailAddress || 'مساحتك الشخصية'}</small></div><Link href="/profile" role="menuitem" className="profile-menu-item" onClick={() => setProfileMenuOpen(false)}><UserRound size={17}/> الملف الشخصي</Link><button type="button" role="menuitem" className="profile-menu-item profile-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={17}/> تسجيل الخروج</button></div>}</div></div></header><main className="content-area">{children}</main><footer className="app-footer"><span>أثر — تجاربك الجامعية في مكان واحد</span><Link href="/privacy" className="text-link">الخصوصية</Link><span className="footer-health"><span className={`status-indicator ${health?.status ? '' : 'status-muted'}`}/>{health?.status ? 'الاتصال مستقر' : 'جارٍ التحقق من الاتصال'}</span></footer></div>
    <nav className="mobile-bottom-nav" aria-label="التنقل السريع">
      {mobileItems.slice(0, 2).map(item => { const Icon = item.icon; const label = item.href === '/achievements' ? 'الأثر' : item.label; return <Link key={item.href} href={item.href} className={`mobile-bottom-link ${loc === item.href ? 'mobile-bottom-active' : ''}`} data-testid={`mobile-nav-${item.href.slice(1)}`}><Icon size={18}/><span>{label}</span></Link>; })}
      <button className="mobile-create-button" type="button" onClick={openNewAchievement} aria-label="وثّق أثراً جديداً" data-testid="mobile-nav-create"><Plus size={21}/></button>
      {mobileItems.slice(2).map(item => { const Icon = item.icon; const label = item.href === '/resume' ? 'سيرتي' : item.href === '/office' ? 'مستندات' : item.href === '/graduates' ? 'الخريجون' : 'ملفي'; return <Link key={item.href} href={item.href} className={`mobile-bottom-link ${loc === item.href ? 'mobile-bottom-active' : ''}`} aria-label={item.label} title={item.label} data-testid={`mobile-nav-${item.href.slice(1)}`}><Icon size={18}/><span>{label}</span></Link>; })}
    </nav>
  </div>;
}

function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const access = useGetPlatformAccess({ query: { queryKey: getGetPlatformAccessQueryKey(), enabled: Boolean(isLoaded && isSignedIn), retry: false, staleTime: 0, refetchInterval: 30000 } });
  if (!isLoaded) return <div className="auth-loading" dir="rtl"><Brand/><LoadingPanel label="نفتح مساحتك بأمان"/></div>;
  if (!isSignedIn) {
    if (window.location.pathname === `${basePath}/roadmap` &&
        /^#roadmap-task-[0-9a-f-]+$/i.test(window.location.hash)) {
      return <Redirect to={`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`}/>;
    }
    return <Redirect to="/sign-in"/>;
  }
  if (access.isLoading || (!access.isError && access.data?.userId !== user?.id)) return <LoadingPanel label="نتحقق من صلاحيات حسابك"/>;
  if (access.isError) return <div dir="rtl" className="page-wrap"><Brand/>{access.error.status === 403
    ? <div className="state-panel" role="alert"><h2>هذا الحساب موقوف مؤقتًا</h2><p>تواصل مع إدارة المنصة لمراجعة حالة حسابك. لم تُحذف بياناتك.</p><button className="button button-outline" type="button" onClick={() => access.refetch()}>التحقق مجددًا</button><button className="button button-primary" type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })}>تسجيل الخروج</button></div>
    : <ErrorPanel retry={() => access.refetch()} title="تعذّر التحقق من صلاحيات حسابك"/>}</div>;
  if (admin && access.data?.role !== 'admin') return <Shell><div className="state-panel" role="alert"><h2>هذه الصفحة مخصّصة لإدارة المنصة</h2><Link href="/dashboard" className="button button-primary">العودة إلى مساحتي</Link></div></Shell>;
  const module = location.split('/')[1] as ModuleKey;
  const controlledModules: ModuleKey[] = ['achievements', 'learning', 'academy', 'languages', 'graduates', 'roadmap', 'resume', 'assistant'];
  if (access.data?.role !== 'admin' && controlledModules.includes(module) && !access.data?.enabledModules.includes(module)) {
    return <Shell><div className="state-panel" role="status"><h2>هذا القسم غير متاح مؤقتًا</h2><p>أوقفت الإدارة هذا القسم مؤقتًا. بياناتك محفوظة.</p><Link href="/dashboard" className="button button-primary">العودة للرئيسية</Link></div></Shell>;
  }
  const showModuleContent = controlledModules.includes(module);
  return admin ? <>{children}</> : <Shell>{showModuleContent && <ModuleSectionContent moduleKey={module} />}{children}</Shell>;
}

function LoadingPanel({ label = 'لحظة، نجهّز مساحتك' }: { label?: string }) {
  return <div className="loading-panel" role="status" data-testid="status-loading"><div className="skeleton-line skeleton-wide"/><div className="skeleton-line skeleton-mid"/><div className="skeleton-block"/><span>{label}</span></div>;
}
function ErrorPanel({ retry, title = 'تعذّر تحميل هذه الصفحة' }: { retry: () => void; title?: string }) {
  return <div className="state-panel error-panel" data-testid="status-error"><div className="state-symbol"><X size={19}/></div><h3>{title}</h3><p>تحقق من اتصالك ثم حاول مرة أخرى.</p><button className="button button-outline" onClick={retry} type="button" data-testid="button-retry">إعادة المحاولة</button></div>;
}

function PageTitle({ kicker, title, detail, action }: { kicker: string; title: string; detail: string; action?: React.ReactNode }) {
  return <><div className="page-title"><div><span className="page-kicker">{kicker}</span><h1>{title}</h1><p>{detail}</p></div>{action && <div className="page-title-action">{action}</div>}</div><MiddlePageAd/></>;
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  return <div className="progress-ring-wrap"><div className="progress-ring" style={{ '--progress': `${Math.max(0, Math.min(100, value))}%` } as CSSProperties}><div className="progress-ring-inner"><b>{value}<small>%</small></b></div></div><span>{label}</span></div>;
}

function AchievementCard({ item, onEdit, onDelete, onManageAttachments, compact = false }: { item: Achievement; onEdit?: (a: Achievement) => void; onDelete?: (a: Achievement) => void; onManageAttachments?: (a: Achievement) => void; compact?: boolean }) {
  const Icon = categoryIcons[item.category] || ClipboardList;
  return <article className={`achievement-card ${compact ? 'achievement-compact' : ''}`} data-testid={`card-achievement-${item.id}`}>
    <div className="achievement-icon"><Icon size={19}/></div>
    <div className="achievement-content"><div className="achievement-topline"><span className="achievement-category">{categoryNames[item.category] || 'إنجاز'}</span><time>{new Date(item.achievedOn).toLocaleDateString('ar', { year: 'numeric', month: 'short' })}</time></div><h3 data-testid={`text-achievement-title-${item.id}`}>{item.title}</h3><p>{item.summary || item.resumeBullet || item.result}</p>{item.serviceOffer && <p className="achievement-pitch"><b>عرض مهارة أو مشروع:</b> {item.serviceOffer}</p>}<div className="skill-list">{item.skills?.slice(0, 4).map(skill => <span className="skill-pill" key={skill}>{skill}</span>)}</div></div>
    {(onEdit || onDelete || onManageAttachments) && <div className="card-actions">{onManageAttachments && <button className="achievement-evidence-action" aria-label="إضافة صور وملفات وروابط لهذا الإنجاز" title="إضافة صور وملفات وروابط" onClick={() => onManageAttachments(item)} data-testid={`button-attachments-${item.id}`}><Paperclip size={15}/><span>الملفات والأدلة</span></button>}{onEdit && <button className="icon-button" aria-label="تعديل الإنجاز" onClick={() => onEdit(item)} data-testid={`button-edit-${item.id}`}><Pencil size={16}/></button>}{onDelete && <button className="icon-button danger-icon" aria-label="حذف الإنجاز" onClick={() => onDelete(item)} data-testid={`button-delete-${item.id}`}><Trash2 size={16}/></button>}</div>}
  </article>;
}

const achievementMimeByExtension: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

function achievementFileMime(file: File): string {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  return (file.type || achievementMimeByExtension[extension] || '').split(';')[0].toLowerCase();
}

function uploadToSignedUrl(file: File, mime: string, uploadUrl: string, onProgress: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.setRequestHeader('Content-Type', mime);
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    request.onerror = () => reject(new Error('انقطع الاتصال أثناء رفع الملف.'));
    request.onabort = () => reject(new Error('تم إيقاف رفع الملف.'));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else reject(new Error('لم يقبل التخزين الملف. حاول رفعه مرة أخرى.'));
    };
    request.send(file);
  });
}

function AchievementAttachmentsDialog({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  const cache = useQueryClient();
  const attachments = useListAchievementAttachments(achievement.id, {
    query: { queryKey: getListAchievementAttachmentsQueryKey(achievement.id) },
  });
  const createAttachment = useCreateAchievementAttachment();
  const requestUpload = useRequestAchievementAttachmentUpload();
  const confirmUpload = useConfirmAchievementAttachmentUpload();
  const deleteAttachment = useDeleteAchievementAttachment();
  const [kind, setKind] = useState<'text' | 'link'>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; percent: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<AchievementAttachment | null>(null);
  const refreshAttachments = () => cache.invalidateQueries({ queryKey: getListAchievementAttachmentsQueryKey(achievement.id) });

  useEffect(() => {
    if (!previewAttachment) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewAttachment(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewAttachment]);

  const addTextOrLink = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const data: AchievementAttachmentInput = {
      kind,
      title: title.trim(),
      ...(kind === 'text' ? { content: content.trim() } : { url: url.trim() }),
    };
    try {
      await createAttachment.mutateAsync({ id: achievement.id, data });
      setTitle('');
      setContent('');
      setUrl('');
      await refreshAttachments();
    } catch {
      setError('تعذّر حفظ النص أو الرابط. راجع البيانات وحاول مرة أخرى.');
    }
  };

  const uploadQueuedFiles = async () => {
    if (!queuedFiles.length || uploading) return;
    setUploading(true);
    setError('');
    for (const file of queuedFiles) {
      const mime = achievementFileMime(file);
      let uploadId: string | null = null;
      let transferCompleted = false;
      try {
        if (!mime) throw new Error('لا يمكن تحديد نوع الملف. اختر PDF أو DOCX أو TXT أو صورة أو فيديو MP4/WebM.');
        const upload = await requestUpload.mutateAsync({
          id: achievement.id,
          data: { name: file.name, mime, size: file.size },
        });
        uploadId = upload.id;
        setUploadProgress({ name: file.name, percent: 0 });
        await uploadToSignedUrl(file, mime, upload.uploadUrl, percent => {
          setUploadProgress({ name: file.name, percent });
        });
        transferCompleted = true;
        await confirmUpload.mutateAsync({ id: achievement.id, attachmentId: upload.id });
        setQueuedFiles(current => current.filter(item => item !== file));
        setUploadProgress(null);
        await refreshAttachments();
      } catch (uploadError) {
        if (uploadId && !transferCompleted) {
          try {
            await deleteAttachment.mutateAsync({ id: achievement.id, attachmentId: uploadId });
          } catch {
            // Leave the pending row visible so it can be removed from the attachment list.
          }
        }
        setError(uploadError instanceof Error ? uploadError.message : 'تعذّر رفع الملف.');
        setUploadProgress(null);
        await attachments.refetch();
        break;
      }
    }
    setUploading(false);
  };

  const removeAttachment = async (attachment: AchievementAttachment) => {
    if (!window.confirm(`حذف «${attachment.title}» من هذا الإنجاز؟`)) return;
    setError('');
    try {
      await deleteAttachment.mutateAsync({ id: achievement.id, attachmentId: attachment.id });
      await refreshAttachments();
    } catch {
      setError('تعذّر حذف المرفق. حاول مرة أخرى.');
    }
  };

  return <div className="dialog-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !uploading) onClose(); }}>
    <section className="achievement-dialog achievement-attachments-dialog" role="dialog" aria-modal="true" aria-labelledby="attachments-dialog-title" dir="rtl" data-testid="dialog-achievement-attachments">
      <header className="dialog-header"><div><span className="page-kicker">توثيق التجربة</span><h2 id="attachments-dialog-title">أدلة إنجازك</h2><p>{achievement.title} — أضف ملفاتك أو نصوصك وروابطك. هذه المرفقات خاصة ولا تظهر في سيرتك العامة.</p></div><button className="icon-button" type="button" onClick={onClose} disabled={uploading} aria-label="إغلاق"><X size={19}/></button></header>
      <div className="achievement-attachments-body">
        <section className="attachment-add-panel">
          <h3><Paperclip size={17}/> صور وفيديوهات وملفات</h3>
          <p>الأنواع المدعومة: JPG وPNG وWebP وMP4 وWebM وPDF وDOCX وTXT.</p>
          <label className="button button-outline attachment-file-picker"><Upload size={16}/> اختر ملفات
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf,.docx,.txt,image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              disabled={uploading}
              onChange={event => {
                const files = Array.from(event.currentTarget.files ?? []);
                if (files.length) setQueuedFiles(current => [...current, ...files]);
                event.currentTarget.value = '';
              }}
              data-testid="input-achievement-files"
            />
          </label>
          {queuedFiles.length > 0 && <div className="queued-evidence-files">
            {queuedFiles.map((file, index) => <span className="queued-evidence-file" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}><FileText size={14}/>{file.name}<button type="button" aria-label={`إزالة ${file.name}`} disabled={uploading} onClick={() => setQueuedFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}><X size={14}/></button></span>)}
          </div>}
          {uploadProgress && <div className="evidence-upload-progress" role="status"><span>جارٍ رفع {uploadProgress.name}</span><progress max={100} value={uploadProgress.percent}/><b>{uploadProgress.percent}٪</b></div>}
          {queuedFiles.length > 0 && <button className="button button-primary" type="button" disabled={uploading} onClick={uploadQueuedFiles} data-testid="button-upload-achievement-files">{uploading ? <LoaderCircle size={16} className="spin"/> : <Upload size={16}/>} {uploading ? 'جارٍ الرفع' : `ارفع ${queuedFiles.length} ملف`}</button>}
        </section>

        <form className="attachment-add-panel" onSubmit={addTextOrLink}>
          <h3>نص أو رابط</h3>
          <label className="field">نوع الإضافة<select value={kind} onChange={event => setKind(event.target.value as 'text' | 'link')} data-testid="select-achievement-attachment-kind"><option value="text">نص أو ملاحظة</option><option value="link">رابط</option></select></label>
          <label className="field">العنوان<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder={kind === 'text' ? 'مثال: ما تعلمته من التجربة' : 'مثال: صفحة المشروع'} data-testid="input-achievement-attachment-title"/></label>
          {kind === 'text'
            ? <label className="field">النص<textarea required rows={3} maxLength={8000} value={content} onChange={event => setContent(event.target.value)} placeholder="أضف تفاصيل أو ملاحظات مرتبطة بالإنجاز." data-testid="input-achievement-attachment-content"/></label>
            : <label className="field">الرابط<input required type="url" maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com" dir="ltr" data-testid="input-achievement-attachment-url"/></label>}
          <button className="button button-outline" type="submit" disabled={createAttachment.isPending} data-testid="button-save-achievement-attachment">{createAttachment.isPending ? <LoaderCircle size={16} className="spin"/> : <Plus size={16}/>} إضافة</button>
        </form>

        <section className="achievement-attachments-list" aria-live="polite">
          <h3>المرفقات المحفوظة</h3>
          {attachments.isLoading ? <p className="attachment-muted">جارٍ تحميل المرفقات…</p>
            : attachments.isError ? <button className="button button-outline" type="button" onClick={() => attachments.refetch()}>تعذّر التحميل — أعد المحاولة</button>
              : attachments.data?.length ? attachments.data.map(attachment => <article className="saved-evidence-item" key={attachment.id} data-testid={`attachment-${attachment.id}`}>
                <div className="saved-evidence-copy">
                  <b>{attachment.title}</b>
                  {attachment.kind === 'text' && <p>{attachment.content}</p>}
                  {attachment.kind === 'link' && attachment.url && <a href={attachment.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>{attachment.url}</a>}
                  {attachment.kind === 'file' && attachment.status === 'uploading' && <small>الرفع لم يكتمل بعد.</small>}
                  {attachment.kind === 'file' && attachment.status === 'ready' && attachment.mime?.startsWith('image/') && attachment.downloadUrl && <button className="saved-evidence-preview-trigger" type="button" onClick={() => setPreviewAttachment(attachment)} aria-label={`معاينة ${attachment.title}`}><img className="saved-evidence-image" src={attachment.downloadUrl} alt={attachment.title} loading="lazy"/></button>}
                  {attachment.kind === 'file' && attachment.status === 'ready' && attachment.mime?.startsWith('video/') && attachment.downloadUrl && <video className="saved-evidence-video" src={attachment.downloadUrl} controls preload="metadata"/>}
                  {attachment.kind === 'file' && attachment.status === 'ready' && (attachment.mime === 'application/pdf' || attachment.mime === 'text/plain') && attachment.downloadUrl && <button className="saved-evidence-preview-button" type="button" onClick={() => setPreviewAttachment(attachment)}><FileText size={14}/> معاينة داخل أثر</button>}
                  {attachment.kind === 'file' && attachment.status === 'ready' && attachment.downloadUrl && <a className="saved-evidence-download" href={attachment.downloadUrl} download={attachment.originalName || 'attachment'}><Download size={14}/>تحميل {attachment.originalName || 'الملف'}</a>}
                </div>
                <button className="icon-button danger-icon" type="button" aria-label={`حذف ${attachment.title}`} disabled={deleteAttachment.isPending || uploading} onClick={() => removeAttachment(attachment)}><Trash2 size={15}/></button>
              </article>)
                : <p className="attachment-muted">لم تضف أدلة لهذا الإنجاز بعد.</p>}
        </section>
        {error && <p className="form-error" role="alert" data-testid="status-achievement-attachment-error">{error}</p>}
      </div>
      <footer className="dialog-footer"><button className="button button-primary" type="button" disabled={uploading} onClick={onClose}>تم</button></footer>
    </section>
    {previewAttachment?.downloadUrl && <div className="dialog-scrim attachment-preview-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewAttachment(null); }}>
      <section className="attachment-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="attachment-preview-title" dir="rtl">
        <header className="attachment-preview-header"><div><span className="page-kicker">معاينة داخل أثر</span><h2 id="attachment-preview-title">{previewAttachment.title}</h2></div><button className="button button-outline" type="button" onClick={() => setPreviewAttachment(null)}><ArrowLeft size={16}/> رجوع للمرفقات</button></header>
        <div className="attachment-preview-content">
          {previewAttachment.mime?.startsWith('image/') && <img src={previewAttachment.downloadUrl} alt={previewAttachment.title}/>}
          {(previewAttachment.mime === 'application/pdf' || previewAttachment.mime === 'text/plain') && <iframe src={previewAttachment.downloadUrl} title={previewAttachment.title}/>}
        </div>
        <footer className="attachment-preview-footer"><a className="button button-outline" href={previewAttachment.downloadUrl} download={previewAttachment.originalName || 'attachment'}><Download size={15}/> تنزيل الملف</a><button className="button button-primary" type="button" onClick={() => setPreviewAttachment(null)}><ArrowLeft size={16}/> رجوع</button></footer>
      </section>
    </div>}
  </div>;
}

function DashboardPage() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const profile = useGetStudentProfile({ query: { queryKey: getGetStudentProfileQueryKey(), retry: false } });
  const platform = useGetPlatformContent({ query: { queryKey: getGetPlatformContentQueryKey() } });
  const [, setLocation] = useLocation();
  if (summary.isLoading) return <LoadingPanel/>;
  if (summary.isError) return <ErrorPanel retry={() => summary.refetch()}/>;
  const data = summary.data as DashboardSummary;
  const firstName = profile.data?.fullName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `أهلاً ${firstName}،` : 'أهلاً بك في أثر';
  const readiness = data.readinessScore ?? 0;
  const recent = data.recentAchievements || [];
  const featureDefaults: { key: ModuleKey; href: string; title: string; description: string; action: string; icon: typeof Award; tone: string; cardStyle: string; sortOrder: number }[] = [
    { key: 'achievements', href: '/achievements', title: 'إنجازاتي', description: 'تابع تقدمك واستعرض إنجازاتك المهنية.', action: 'عرض إنجازاتي', icon: Award, tone: 'amber', cardStyle: 'soft', sortOrder: 10 },
    { key: 'learning', href: '/learning', title: 'تعلّمي', description: 'تابع مسارك التعليمي واكتساب المعرفة.', action: 'متابعة التعلّم', icon: BookOpen, tone: 'indigo', cardStyle: 'soft', sortOrder: 20 },
    { key: 'academy', href: '/academy', title: 'المذاكرة', description: 'نظّم جلسات مذاكرتك وراجع دروسك.', action: 'ابدأ المذاكرة', icon: BookMarked, tone: 'violet', cardStyle: 'soft', sortOrder: 30 },
    { key: 'languages', href: '/languages/study', title: 'تعلّم اللغات', description: 'طوّر مهاراتك اللغوية بخطوات قصيرة.', action: 'استكشف اللغات', icon: MessageCircle, tone: 'teal', cardStyle: 'soft', sortOrder: 40 },
    { key: 'graduates', href: '/graduates', title: 'مساحة الخريجين', description: 'تابع الفرص المهنية وشارك خبرتك بعد التخرج.', action: 'استكشف المساحة', icon: BriefcaseBusiness, tone: 'green', cardStyle: 'soft', sortOrder: 45 },
    { key: 'roadmap', href: '/roadmap', title: 'خطتي المهنية', description: 'حدّد أهدافك وخطّط لخطوتك القادمة.', action: 'عرض خطتي', icon: RouteIcon, tone: 'blue', cardStyle: 'soft', sortOrder: 50 },
    { key: 'resume', href: '/resume', title: 'سيرتي المهنية', description: 'نظّم خبراتك ومهاراتك في سيرتك.', action: 'إدارة سيرتي', icon: FileText, tone: 'green', cardStyle: 'soft', sortOrder: 60 },
    { key: 'assistant', href: '/assistant', title: 'المساعد الذكي', description: 'احصل على المساعدة في التعلّم والتخطيط.', action: 'ابدأ المحادثة', icon: Sparkles, tone: 'purple', cardStyle: 'soft', sortOrder: 70 },
  ];
  const builtInCards = featureDefaults.flatMap(base => {
    const setting = platform.data?.moduleSettings.find(item => item.key === base.key);
    if (setting?.enabled === false) return [];
    return [{
      ...base,
      icon: setting?.iconKey ? getSectionIcon(setting.iconKey) : base.icon,
      tone: setting?.accentKey ?? base.tone,
      cardStyle: setting?.cardStyle ?? base.cardStyle,
      title: setting?.title ?? base.title,
      description: setting?.description ?? base.description,
      sortOrder: setting?.sortOrder ?? base.sortOrder,
    }];
  });
  const customCards = (platform.data?.sections ?? []).map(section => ({
    href: `/sections/${section.slug}`, title: section.title, description: section.description,
    action: section.kind === 'module' ? 'افتح الوحدة' : 'اقرأ المحتوى',
    icon: getSectionIcon(section.iconKey ?? (section.kind === 'module' ? 'book' : 'file')),
    tone: section.accentKey ?? (section.kind === 'module' ? 'violet' : 'indigo'),
    cardStyle: section.cardStyle ?? 'soft', sortOrder: section.sortOrder,
  }));
  const demoCard = {
    href: '/demo-data', title: 'نماذج تجريبية', description: 'استكشف مادة واختبارًا وملفات افتراضية دون تغيير بياناتك.',
    action: 'عرض النماذج', icon: Sparkles, tone: 'teal', cardStyle: 'soft', sortOrder: 80,
  };
  const dashboardCards = [...builtInCards, ...customCards, demoCard].sort((a, b) => a.sortOrder - b.sortOrder);
  const stats = [
    { value: data.totalAchievements, label: 'إنجاز موثّق', icon: Award, testId: 'text-total-achievements' },
    { value: data.achievementsThisMonth, label: 'إنجاز هذا الشهر', icon: TrendingUp, testId: 'text-month-achievements' },
    { value: data.completedCourses, label: 'دورة مكتملة', icon: BookOpen, testId: 'text-completed-courses' },
    { value: data.completedLessons, label: 'درس مكتمل', icon: GraduationCap, testId: 'text-completed-lessons' },
    { value: data.points, label: 'نقطة نمو', icon: Sparkles, testId: 'text-dashboard-points' },
    { value: readiness, label: 'الجاهزية المهنية', icon: Target, testId: 'text-readiness-score', suffix: '%' },
  ].filter(stat => stat.value > 0);
  return <div className="page-wrap">
     <PublishedContent kind="announcement"/>
     <PageTitle kicker="مساحتك اليوم" title={greeting} detail="مساحتك الشخصية للتعلّم، وتطوير مهاراتك، وتحقيق أهدافك." action={<button className="button button-primary" onClick={() => setLocation('/achievements')} data-testid="button-add-from-dashboard"><Plus size={17}/> وثّق تجربة</button>}/>
     <section className="welcome-strip dashboard-welcome" data-testid="dashboard-welcome">
        <div className="welcome-copy"><span className="welcome-overline">خطوتك التالية</span><h2>{platform.data?.appearance.welcomeTitle ?? DEFAULT_APPEARANCE.welcomeTitle}</h2><p>{platform.data?.appearance.welcomeDescription ?? DEFAULT_APPEARANCE.welcomeDescription}</p></div>
       <Link href={dashboardCards[0]?.href ?? '/profile'} className="dashboard-start" data-testid="link-dashboard-start"><span className="dashboard-start-icon"><GraduationCap size={22}/></span><span><b>ابدأ رحلتك في أثر</b><small>استكشف مساحتك وابدأ من هنا</small></span><ArrowLeft size={18}/></Link>
       <div className="welcome-index">مساحة الطالب</div>
     </section>
     <section className="dashboard-tools" aria-labelledby="dashboard-tools-title">
       <div className="dashboard-section-heading"><div><span className="section-kicker">اكتشف مساحتك</span><h2 id="dashboard-tools-title">مساحتك في أثر</h2><p>كل أدواتك للتعلّم والتطوير في مكان واحد</p></div></div>
        {dashboardCards.length > 0 ? <div className="dashboard-feature-grid">{dashboardCards.map(({ href, title, description, action, icon: Icon, tone, cardStyle }) => {
          const accent = getSectionAccent(tone);
          return <Link key={href} href={href} className={`dashboard-feature-card feature-${tone} card-style-${cardStyle}`} style={{ '--feature-accent': accent.color, '--feature-soft': accent.soft } as CSSProperties} data-testid={`dashboard-feature-${href.slice(1).replaceAll('/', '-')}`}>
            <span className="dashboard-feature-icon"><Icon size={21}/></span><h3>{title}</h3><p>{description}</p><span className="dashboard-feature-action">{action}<ArrowLeft size={15}/></span>
          </Link>;
        })}</div> : <div className="empty-state"><h3>لا توجد مساحات مفعّلة حالياً</h3><p>يمكن لمسؤول المنصة إتاحتها من إعدادات الإدارة.</p></div>}
     </section>
     {stats.length > 0 && <section className="dashboard-stats" aria-label="رحلتك حتى الآن"><div className="dashboard-section-heading dashboard-stats-heading"><div><span className="section-kicker">من رحلتك</span><h2>رحلتك حتى الآن</h2></div></div><div className="dashboard-stat-grid">{stats.map(({ value, label, icon: Icon, testId, suffix }) => <div className="dashboard-stat" key={testId}><span className="dashboard-stat-icon"><Icon size={17}/></span><span className="dashboard-stat-copy"><b data-testid={testId}>{value.toLocaleString('ar')}{suffix || ''}</b><small>{label}</small></span></div>)}</div></section>}
    <div className="dashboard-lower">
      <section className="recent-section"><div className="section-heading"><div><span className="section-kicker">من رحلتك</span><h2>أحدث الإنجازات</h2></div><Link href="/achievements" className="subtle-link" data-testid="link-all-achievements">كل الإنجازات <ArrowLeft size={15}/></Link></div>
        {recent.length ? <div className="achievement-list">{recent.slice(0, 4).map(item => <AchievementCard key={item.id} item={item} compact/>)}</div> : <EmptyState title="هنا تبدأ قصتك" body="أضف أول تجربة صنعت فيها فرقاً، مهما كانت صغيرة." action={<Link href="/achievements" className="button button-primary button-compact" data-testid="button-empty-add">أضف إنجازك الأول <Plus size={15}/></Link>}/>}
      </section>
      <aside className="profile-progress-card"><div className="profile-progress-top"><span className="section-kicker">صورتك المهنية</span><span className="progress-percent">{profile.data ? `${data.profileCompletion}%` : 'ابدأ هنا'}</span></div><h3>ملفك الشخصي</h3><p>أضف تفاصيلك ومهاراتك لتتضح صورتك المهنية.</p><div className="progress-track"><span style={{ width: `${data.profileCompletion}%` }}/></div><div className="progress-legend"><span>اكتمال الملف</span><b>{data.profileCompletion}%</b></div><Link href="/profile" className="progress-cta" data-testid="link-complete-profile">أكمل ملفك <ArrowLeft size={15}/></Link><div className="progress-note"><span><Lightbulb size={16}/></span><p>يساعدك الملف المكتمل على رؤية مهاراتك بوضوح.</p></div></aside>
    </div>
  </div>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="empty-state" data-testid="status-empty"><span className="empty-mark"><Sparkles size={21}/></span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

type AchievementFormState = {
  title: string; category: string; context: string; challenge: string; action: string;
  result: string; achievedOn: string; skills: string; resumeBullet: string; interviewStory: string; serviceOffer: string; summary: string;
};
const freshForm = (): AchievementFormState => ({
  title: '', category: 'project', context: '', challenge: '', action: '', result: '',
  achievedOn: new Date().toISOString().slice(0, 10), skills: '', resumeBullet: '', interviewStory: '', serviceOffer: '', summary: '',
});

function AchievementDialog({ initial, onClose, onSaved }: { initial?: Achievement; onClose: () => void; onSaved: (achievement: Achievement, created: boolean) => void }) {
  const cache = useQueryClient();
  const [form, setForm] = useState<AchievementFormState>(() => initial ? {
    title: initial.title, category: initial.category, context: initial.context, challenge: initial.challenge || '',
    action: initial.action, result: initial.result, achievedOn: initial.achievedOn.slice(0, 10),
    skills: initial.skills.join('، '), resumeBullet: initial.resumeBullet || '', interviewStory: initial.interviewStory || '', serviceOffer: initial.serviceOffer || '', summary: initial.summary || '',
  } : freshForm());
  const create = useCreateAchievement();
  const update = useUpdateAchievement();
  const draft = useGenerateAchievementDraft();
  const busy = create.isPending || update.isPending;
  const set = (key: keyof AchievementFormState, value: string) => setForm(old => ({ ...old, [key]: value }));
  const makeDraft = () => {
    const input: AchievementDraftInput = {
      title: form.title, context: form.context, challenge: form.challenge || undefined,
      action: form.action, result: form.result,
      skills: form.skills.split(/[،,]/).map(s => s.trim()).filter(Boolean),
    };
    draft.mutate({ data: input }, { onSuccess: result => setForm(old => ({ ...old, resumeBullet: result.resumeBullet, interviewStory: result.interviewStory, serviceOffer: result.serviceOffer, summary: result.summary })) });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload: AchievementInput = {
      title: form.title.trim(), category: form.category as AchievementInput['category'],
      context: form.context.trim(), challenge: form.challenge.trim(),
      action: form.action.trim(), result: form.result.trim(), achievedOn: form.achievedOn,
      skills: form.skills.split(/[،,]/).map(s => s.trim()).filter(Boolean),
      resumeBullet: form.resumeBullet.trim(), interviewStory: form.interviewStory.trim(), serviceOffer: form.serviceOffer.trim(), summary: form.summary.trim(),
    };
    const done = (achievement: Achievement) => {
      cache.invalidateQueries({ queryKey: getListAchievementsQueryKey() });
      cache.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      onSaved(achievement, !initial); onClose();
    };
    if (initial) update.mutate({ id: initial.id, data: payload }, { onSuccess: done });
    else create.mutate({ data: payload }, { onSuccess: done });
  };
  return <div className="dialog-scrim" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="achievement-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" dir="rtl" data-testid="dialog-achievement">
    <header className="dialog-header"><div><span className="page-kicker">{initial ? 'تحرير التجربة' : 'توثيق تجربة جديدة'}</span><h2 id="dialog-title">{initial ? 'حدّث أثرك' : 'ما الذي أنجزته؟'}</h2><p>اكتب التجربة كما تتذكرها؛ لا تحتاج إلى صياغة مثالية.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق" data-testid="button-close-dialog"><X size={19}/></button></header>
    <form className="achievement-form" onSubmit={submit}>
      <label className="field field-wide"><span>عنوان الإنجاز <RequiredMark/></span><input required maxLength={160} value={form.title} onChange={e => set('title', e.target.value)} placeholder="مثال: نظّمت معرض مشاريع التخرج" data-testid="input-achievement-title"/></label>
      <div className="form-grid"><label className="field">نوع التجربة<select value={form.category} onChange={e => set('category', e.target.value)} data-testid="select-achievement-category">{categories.map(c => <option key={c} value={c}>{categoryNames[c]}</option>)}</select></label><label className="field"><span>متى حدثت؟ <RequiredMark/></span><input type="date" required value={form.achievedOn} onChange={e => set('achievedOn', e.target.value)} data-testid="input-achievement-date"/></label></div>
      <label className="field">السياق أو المكان<textarea rows={2} maxLength={2000} value={form.context} onChange={e => set('context', e.target.value)} placeholder="أين حدثت هذه التجربة؟ مع من عملت؟" data-testid="input-achievement-context"/></label>
      <label className="field">ما التحدي الذي واجهته؟<textarea rows={2} maxLength={2000} value={form.challenge} onChange={e => set('challenge', e.target.value)} placeholder="ما الذي احتاج إلى حل أو اهتمام؟" data-testid="input-achievement-challenge"/></label>
      <label className="field"><span>ماذا فعلت أنت؟ <RequiredMark/></span><textarea required rows={3} maxLength={3000} value={form.action} onChange={e => set('action', e.target.value)} placeholder="صف مساهمتك المحددة، وما الذي قمت به بنفسك." data-testid="input-achievement-action"/></label>
      <label className="field"><span>ما النتيجة؟ <RequiredMark/></span><textarea required rows={2} maxLength={2000} value={form.result} onChange={e => set('result', e.target.value)} placeholder="أثر ملموس، رقم، أو شيء تعلمته." data-testid="input-achievement-result"/></label>
      <label className="field">المهارات التي استخدمتها<span className="field-hint">افصل بين المهارات بفاصلة</span><input value={form.skills} onChange={e => set('skills', e.target.value)} placeholder="التواصل، البحث، إدارة الوقت" data-testid="input-achievement-skills"/></label>
       {!initial && <div className="achievement-evidence-next-step"><Paperclip size={18}/><div><b>أضف صورك وملفاتك كدليل</b><p>بعد حفظ الإنجاز ستفتح لك مساحة لإرفاق الصور والفيديوهات والملفات أو إضافة نص ورابط.</p></div></div>}
        <div className="ai-callout"><div className="ai-callout-copy"><span className="ai-icon"><Sparkles size={17}/></span><div><b>حوّل تجربتك إلى قصة واضحة</b><small>اقتراحات للسيرة والمقابلة وعرض مهارتك وملخص التجربة.</small></div></div><button className="button button-ai" type="button" disabled={draft.isPending || !form.title || !form.action || !form.result} onClick={makeDraft} data-testid="button-generate-draft">{draft.isPending ? <LoaderCircle size={15} className="spin"/> : <Sparkles size={15}/>} {draft.isPending ? 'نرتّب كلماتك…' : 'اقترح صياغة'}</button></div>
      {draft.isError && <p className="form-error" role="alert" data-testid="status-draft-error">لم نتمكن من إنشاء المسودة. يمكنك المتابعة بصياغتك الخاصة.</p>}
       <label className="field">عبارة للسيرة المهنية<textarea rows={2} maxLength={1000} value={form.resumeBullet} onChange={e => set('resumeBullet', e.target.value)} placeholder="تظهر هذه العبارة في معاينة سيرتك المهنية." data-testid="input-resume-bullet"/></label>
        <label className="field">قصة ترويها في المقابلة<textarea rows={3} maxLength={3000} value={form.interviewStory} onChange={e => set('interviewStory', e.target.value)} placeholder="احتفظ بتفاصيل تساعدك على رواية التجربة." data-testid="input-interview-story"/></label>
        <label className="field">عرض مهارة أو مشروع<textarea rows={2} maxLength={2000} value={form.serviceOffer} onChange={e => set('serviceOffer', e.target.value)} placeholder="صياغة موجزة توضّح ما تستطيع تقديمه في مشروع أو فريق." data-testid="input-service-offer"/></label>
        <label className="field">ملخص التجربة<span className="field-hint">جملة موجزة تظهر في بنك الأثر، ويمكنك تعديلها.</span><textarea rows={2} maxLength={1000} value={form.summary} onChange={e => set('summary', e.target.value)} placeholder="ما أهم ما تريد أن يتذكره القارئ عن هذه التجربة؟" data-testid="input-achievement-summary"/></label>
      {(create.isError || update.isError) && <p className="form-error" role="alert" data-testid="status-save-error">لم يُحفظ الإنجاز. حاول مرة أخرى.</p>}
      <footer className="dialog-footer"><button className="button button-outline" type="button" onClick={onClose} data-testid="button-cancel-achievement">إلغاء</button><button className="button button-primary" type="submit" disabled={busy} data-testid="button-save-achievement">{busy ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} {busy ? 'جارٍ الحفظ' : 'حفظ التجربة'}</button></footer>
    </form>
  </section></div>;
}

function AchievementsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | undefined>();
  const [evidenceFor, setEvidenceFor] = useState<Achievement | undefined>();
  const params = useMemo(() => ({ query: query || undefined, category: category ? category as 'project' : undefined }), [query, category]);
  const result = useListAchievements(params, { query: { queryKey: getListAchievementsQueryKey(params) } });
  const remove = useDeleteAchievement();
  const cache = useQueryClient();
  const [, setLocation] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.querySelector(".content-area")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);
  const openNew = () => { setEditing(undefined); setDialogOpen(true); };
  const openEdit = (item: Achievement) => { setEditing(item); setDialogOpen(true); };
  useEffect(() => {
    const handleCreate = () => openNew();
    window.addEventListener('athar:new-achievement', handleCreate);
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      openNew();
      setLocation('/achievements', { replace: true });
    }
    return () => window.removeEventListener('athar:new-achievement', handleCreate);
  }, []);
  const deleteItem = (item: Achievement) => {
    if (window.confirm(`هل تريد حذف «${item.title}»؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      remove.mutate({ id: item.id }, { onSuccess: () => {
        cache.invalidateQueries({ queryKey: getListAchievementsQueryKey() });
        cache.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      } });
    }
  };
  return <div className="page-wrap"><PageTitle kicker="أدلتك على ما تستطيع" title="إنجازاتي" detail="كل مشروع، مبادرة، أو تحدٍ تجاوزته — يستحق أن يبقى هنا." action={<button className="button button-primary" onClick={openNew} data-testid="button-create-achievement"><Plus size={17}/> أضف إنجازاً</button>}/>
    <div className="achievement-tools"><label className="search-box"><Search size={18}/><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث في إنجازاتك…" aria-label="ابحث في الإنجازات" data-testid="input-search-achievements"/>{query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="مسح البحث"><X size={15}/></button>}</label>
      <label className="filter-box"><Filter size={16}/><select value={category} onChange={e => setCategory(e.target.value)} aria-label="تصفية حسب نوع التجربة" data-testid="select-filter-category"><option value="">كل التجارب</option>{categories.map(c => <option key={c} value={c}>{categoryNames[c]}</option>)}</select><ChevronDown size={14}/></label>
      <span className="achievement-count" data-testid="text-achievement-count">{result.isLoading ? 'جارٍ تحميل الإنجازات…' : result.isError ? 'تعذّر تحميل الإنجازات' : formatAchievementCount(result.data?.length ?? 0)}</span></div>
    {result.isLoading ? <LoadingPanel label="نجمع تجاربك" /> : result.isError ? <ErrorPanel retry={() => result.refetch()}/> : result.data?.length ? <div className="achievement-list full-achievement-list">{result.data.map(item => <AchievementCard key={item.id} item={item} onEdit={openEdit} onDelete={deleteItem} onManageAttachments={setEvidenceFor}/>)}</div> : <EmptyState title={query || category ? 'لم نجد تجربة بهذا الوصف' : 'كل رحلة تبدأ بتجربة واحدة'} body={query || category ? 'جرّب كلمة بحث أخرى أو غيّر نوع التجربة.' : 'ابدأ بتوثيق مشروع أو نشاط شاركت فيه. التجارب الصغيرة تصنع قصة كبيرة.'} action={query || category ? <button className="button button-outline" onClick={() => { setQuery(''); setCategory(''); }} data-testid="button-clear-filters">مسح البحث والتصفية</button> : <button className="button button-primary" onClick={openNew} data-testid="button-empty-create">أضف أول إنجاز <Plus size={16}/></button>}/>}
    {remove.isError && <p className="form-error inline-error" data-testid="status-delete-error">تعذّر حذف الإنجاز. حاول مرة أخرى.</p>}
    {dialogOpen && <AchievementDialog initial={editing} onClose={() => setDialogOpen(false)} onSaved={(achievement, created) => { if (created) setEvidenceFor(achievement); }}/>}
    {evidenceFor && <AchievementAttachmentsDialog achievement={evidenceFor} onClose={() => setEvidenceFor(undefined)}/>}
  </div>;
}

function ProfilePage() {
  const cache = useQueryClient();
  const profile = useGetStudentProfile({ query: { queryKey: getGetStudentProfileQueryKey(), retry: false } });
  const save = useSaveStudentProfile();
  const [name, setName] = useState(''); const [university, setUniversity] = useState('');
  const [major, setMajor] = useState(''); const [year, setYear] = useState('');
  const [headline, setHeadline] = useState(''); const [skills, setSkills] = useState('');
  const [initialized, setInitialized] = useState(false);
  const isNewProfile = !profile.data && profile.error?.status === 404;
  useEffect(() => {
    if (profile.data && !initialized) {
      setName(profile.data.fullName); setUniversity(profile.data.university); setMajor(profile.data.major);
      setYear(profile.data.yearOfStudy?.toString() || ''); setHeadline(profile.data.headline || '');
      setSkills(profile.data.skills.join('، ')); setInitialized(true);
    }
  }, [profile.data, initialized]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const data: StudentProfileInput = {
      fullName: name.trim(), university: university.trim(), major: major.trim(),
      yearOfStudy: year ? Number(year) : null, headline: headline.trim(),
      skills: skills.split(/[،,]/).map(s => s.trim()).filter(Boolean),
    };
    save.mutate({ data }, { onSuccess: updated => {
      cache.setQueryData(getGetStudentProfileQueryKey(), updated);
      cache.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setInitialized(true);
    } });
  };
  if (profile.isLoading) return <LoadingPanel label="نجهّز ملفك الشخصي"/>;
  if (profile.isError && !profile.data && !isNewProfile) return <div className="page-wrap"><PageTitle kicker="تعريفك المهني" title="ملفي الشخصي" detail="ابدأ ببناء صورة واضحة عمّا تعرفه وما تطمح إليه."/><div className="profile-error"><ErrorPanel title="لا يمكن تحميل ملفك الآن" retry={() => profile.refetch()}/></div></div>;
  const profilePercent = [name, university, major, year, headline, skills].filter(Boolean).length;
  return <div className="page-wrap"><PageTitle kicker="من أنت؟" title="ملفي الشخصي" detail={isNewProfile ? 'أهلًا بك! أضف بياناتك لإنشاء ملفك الشخصي. يمكنك تحديثها في أي وقت.' : 'عرّف بنفسك كما أنت الآن. يمكنك تحديث التفاصيل كلما تغيّرت رحلتك.'}/>
    <div className="profile-layout"><form className="profile-form panel" onSubmit={submit}><div className="panel-header"><div><span className="section-kicker">معلوماتك الأساسية</span><h2>صورتك المهنية</h2></div><div className="profile-completion-badge"><span>{Math.round(profilePercent / 6 * 100)}%</span><small>مكتمل</small></div></div>
      <div className="profile-form-grid">
        <label className="field"><span>الاسم الكامل <RequiredMark/></span><input required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="اسمك كما تحب أن يظهر" data-testid="input-profile-name"/></label>
        <label className="field"><span>الجامعة <RequiredMark/></span><input required maxLength={160} value={university} onChange={e => setUniversity(e.target.value)} placeholder="اسم الجامعة" data-testid="input-profile-university"/></label>
        <label className="field"><span>التخصص <RequiredMark/></span><input required maxLength={120} value={major} onChange={e => setMajor(e.target.value)} placeholder="مثال: هندسة البرمجيات" data-testid="input-profile-major"/></label>
        <label className="field">السنة الدراسية<select value={year} onChange={e => setYear(e.target.value)} data-testid="select-profile-year"><option value="">اختر السنة</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>السنة {i + 1}</option>)}</select></label>
        <label className="field field-wide">نبذة قصيرة عنك<input maxLength={240} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="ما المجال الذي يثير فضولك؟" data-testid="input-profile-headline"/></label>
        <label className="field field-wide">مهاراتك<span className="field-hint">اكتب مهارة واحدة أو أكثر، وافصل بينها بفاصلة</span><textarea rows={3} value={skills} onChange={e => setSkills(e.target.value)} placeholder="تحليل البيانات، العمل الجماعي، الكتابة" data-testid="input-profile-skills"/></label>
      </div>
      {save.isSuccess && <p className="success-note" role="status" data-testid="status-profile-saved"><Check size={15}/> تم حفظ تغييراتك.</p>}{save.isError && <p className="form-error" role="alert" data-testid="status-profile-error">لم يتم الحفظ. حاول مرة أخرى.</p>}
      <div className="profile-submit"><span>تُحفظ معلوماتك في مساحتك الخاصة.</span><button className="button button-primary" type="submit" disabled={save.isPending} data-testid="button-save-profile">{save.isPending ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} {save.isPending ? 'جارٍ الحفظ' : 'حفظ الملف'}</button></div>
    </form><aside className="profile-side-note"><div className="note-art"><div className="note-art-circle"><GraduationCap size={28}/></div><span className="note-art-dot"/></div><span className="section-kicker">نصيحة أثر</span><h3>ابدأ بما تعرفه، لا بما ينقصك.</h3><p>ليس عليك أن تكون خبيراً. المهارات التي تستخدمها في مشاريعك ودراستك هي بداية حقيقية.</p><div className="tip-divider"/><span className="tip-sub">أضف مهاراتك من تجاربك</span><Link href="/achievements" className="subtle-link" data-testid="link-profile-achievements">استكشف إنجازاتك <ArrowLeft size={14}/></Link></aside></div>
  </div>;
}

function ResumePage() {
  const profile = useGetStudentProfile({ query: { queryKey: getGetStudentProfileQueryKey(), retry: false } });
  const achievements = useListAchievements(undefined, { query: { queryKey: getListAchievementsQueryKey() } });
  const learning = useListLearningItems(undefined, { query: { queryKey: getListLearningItemsQueryKey() } });
  if (profile.isLoading || achievements.isLoading || learning.isLoading) return <LoadingPanel label="نرتّب صورتك المهنية"/>;
  if (profile.isError || achievements.isError || learning.isError) return <ErrorPanel retry={() => { profile.refetch(); achievements.refetch(); learning.refetch(); }}/>;
  const achievementItems = achievements.data ?? [];
  const completedCourses = learning.data?.filter(item => item.kind === 'course' && item.status === 'completed') ?? [];
  return <div className="page-wrap">
    <ResumeStudio profile={profile.data ?? null} achievements={achievementItems} courses={completedCourses}/>
    <ResumeSharePanel achievements={achievementItems} courses={completedCourses}/>
  </div>;
}

function ResumeTemplatesPage() {
  return <div className="page-wrap"><ResumeTemplateStudio/></div>;
}

function ResumeSharePanel({ achievements, courses }: { achievements: Achievement[]; courses: LearningItem[] }) {
  const cache = useQueryClient();
  const settingsQuery = useGetResumeShareSettings({ query: { queryKey: getGetResumeShareSettingsQueryKey(), retry: false } });
  const saveSettings = useSaveResumeShareSettings();
  const [initialized, setInitialized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<ResumeShareUpdate>({
    enabled: false, showName: false, showHeadline: false, showUniversity: false,
    showMajor: false, showYearOfStudy: false, showSkills: false,
    achievementIds: [], courseIds: [],
  });
  useEffect(() => {
    if (settingsQuery.data && !initialized) {
      const { token: _token, ...savedSettings } = settingsQuery.data;
      setDraft(savedSettings);
      setInitialized(true);
    }
  }, [settingsQuery.data, initialized]);

  const updateFlag = (key: 'enabled' | 'showName' | 'showHeadline' | 'showUniversity' | 'showMajor' | 'showYearOfStudy' | 'showSkills', value: boolean) => {
    setDraft(current => ({ ...current, [key]: value }));
  };
  const toggleId = (key: 'achievementIds' | 'courseIds', id: string, checked: boolean) => {
    setDraft(current => ({
      ...current,
      [key]: checked ? [...current[key], id] : current[key].filter(value => value !== id),
    }));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload: ResumeShareUpdate = {
      ...draft,
      achievementIds: draft.achievementIds.filter(id => achievements.some(item => item.id === id)),
      courseIds: draft.courseIds.filter(id => courses.some(item => item.id === id)),
    };
    setDraft(payload);
    saveSettings.mutate({ data: payload }, {
      onSuccess: saved => {
        const { token: _token, ...savedSettings } = saved;
        setDraft(savedSettings);
        setInitialized(true);
        cache.setQueryData(getGetResumeShareSettingsQueryKey(), saved);
      },
    });
  };
  const token = settingsQuery.data?.token;
  const shareUrl = token ? `${window.location.origin}${basePath}/portfolio/${token}` : '';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  const profileChoices: Array<{ key: 'showName' | 'showHeadline' | 'showUniversity' | 'showMajor' | 'showYearOfStudy' | 'showSkills'; label: string }> = [
    { key: 'showName', label: 'الاسم' },
    { key: 'showHeadline', label: 'النبذة القصيرة' },
    { key: 'showUniversity', label: 'الجامعة' },
    { key: 'showMajor', label: 'التخصص' },
    { key: 'showYearOfStudy', label: 'السنة الدراسية' },
    { key: 'showSkills', label: 'المهارات' },
  ];

  if (settingsQuery.isError) return <section className="panel resume-share-panel" dir="rtl"><ErrorPanel title="تعذّر تحميل إعدادات المشاركة" retry={() => settingsQuery.refetch()}/></section>;
  if (settingsQuery.isLoading || !initialized) return <div className="panel resume-share-loading" role="status">جارٍ تحميل إعدادات المشاركة…</div>;

  return <section className="panel resume-share-panel" dir="rtl" aria-labelledby="resume-share-title">
    <div className="resume-share-heading"><span className="share-panel-icon"><Share2 size={18}/></span><div><span className="section-kicker">تحكم بالظهور</span><h2 id="resume-share-title">شارك ملفك المهني</h2><p>لا يظهر أي شيء للآخرين حتى تفعّل الرابط وتختار ما تريد مشاركته.</p></div></div>
    <form onSubmit={submit}>
      <label className="share-enable-row"><span><b>رابط مشاركة عام</b><small>يمكن لأي شخص يملك الرابط مشاهدة المحتوى الذي اخترته.</small></span><input type="checkbox" checked={draft.enabled} onChange={event => updateFlag('enabled', event.target.checked)} aria-label="تفعيل رابط المشاركة" data-testid="checkbox-resume-share-enabled"/></label>
      <div className="share-choice-section"><h3>معلومات الملف</h3><div className="share-checkbox-grid">{profileChoices.map(choice => <label key={choice.key} className="share-choice"><input type="checkbox" checked={draft[choice.key]} onChange={event => updateFlag(choice.key, event.target.checked)} data-testid={`checkbox-share-${choice.key}`}/><span>{choice.label}</span></label>)}</div></div>
      <div className="share-choice-section"><h3>الإنجازات</h3>{achievements.length ? <div className="share-item-list">{achievements.map(item => <label className="share-item-choice" key={item.id}><input type="checkbox" checked={draft.achievementIds.includes(item.id)} disabled={!draft.achievementIds.includes(item.id) && draft.achievementIds.length >= 100} onChange={event => toggleId('achievementIds', item.id, event.target.checked)}/><span><b>{item.title}</b><small>{categoryNames[item.category] || 'إنجاز'} · {new Date(item.achievedOn).toLocaleDateString('ar', { year: 'numeric', month: 'short' })}</small></span></label>)}</div> : <p className="share-empty">لا توجد إنجازات موثقة للاختيار.</p>}</div>
      <div className="share-choice-section"><h3>الدورات المكتملة</h3>{courses.length ? <div className="share-item-list">{courses.map(item => <label className="share-item-choice" key={item.id}><input type="checkbox" checked={draft.courseIds.includes(item.id)} disabled={!draft.courseIds.includes(item.id) && draft.courseIds.length >= 100} onChange={event => toggleId('courseIds', item.id, event.target.checked)}/><span><b>{item.title}</b><small>{item.source || item.subject || 'دورة مكتملة'}</small></span></label>)}</div> : <p className="share-empty">ستظهر هنا الدورات بعد تحديد حالتها «أكملتها».</p>}</div>
      {saveSettings.isSuccess && <p className="success-note" role="status" data-testid="status-share-saved"><Check size={15}/> تم حفظ إعدادات المشاركة.</p>}
      {saveSettings.isError && <p className="form-error" role="alert" data-testid="status-share-error">لم يتم حفظ الإعدادات. تحقق من اختياراتك وحاول مرة أخرى.</p>}
      <div className="share-actions"><span>البيانات غير المختارة تبقى خاصة.</span><button className="button button-primary" type="submit" disabled={saveSettings.isPending} data-testid="button-save-share-settings">{saveSettings.isPending ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} {saveSettings.isPending ? 'جارٍ الحفظ' : 'حفظ إعدادات المشاركة'}</button></div>
    </form>
    {settingsQuery.data?.enabled && shareUrl && <div className="share-link-result"><div><b>رابطك جاهز</b><small>إيقاف الرابط يبطل هذا العنوان، وإعادة التفعيل تنشئ رابطاً جديداً.</small></div><div className="share-link-controls"><input readOnly value={shareUrl} aria-label="رابط الملف المهني العام" data-testid="input-public-resume-link"/><button className="button button-outline button-compact" type="button" onClick={copyLink} data-testid="button-copy-resume-link">{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'تم النسخ' : 'نسخ الرابط'}</button><a className="button button-outline button-compact" href={shareUrl} target="_blank" rel="noreferrer" data-testid="link-open-public-resume"><ExternalLink size={15}/> معاينة</a></div></div>}
  </section>;
}

function PublicResumePage() {
  const [, params] = useRoute('/portfolio/:token');
  const token = params?.token ?? '';
  const result = useGetPublicResume(token, { query: { queryKey: getGetPublicResumeQueryKey(token), retry: false } });
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'ملف مهني | أثر';
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const createdRobotsTag = !robots;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    const previousRobots = robots.content;
    robots.content = 'noindex, nofollow';
    return () => {
      document.title = previousTitle;
      if (createdRobotsTag) robots?.remove();
      else if (robots) robots.content = previousRobots;
    };
  }, []);
  if (result.isLoading) return <main className="public-resume-page" dir="rtl"><LoadingPanel label="نجهّز الملف المهني"/></main>;
  if (result.isError || !result.data) return <main className="public-resume-page" dir="rtl"><div className="public-resume-unavailable"><Brand/><span className="section-kicker">رابط غير متاح</span><h1>تعذّر عرض هذا الملف المهني</h1><p>قد يكون الرابط متوقفاً أو غير صحيح. اطلب من صاحب الملف رابطاً محدثاً.</p></div></main>;
  const resume = result.data;
  const identityItems = [resume.headline, resume.university, resume.major, resume.yearOfStudy ? `السنة ${resume.yearOfStudy}` : null].filter(Boolean);
  return <main className="public-resume-page" dir="rtl">
    <header className="public-resume-top"><Brand/><div className="public-resume-actions"><ThemeToggle/><button className="button button-outline button-compact" type="button" onClick={() => window.print()}><Download size={15}/> طباعة</button></div></header>
    <article className="resume-paper public-resume-paper">
      <div className="resume-paper-top"><span>أثر / ملف مهني</span><span className="resume-date">{new Date().toLocaleDateString('ar', { year: 'numeric', month: 'long' })}</span></div>
      {(resume.fullName || identityItems.length > 0) && <header className="resume-identity"><div className="resume-avatar">{resume.fullName?.slice(0, 1) || 'أ'}</div><div>{resume.fullName && <h1>{resume.fullName}</h1>}{identityItems.map((item, index) => <p className="public-identity-detail" key={`${item}-${index}`}>{item}</p>)}</div></header>}
      {resume.skills.length > 0 && <section className="resume-section"><div className="resume-section-title"><span>٠١</span><h2>المهارات</h2></div><div className="resume-skills">{resume.skills.map(skill => <span key={skill}>{skill}</span>)}</div></section>}
      {resume.achievements.length > 0 && <section className="resume-section"><div className="resume-section-title"><span>٠٢</span><h2>تجارب وإنجازات</h2></div><div className="resume-experiences">{resume.achievements.map((item, index) => <article className="resume-experience" key={`${item.title}-${index}`}><div className="resume-experience-marker"/><div><div className="resume-experience-heading"><h3>{item.title}</h3><time>{new Date(item.achievedOn).toLocaleDateString('ar', { year: 'numeric', month: 'short' })}</time></div><span className="resume-context">{categoryNames[item.category] || item.category}</span>{item.resumeBullet && <p>{item.resumeBullet}</p>}</div></article>)}</div></section>}
      {resume.courses.length > 0 && <section className="resume-section"><div className="resume-section-title"><span>٠٣</span><h2>التعلّم والدورات</h2></div><div className="resume-experiences">{resume.courses.map((item, index) => <article className="resume-experience" key={`${item.title}-${index}`}><div className="resume-experience-marker"/><div><div className="resume-experience-heading"><h3>{item.title}</h3>{item.source && <span>{item.source}</span>}</div>{item.subject && <span className="resume-context">{item.subject}</span>}{!!item.studyMinutes && <p className="resume-context">وقت التعلّم المسجل داخل أثر: {item.studyMinutes.toLocaleString("ar")} دقيقة</p>}</div></article>)}</div></section>}
      {!resume.fullName && !identityItems.length && !resume.skills.length && !resume.achievements.length && !resume.courses.length && <p className="share-empty">لم يختر صاحب الملف معلومات لعرضها حالياً.</p>}
      <div className="resume-paper-footer"><Brand small/><span>ما صنعته يثبت ما تستطيع صنعه.</span></div>
    </article>
    <p className="public-resume-note">هذا الملف يعرض المعلومات التي وافق صاحبها على مشاركتها فقط.</p>
  </main>;
}

function RoadmapPage() {
  const cache = useQueryClient();
  const result = useGetCareerPlan({ query: { queryKey: getGetCareerPlanQueryKey() } });
  const savePlan = useSaveCareerPlan();
  const suggest = useGenerateCareerPlanSuggestions();
  const addTasks = useCreateCareerTasks();
  const updateTask = useUpdateCareerTask();
  const deleteTask = useDeleteCareerTask();
  const saveReminder = useSaveCareerReminder();
  const snoozeReminder = useSnoozeCareerReminder();
  const [targetRole, setTargetRole] = useState('');
  const [timeframeDays, setTimeframeDays] = useState<30 | 60 | 90>(60);
  const [overview, setOverview] = useState('');
  const [focusSkills, setFocusSkills] = useState('');
  const [suggestions, setSuggestions] = useState<CareerPlanSuggestions | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTaskId, setReminderTaskId] = useState('');
  const [reminderChannel, setReminderChannel] = useState<'in_app' | 'push'>('in_app');
  const [pushConsent, setPushConsent] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  useEffect(() => {
    if (!result.data || initialized) return;
    if (result.data.plan) {
      setTargetRole(result.data.plan.targetRole);
      setTimeframeDays(result.data.plan.timeframeDays);
      setOverview(result.data.plan.overview || '');
      setFocusSkills(result.data.plan.focusSkills.join('، '));
    }
    setReminderEnabled(result.data.reminder.enabled);
    setReminderTaskId(result.data.reminder.taskId || '');
    setReminderChannel(result.data.reminder.channel);
    setPushConsent(Boolean(result.data.reminder.consentAt));
    setInitialized(true);
  }, [result.data, initialized]);
  const tasks = result.data?.tasks || [];
  useEffect(() => {
    if (!result.data) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id.startsWith('roadmap-task-')) {
      const element = document.getElementById(id);
      element?.scrollIntoView({ block: 'center' });
      element?.setAttribute('tabindex', '-1');
      element?.focus({ preventScroll: true });
    }
  }, [result.data?.tasks]);
  const doneCount = tasks.filter(task => task.status === 'completed').length;
  const savePayload = (extra?: Partial<CareerPlanInput>): CareerPlanInput => ({
    targetRole: targetRole.trim(),
    timeframeDays,
    overview: extra?.overview ?? overview.trim(),
    focusSkills: extra?.focusSkills ?? focusSkills.split(/[،,]/).map(skill => skill.trim()).filter(Boolean),
  });
  const afterPlanWrite = (plan: CareerPlanOverview) => {
    cache.setQueryData(getGetCareerPlanQueryKey(), plan);
    cache.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() });
  };
  const handleSavePlan = (event?: FormEvent) => {
    event?.preventDefault();
    if (targetRole.trim().length < 2) return;
    savePlan.mutate({ data: savePayload() }, { onSuccess: () => {
      cache.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() });
    } });
  };
  const generateSuggestions = () => {
    if (targetRole.trim().length < 2) return;
    savePlan.mutate({ data: savePayload() }, {
      onSuccess: () => {
        cache.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() });
        suggest.mutate({ data: { targetRole: targetRole.trim(), timeframeDays } }, {
          onSuccess: response => {
            savePlan.mutate({ data: savePayload({ overview: response.overview, focusSkills: response.focusSkills }) }, {
              onSuccess: () => {
                setSuggestions(response);
                setSelected(response.suggestions.map((_, index) => index));
                setOverview(response.overview);
                setFocusSkills(response.focusSkills.join('، '));
                cache.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() });
              },
            });
          },
        });
      },
    });
  };
  const saveSelected = () => {
    if (!suggestions || selected.length === 0) return;
    const tasksInput: CareerTasksInput = {
      tasks: selected.map(index => suggestions.suggestions[index]).filter(Boolean).map(task => ({
        title: task.title, detail: task.detail, stage: task.stage,
      })),
    };
    savePlan.mutate({ data: savePayload({ overview: suggestions.overview, focusSkills: suggestions.focusSkills }) }, {
      onSuccess: () => {
        addTasks.mutate({ data: tasksInput }, { onSuccess: () => {
          setSuggestions(null);
          setSelected([]);
          cache.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() });
        } });
      },
    });
  };
  const setStatus = (task: CareerTask, status: CareerTaskUpdate['status']) => {
    updateTask.mutate({ id: task.id, data: { status } }, {
      onSuccess: updated => {
        const current = cache.getQueryData<CareerPlanOverview>(getGetCareerPlanQueryKey());
        if (current) cache.setQueryData(getGetCareerPlanQueryKey(), { ...current, tasks: current.tasks.map(item => item.id === updated.id ? updated : item) });
        cache.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() });
      },
    });
  };
  const saveTaskEdit = (task: CareerTask) => {
    updateTask.mutate({ id: task.id, data: { title: editTitle.trim(), detail: editDetail.trim() } }, {
      onSuccess: updated => {
        const current = cache.getQueryData<CareerPlanOverview>(getGetCareerPlanQueryKey());
        if (current) cache.setQueryData(getGetCareerPlanQueryKey(), { ...current, tasks: current.tasks.map(item => item.id === updated.id ? updated : item) });
        setEditingId(null);
        cache.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() });
      },
    });
  };
  const removeTask = (task: CareerTask) => {
    if (!window.confirm(`هل تريد حذف «${task.title}» من خطتك؟`)) return;
    deleteTask.mutate({ id: task.id }, { onSuccess: () => {
      cache.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() });
    } });
  };
  if (result.isLoading) return <LoadingPanel label="نرتّب ملامح خطتك"/>;
  if (result.isError) return <ErrorPanel retry={() => result.refetch()}/>;
  const statusText: Record<CareerTask['status'], string> = { planned: 'مخططة', in_progress: 'قيد التنفيذ', completed: 'مكتملة' };
  const statusNext: Record<CareerTask['status'], CareerTask['status']> = { planned: 'in_progress', in_progress: 'completed', completed: 'planned' };
  const statusAction: Record<CareerTask['status'], string> = { planned: 'ابدأ هذه الخطوة', in_progress: 'أكمل هذه الخطوة', completed: 'أعد إلى المخطط' };
  const isOverdue = (task: CareerTask) => {
    const plan = result.data?.plan;
    if (!plan || task.status === 'completed') return false;
    const dueDay = plan.timeframeDays === 30
      ? Math.min(30, Math.ceil(task.stage / 3) * 7)
      : plan.timeframeDays === 60
        ? task.stage <= 6 ? 30 : 60
        : task.stage <= 4 ? 30 : task.stage <= 8 ? 60 : 90;
    const elapsedDays = (Date.now() - Date.parse(plan.createdAt)) / (24 * 60 * 60 * 1000);
    return elapsedDays > dueDay;
  };
  const incompleteTasks = tasks.filter(task => task.status !== 'completed');
  const overdueCount = incompleteTasks.filter(isOverdue).length;
  const setReminderCache = (reminder: CareerReminder) => {
    const current = cache.getQueryData<CareerPlanOverview>(getGetCareerPlanQueryKey());
    if (current) cache.setQueryData(getGetCareerPlanQueryKey(), { ...current, reminder });
  };
  const saveReminderSettings = async () => {
    setPushError('');
    setPushBusy(true);
    try {
    const subscription = reminderEnabled && reminderChannel === 'push'
      ? await prepareRoadmapPush() : undefined;
    saveReminder.mutate({
      data: {
        enabled: reminderEnabled, taskId: reminderEnabled ? reminderTaskId || null : null,
        channel: reminderChannel, pushConsent: reminderEnabled && reminderChannel === 'push' && pushConsent,
        subscription,
      },
    }, {
      onSuccess: reminder => {
        setReminderEnabled(reminder.enabled);
        setReminderTaskId(reminder.taskId || '');
        setReminderChannel(reminder.channel);
        setPushConsent(Boolean(reminder.consentAt));
        setReminderCache(reminder);
        cache.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() });
      },
    });
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'تعذّر إعداد إشعارات المتصفح. حاول مرة أخرى.');
    } finally {
      setPushBusy(false);
    }
  };
  const postponeReminder = () => {
    snoozeReminder.mutate(undefined, {
      onSuccess: reminder => {
        setReminderCache(reminder);
        cache.invalidateQueries({ queryKey: getGetCareerPlanQueryKey() });
      },
    });
  };
  const reminderTask = tasks.find(task => task.id === result.data?.reminder.taskId);
  const reminderDue = Boolean(
    result.data?.reminder.enabled &&
    result.data.reminder.nextReminderAt &&
    Date.parse(result.data.reminder.nextReminderAt) <= Date.now() &&
    reminderTask &&
    reminderTask.status !== 'completed',
  );
  const stageLabel = (stage: number) => {
    if (timeframeDays === 30) return `الأسبوع ${Math.min(4, Math.max(1, Math.ceil(stage / 3)))}`;
        if (timeframeDays === 60) return stage <= 6 ? 'الشهر الأول' : 'الشهر الثاني';
    return stage <= 4 ? 'أول ٣٠ يوماً' : stage <= 8 ? 'من ٣١ إلى ٦٠ يوماً' : 'من ٦١ إلى ٩٠ يوماً';
  };
  const buckets = Array.from(new Set(tasks.map(task => stageLabel(task.stage))));
  return <div className="page-wrap roadmap-page">
    <PageTitle kicker="خطوة عملية تلو الأخرى" title="خطتي المهنية" detail="حدّد وجهتك، ثم حوّل طموحك إلى خطوات صغيرة يمكن إنجازها."/>
    <section className="roadmap-hero">
      <div className="roadmap-hero-copy"><span className="roadmap-overline"><RouteIcon size={16}/> مسار يناسب واقعك</span><h2>{result.data?.plan?.targetRole ? <>تقترب من <em>{result.data.plan.targetRole}</em></> : <>المستقبل لا يحتاج<br/><em>إلى قفزة واحدة.</em></>}</h2><p>خطة واضحة تبدأ من مهاراتك وتجاربك، وتمنحك خطوة عملية تالية.</p></div>
      <div className="roadmap-progress"><div className="roadmap-progress-ring" style={{ '--roadmap-progress': `${tasks.length ? Math.round(doneCount / tasks.length * 100) : 0}%` } as CSSProperties}><span>{tasks.length ? Math.round(doneCount / tasks.length * 100) : 0}<small>٪</small></span></div><div><b>{doneCount} من {tasks.length}</b><small>الخطوات المكتملة من إجمالي الخطة</small></div></div>
      <span className="roadmap-hero-index">أثر / خطوتك القادمة</span>
    </section>
    <section className="weekly-reminder panel" aria-labelledby="weekly-reminder-title" data-testid="section-roadmap-reminder">
      <div className="weekly-reminder-copy">
        <span className="section-kicker"><Clock3 size={14}/> متابعة منتظمة</span>
        <h2 id="weekly-reminder-title">تذكير أسبوعي بخطوة واحدة</h2>
        <p>اختر التذكير داخل خطتك أو إشعاراً أسبوعياً على هذا الجهاز حتى عندما لا تكون الصفحة مفتوحة. يبدأ بعد أسبوع من الحفظ.</p>
        {result.data?.reminder.enabled && result.data.reminder.nextReminderAt && <small>الموعد القادم: {new Date(result.data.reminder.nextReminderAt).toLocaleDateString('ar-SA')}</small>}
      </div>
      <div className="weekly-reminder-controls">
        <label className="reminder-toggle">
          <input type="checkbox" checked={reminderEnabled} onChange={event => setReminderEnabled(event.target.checked)} disabled={!result.data?.plan || incompleteTasks.length === 0}/>
          <span>{reminderEnabled ? 'التذكير الأسبوعي مفعّل' : 'تفعيل التذكير الأسبوعي'}</span>
        </label>
        <label className="reminder-task-select">طريقة التذكير
          <select value={reminderChannel} onChange={event => { setReminderChannel(event.target.value as 'in_app' | 'push'); setPushConsent(false); setPushError(''); }} disabled={!reminderEnabled || pushBusy || saveReminder.isPending} data-testid="select-reminder-channel">
            <option value="in_app">داخل التطبيق فقط</option>
            <option value="push" disabled={!pushSupported()}>إشعارات المتصفح على هذا الجهاز</option>
          </select>
        </label>
        {!pushSupported() && <small>الإشعارات غير متاحة في هذا المتصفح أو داخل المعاينة. افتح أثر في نافذة مستقلة؛ وعلى iPhone أضفه إلى الشاشة الرئيسية.</small>}
        {reminderEnabled && reminderChannel === 'push' && <label className="reminder-toggle">
          <input type="checkbox" checked={pushConsent} onChange={event => setPushConsent(event.target.checked)} disabled={pushBusy || saveReminder.isPending} data-testid="checkbox-reminder-push-consent"/>
          <span>أوافق على إشعار أسبوعي على هذا الجهاز، وعلى حفظ اشتراك المتصفح لهذا الغرض فقط. يمكنني إيقافه هنا في أي وقت. يُستخدم آخر جهاز أحفظ منه الإعداد.</span>
        </label>}
        <label className="reminder-task-select">الخطوة التي يذكّرك بها
          <select value={reminderTaskId} onChange={event => setReminderTaskId(event.target.value)} disabled={!reminderEnabled || incompleteTasks.length === 0}>
            <option value="">اختر خطوة غير مكتملة</option>
            {incompleteTasks.map(task => <option value={task.id} key={task.id}>{task.title}</option>)}
          </select>
        </label>
        {result.data?.plan && incompleteTasks.length === 0 && <small className="reminder-no-tasks">أضف خطوة غير مكتملة إلى خطتك لتفعيل التذكير.</small>}
        <button className="button button-outline button-compact" type="button" onClick={saveReminderSettings} disabled={!result.data?.plan || pushBusy || saveReminder.isPending || (reminderEnabled && (!reminderTaskId || incompleteTasks.length === 0 || (reminderChannel === 'push' && !pushConsent)))} data-testid="button-save-roadmap-reminder">
          {pushBusy || saveReminder.isPending ? <LoaderCircle size={15} className="spin"/> : <Check size={15}/>} حفظ الإعداد
        </button>
      </div>
      {saveReminder.isError && <p className="form-error inline-error" role="alert" data-testid="status-roadmap-reminder-error">تعذّر حفظ التذكير. اختر خطوة غير مكتملة وحاول مرة أخرى.</p>}
      {pushError && <p className="form-error inline-error" role="alert">{pushError}</p>}
      {reminderDue && reminderTask && <div className="weekly-reminder-due" role="status" data-testid="status-roadmap-reminder-due">
        <div><b>حان وقت متابعة خطوتك الأسبوعية</b><span>{reminderTask.title}</span></div>
        <a className="button button-primary button-compact" href={`#roadmap-task-${reminderTask.id}`} data-testid="link-roadmap-reminder-task">انتقل إلى الخطوة <ArrowLeft size={14}/></a>
        <button type="button" className="button button-quiet button-compact" onClick={postponeReminder} disabled={snoozeReminder.isPending} data-testid="button-roadmap-reminder-next-week">{snoozeReminder.isPending ? 'جارٍ التحديث…' : 'ذكّرني الأسبوع القادم'}</button>
        {snoozeReminder.isError && <span className="form-error" role="alert">تعذّر تأجيل التذكير. حاول مرة أخرى.</span>}
      </div>}
    </section>
    <div className="roadmap-layout">
      <section className="roadmap-plan-panel panel">
        <div className="panel-header"><div><span className="section-kicker">ابدأ من وجهتك</span><h2>ما الدور الذي تطمح إليه؟</h2></div><span className="roadmap-step-number">٠١</span></div>
        <form onSubmit={handleSavePlan}>
          <label className="field"><span>الدور المستهدف <RequiredMark/></span><input value={targetRole} onChange={event => setTargetRole(event.target.value)} required minLength={2} maxLength={120} placeholder="مثال: محلل بيانات مبتدئ" data-testid="input-roadmap-role"/></label>
          <fieldset className="horizon-field"><legend>اختر أفقاً زمنياً</legend><div className="horizon-options">{([30, 60, 90] as const).map(days => <button type="button" key={days} className={`horizon-option ${timeframeDays === days ? 'horizon-selected' : ''}`} onClick={() => setTimeframeDays(days)} aria-pressed={timeframeDays === days} data-testid={`button-roadmap-horizon-${days}`}><b>{days}</b><span>يوماً</span></button>)}</div></fieldset>
          <label className="field">ملخص خطتك<textarea rows={3} maxLength={1500} value={overview} onChange={event => setOverview(event.target.value)} placeholder="ما الذي تريد أن تتمكن من فعله بنهاية هذه الفترة؟" data-testid="input-roadmap-overview"/></label>
          <label className="field">المهارات التي ستركّز عليها<span className="field-hint">افصل بين المهارات بفاصلة</span><input value={focusSkills} onChange={event => setFocusSkills(event.target.value)} placeholder="تحليل البيانات، التواصل" data-testid="input-roadmap-skills"/></label>
          {savePlan.isError && <p className="form-error" role="alert" data-testid="status-roadmap-save-error">تعذّر حفظ وجهتك. حاول مرة أخرى.</p>}
          <div className="roadmap-form-actions"><button className="button button-outline" type="submit" disabled={savePlan.isPending || targetRole.trim().length < 2} data-testid="button-save-roadmap">{savePlan.isPending && !suggest.isPending ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} حفظ الوجهة</button><button className="button button-primary" type="button" onClick={generateSuggestions} disabled={savePlan.isPending || suggest.isPending || targetRole.trim().length < 2} data-testid="button-generate-roadmap">{suggest.isPending || savePlan.isPending ? <LoaderCircle size={16} className="spin"/> : <Sparkles size={16}/>} {suggest.isPending || savePlan.isPending ? 'نعدّ خطوات تناسبك…' : 'اقترح خطوات'}</button></div>
          {suggest.isError && <p className="form-error" role="alert" data-testid="status-roadmap-suggestion-error">تعذّر إعداد المقترحات الآن. حُفظت وجهتك؛ يمكنك المحاولة لاحقاً.</p>}
          {savePlan.isSuccess && !savePlan.isPending && <p className="success-note" role="status" data-testid="status-roadmap-saved"><Check size={15}/> تم حفظ وجهتك.</p>}
        </form>
        <div className="roadmap-note"><Lightbulb size={17}/><p>تستند المقترحات إلى المهارات والإنجازات التي وثّقتها. اختر منها ما يناسب وقتك.</p></div>
      </section>
      <section className="roadmap-tasks-section">
        <div className="roadmap-section-heading"><div><span className="section-kicker">من الطموح إلى الممارسة</span><h2>خطواتك القادمة</h2></div><span className="task-total">{formatStepCount(tasks.length)}</span></div>
        {incompleteTasks.length > 0 && <div className="roadmap-task-summary" data-testid="roadmap-task-summary">{overdueCount > 0 && <span className="task-summary-overdue">{overdueCount.toLocaleString('ar')} متأخرة</span>}<span>{incompleteTasks.length.toLocaleString('ar')} غير مكتملة</span></div>}
        {suggestions && <section className="suggestions-panel" aria-labelledby="suggestion-heading" data-testid="section-roadmap-suggestions"><div className="suggestions-heading"><div><span className="suggestion-kicker"><Sparkles size={15}/> مقترحات لك</span><h3 id="suggestion-heading">اختر ما يناسب مسارك</h3><p>{suggestions.overview}</p></div><button className="icon-button" type="button" onClick={() => setSuggestions(null)} aria-label="إغلاق المقترحات" data-testid="button-close-suggestions"><X size={18}/></button></div>{suggestions.focusSkills.length > 0 && <div className="suggestion-skills"><span>مهارات التركيز</span>{suggestions.focusSkills.map(skill => <span className="skill-pill" key={skill}>{skill}</span>)}</div>}<div className="suggestion-list">{suggestions.suggestions.map((item, index) => <label className={`suggestion-item ${selected.includes(index) ? 'suggestion-picked' : ''}`} key={`${item.title}-${index}`} data-testid={`card-roadmap-suggestion-${index}`}><input type="checkbox" checked={selected.includes(index)} onChange={event => setSelected(old => event.target.checked ? [...old, index] : old.filter(value => value !== index))} data-testid={`checkbox-roadmap-suggestion-${index}`}/><span className="suggestion-check"><Check size={13}/></span><span className="suggestion-item-copy"><b>{item.title}</b><small>{item.detail}</small><em>{stageLabel(item.stage)}</em></span></label>)}</div>{addTasks.isError && <p className="form-error" role="alert">تعذّر حفظ الخطوات المختارة. حاول مرة أخرى.</p>}<button className="button button-primary suggestion-save" type="button" disabled={!selected.length || addTasks.isPending || savePlan.isPending} onClick={saveSelected} data-testid="button-save-roadmap-suggestions">{addTasks.isPending || savePlan.isPending ? <LoaderCircle size={16} className="spin"/> : <Plus size={16}/>} أضف {selected.length ? `(${selected.length})` : ''} إلى خطتي</button></section>}
        {tasks.length ? <div className="roadmap-task-groups">{buckets.map((bucket, bucketIndex) => <section className="roadmap-stage" key={bucket}><div className="stage-heading"><span className="stage-marker">{String(bucketIndex + 1).padStart(2, '0')}</span><h3>{bucket}</h3><span className="stage-rule"/></div><div className="roadmap-task-list">{tasks.filter(task => stageLabel(task.stage) === bucket).map(task => <article id={`roadmap-task-${task.id}`} className={`roadmap-task task-${task.status} ${isOverdue(task) ? 'task-overdue' : ''}`} key={task.id} data-testid={`card-roadmap-task-${task.id}`}><div className="task-status-mark">{task.status === 'completed' ? <CircleCheck size={19}/> : task.status === 'in_progress' ? <Clock3 size={18}/> : <span/>}</div><div className="roadmap-task-copy">{editingId === task.id ? <div className="task-edit-fields"><input aria-label="عنوان الخطوة" value={editTitle} onChange={event => setEditTitle(event.target.value)} data-testid={`input-edit-task-title-${task.id}`}/><textarea aria-label="تفاصيل الخطوة" value={editDetail} onChange={event => setEditDetail(event.target.value)} data-testid={`input-edit-task-detail-${task.id}`}/><div className="task-edit-actions"><button className="button button-primary button-compact" type="button" onClick={() => saveTaskEdit(task)} disabled={!editTitle.trim() || updateTask.isPending} data-testid={`button-save-task-${task.id}`}>حفظ</button><button className="button button-quiet button-compact" type="button" onClick={() => setEditingId(null)}>إلغاء</button></div></div> : <><div className="task-title-row"><h4>{task.title}</h4><span className={`task-status status-${task.status}`}>{statusText[task.status]}</span>{task.status !== 'completed' && <span className={`task-deadline-badge ${isOverdue(task) ? 'deadline-overdue' : ''}`}>{isOverdue(task) ? 'متأخرة' : 'غير مكتملة'}</span>}</div><p>{task.detail}</p></>}</div><div className="task-actions">{editingId !== task.id && <><button type="button" className="task-action-button" onClick={() => { setEditingId(task.id); setEditTitle(task.title); setEditDetail(task.detail); }} aria-label={`تعديل ${task.title}`} data-testid={`button-edit-task-${task.id}`}><Pencil size={15}/></button><button type="button" className="task-action-button task-delete" onClick={() => removeTask(task)} aria-label={`حذف ${task.title}`} data-testid={`button-delete-task-${task.id}`}><Trash2 size={15}/></button><button type="button" className="task-status-button" onClick={() => setStatus(task, statusNext[task.status])} disabled={updateTask.isPending} data-testid={`button-task-status-${task.id}`}>{statusAction[task.status]}</button></>}</div></article>)}</div></section>)}</div> : <EmptyState title="ابدأ بخطوتك الأولى" body="احفظ وجهتك، ثم اطلب مقترحات عملية أو أضف الخطوات المناسبة إلى خطتك." action={<button className="button button-primary button-compact" type="button" onClick={generateSuggestions} disabled={suggest.isPending || targetRole.trim().length < 2} data-testid="button-roadmap-empty-suggestions"><Sparkles size={15}/> اقترح خطوات مناسبة</button>}/>}
        {updateTask.isError && <p className="form-error inline-error" role="alert" data-testid="status-roadmap-task-error">تعذّر تحديث هذه الخطوة. حاول مرة أخرى.</p>}
        {deleteTask.isError && <p className="form-error inline-error" role="alert" data-testid="status-roadmap-delete-error">تعذّر حذف الخطوة. حاول مرة أخرى.</p>}
      </section>
    </div>
  </div>;
}

const learningStatus: Record<LearningItem['status'], string> = {
  planned: 'في خطتي', in_progress: 'أتابعها الآن', completed: 'أكملتها',
};
type LearningDraft = { kind: LearningItem['kind']; title: string; source: string; subject: string; url: string; notes: string; status: LearningItem['status'] };
const blankLearning = (): LearningDraft => ({ kind: 'course', title: '', source: '', subject: '', url: '', notes: '', status: 'planned' });

function LearningPage() {
  const cache = useQueryClient();
  const itemsQuery = useListLearningItems(undefined, { query: { queryKey: getListLearningItemsQueryKey() } });
  const create = useCreateLearningItem(); const update = useUpdateLearningItem(); const remove = useDeleteLearningItem();
  const [search, setSearch] = useState(''); const [kind, setKind] = useState(''); const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState<LearningItem | null>(null);
  const [draft, setDraft] = useState<LearningDraft>(blankLearning);
  const items = itemsQuery.data || [];
  const visible = items.filter(item => (!kind || item.kind === kind) && (!status || item.status === status) &&
    `${item.title} ${item.source || ''} ${item.subject || ''} ${item.notes}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const open = (item?: LearningItem) => {
    setEditing(item || null);
    setDraft(item ? { kind: item.kind, title: item.title, source: item.source || '', subject: item.subject || '', url: item.url || '', notes: item.notes || '', status: item.status } : blankLearning());
    setFormOpen(true);
  };
  const sync = () => { cache.invalidateQueries({ queryKey: getListLearningItemsQueryKey() }); cache.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload: LearningItemInput = { kind: draft.kind, title: draft.title.trim(), source: draft.source.trim() || undefined, subject: draft.subject.trim() || undefined, url: draft.url.trim() || undefined, notes: draft.notes.trim(), status: draft.status };
    const done = () => { sync(); setFormOpen(false); };
    if (editing) update.mutate({ id: editing.id, data: payload as LearningItemUpdate }, { onSuccess: done });
    else create.mutate({ data: payload }, { onSuccess: done });
  };
  const deleteItem = (item: LearningItem) => {
    if (window.confirm(`هل تريد حذف «${item.title}»؟`)) remove.mutate({ id: item.id }, { onSuccess: sync });
  };
  return <div className="page-wrap">
    <PageTitle kicker="مساحة تعلّمك" title="ما الذي تتعلّمه الآن؟" detail="اجمع دوراتك وملاحظات محاضراتك في مكان واحد، وارجع إليها وقتما تحتاج." action={<button className="button button-primary" onClick={() => open()} data-testid="button-add-learning"><Plus size={17}/> أضف مادة تعلّم</button>}/>
    <section className="learning-intro"><div><span className="section-kicker">كل معرفة لها مكان</span><h2>خطوات صغيرة،<br/><em>ومعرفة تبقى معك.</em></h2><p>دوّن ما تتابعه وما تريد العودة إليه. لا يلزم أن تنهي كل شيء اليوم.</p></div><div className="learning-stamp"><BookMarked size={29}/><b>{items.length.toLocaleString('ar')}</b><span>عنصر في مكتبتك</span></div></section>
      <section className="resource-directory" aria-labelledby="athar-learning-heading" data-testid="section-athar-learning">
        <div className="resource-heading"><div><span className="section-kicker">مساحات تعلّمك في أثر</span><h2 id="athar-learning-heading">تعلّم من داخل مساحتك</h2><p>ابدأ مذاكرة مادة، أو خض تجربتك الأولى في اللغة الإنجليزية.</p></div></div>
        <div className="resource-grid">
          <Link className="resource-card" href="/academy" data-testid="link-study-section"><span className="resource-mark resource-teal" aria-hidden="true"><BookOpen size={20}/></span><span className="resource-copy"><b>المذاكرة</b><span>محاضرات وملفات واختباراتك في مكان واحد.</span><small>موادك محفوظة ضمن حسابك</small></span><ArrowLeft className="resource-external" size={16} aria-hidden="true"/></Link>
          <Link className="resource-card" href="/languages" data-testid="link-language-section"><span className="resource-mark resource-blue" aria-hidden="true"><GraduationCap size={20}/></span><span className="resource-copy"><b>تعلّم اللغات</b><span>ابدأ بتجربة قصيرة من دون إنشاء حساب.</span><small>الإنجليزية لمتحدثي العربية</small></span><ArrowLeft className="resource-external" size={16} aria-hidden="true"/></Link>
        </div>
      </section>
     <div className="personal-library-heading"><div><span className="section-kicker">مساحتك الخاصة</span><h2>دوراتي ومحاضراتي</h2><p>هذه المكتبة لك وحدك؛ احفظ ما تتابعه وملاحظاتك للعودة إليها.</p></div></div>
    <div className="learning-tools">
      <label className="search-box"><Search size={18}/><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالعنوان أو الموضوع…" aria-label="ابحث في التعلّم" data-testid="input-search-learning"/></label>
      <label className="filter-box"><Filter size={16}/><select value={kind} onChange={e => setKind(e.target.value)} aria-label="نوع عنصر التعلّم"><option value="">كل الأنواع</option><option value="course">دورة</option><option value="lecture">محاضرة وملاحظات</option></select></label>
      <label className="filter-box"><select value={status} onChange={e => setStatus(e.target.value)} aria-label="حالة التعلّم"><option value="">كل الحالات</option>{Object.entries(learningStatus).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    {itemsQuery.isLoading ? <LoadingPanel label="نرتّب مكتبتك"/> : itemsQuery.isError ? <ErrorPanel retry={() => itemsQuery.refetch()}/> : visible.length ? <div className="learning-grid">{visible.map(item => <article className="learning-card" key={item.id} data-testid={`card-learning-${item.id}`}><div className="learning-card-top"><span className={`learning-kind kind-${item.kind}`}>{item.kind === 'course' ? 'دورة' : 'محاضرة'}</span><span className={`learning-state state-${item.status}`}>{learningStatus[item.status]}</span></div><h3>{item.title}</h3><p>{[item.source, item.subject].filter(Boolean).join(' · ') || 'أضف مصدراً أو موضوعاً لتسهيل الرجوع إليها.'}</p>{item.notes && <blockquote>{item.notes}</blockquote>}<div className="learning-card-actions">{item.url && <a className="subtle-link" href={item.url} target="_blank" rel="noreferrer">فتح المصدر <ExternalLink size={14}/></a>}<button type="button" className="icon-button" onClick={() => open(item)} aria-label={`تعديل ${item.title}`} data-testid={`button-edit-learning-${item.id}`}><Pencil size={16}/></button><button type="button" className="icon-button danger-icon" onClick={() => deleteItem(item)} aria-label={`حذف ${item.title}`} data-testid={`button-delete-learning-${item.id}`}><Trash2 size={16}/></button></div></article>)}</div> : <EmptyState title={search || kind || status ? 'لا توجد نتائج مطابقة' : 'مكتبتك تبدأ بما تتعلّمه اليوم'} body={search || kind || status ? 'غيّر كلمات البحث أو عوامل التصفية.' : 'أضف دورة تحفظها أو محاضرة تريد الرجوع إلى ملاحظاتها.'} action={<button className="button button-primary button-compact" onClick={() => open()} data-testid="button-learning-empty">أضف أول عنصر <Plus size={15}/></button>}/>}
    {(create.isError || update.isError || remove.isError) && <p className="form-error" role="alert">تعذّر حفظ التغيير. حاول مرة أخرى.</p>}
    {formOpen && <div className="dialog-scrim" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setFormOpen(false); }}>
      <section className="achievement-dialog learning-dialog" role="dialog" aria-modal="true" aria-labelledby="learning-dialog-title" dir="rtl">
        <header className="dialog-header"><div><span className="page-kicker">{editing ? 'تحديث المكتبة' : 'إضافة إلى مكتبتك'}</span><h2 id="learning-dialog-title">{editing ? 'عدّل تفاصيل التعلّم' : 'ما الذي تريد حفظه؟'}</h2></div><button className="icon-button" type="button" aria-label="إغلاق" onClick={() => setFormOpen(false)}><X size={19}/></button></header>
        <form className="achievement-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">النوع<select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as LearningItem['kind'] })}><option value="course">دورة أو شهادة</option><option value="lecture">محاضرة وملاحظات</option></select></label>
            <label className="field">الحالة<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as LearningItem['status'] })}>{Object.entries(learningStatus).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          </div>
          <label className="field"><span>العنوان <RequiredMark/></span><input required minLength={2} maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="مثال: أساسيات تحليل البيانات"/></label>
          <div className="form-grid">
            <label className="field">المصدر<input maxLength={160} value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="الجهة أو المنصة"/></label>
            <label className="field">الموضوع<input maxLength={120} value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} placeholder="مثال: الإحصاء"/></label>
          </div>
          <label className="field">رابط المصدر<input type="url" maxLength={1000} value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://"/></label>
          <label className="field">ملاحظاتك<textarea rows={4} maxLength={5000} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="أفكار، أسئلة، أو نقاط تريد تذكّرها"/></label>
          {(create.isError || update.isError) && <p className="form-error" role="alert">لم يتم الحفظ. حاول مرة أخرى.</p>}
          <footer className="dialog-footer"><button className="button button-outline" type="button" onClick={() => setFormOpen(false)}>إلغاء</button><button className="button button-primary" type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'جارٍ الحفظ…' : 'حفظ في مكتبتي'}</button></footer>
        </form>
      </section>
    </div>}
  </div>;
}

const lessons = [
  { id: 'truthful-star', number: '٠١', title: 'احكِ تجربة حقيقية بطريقة STAR', time: '٤ دقائق', intro: 'قصة المقابلة الجيدة لا تحتاج مبالغة؛ تحتاج ترتيباً يجعل مساهمتك واضحة.', steps: ['الموقف: أين ومتى حدثت التجربة؟', 'المهمة: ما المسؤولية أو التحدي الذي واجهته؟', 'الفعل: ماذا فعلت أنت تحديداً؟', 'النتيجة: ماذا تغيّر أو ماذا تعلّمت؟'], question: 'في قصة STAR، أي جزء يوضح ما قمت به أنت بنفسك؟', answers: ['الموقف', 'الفعل', 'النتيجة'], correct: 1 },
  { id: 'project-to-bullet', number: '٠٢', title: 'حوّل مشروعاً إلى سطر في سيرتك', time: '٣ دقائق', intro: 'السطر القوي يبدأ بفعل محدد، ويذكر ما صنعته والنتيجة دون ادعاء.', steps: ['ابدأ بفعل دقيق مثل حلّلت أو نظّمت.', 'اذكر نطاق المشروع أو من استفاد منه.', 'أضف نتيجة حقيقية أو مخرجاً واضحاً.', 'راجع السطر: هل تستطيع شرح كل كلمة؟'], question: 'ما الأفضل في سطر السيرة؟', answers: ['عبارة عامة عن الشغف', 'فعل محدد ومساهمة ونتيجة حقيقية', 'قائمة طويلة من الصفات'], correct: 1 },
  { id: 'one-minute-intro', number: '٠٣', title: 'عرّف بنفسك في دقيقة واحدة', time: '٥ دقائق', intro: 'مقدمة قصيرة وواضحة تربط بين دراستك واهتمامك ومثال عملي واتجاهك القادم.', steps: ['ابدأ باسمك وتخصصك أو مرحلتك الدراسية.', 'اذكر مجالاً تهتم به ولماذا.', 'شارك مثالاً واحداً من تجربة أو تعلّم.', 'اختم بما تبحث عنه أو ترغب في تطويره.'], question: 'ما الذي يجعل المقدمة مميزة؟', answers: ['تعداد كل إنجازاتك بسرعة', 'ربط اهتمامك بمثال حقيقي وخطوتك القادمة', 'استخدام مصطلحات معقدة'], correct: 1 },
];

function AcademyPage() {
  const cache = useQueryClient();
  const progressQuery = useGetAcademyProgress({ query: { queryKey: getGetAcademyProgressQueryKey() } });
  const save = useSaveAcademyProgress();
  const [active, setActive] = useState<string | null>(null); const [answer, setAnswer] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const progress = progressQuery.data || [];
  const recordProgress = (id: string, completed: boolean, quizScore: number | null) => save.mutate({ lessonId: id, data: { completed, quizScore } }, { onSuccess: () => { cache.invalidateQueries({ queryKey: getGetAcademyProgressQueryKey() }); cache.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); setNotice('حُفظ تقدّمك في المذاكرة.'); } });
  const lesson = lessons.find(item => item.id === active);
  const saved = lesson ? progress.find(item => item.lessonId === lesson.id) : undefined;
  const submitQuiz = () => {
    if (!lesson || answer === null) return;
    const score = answer === lesson.correct ? 100 : 0;
    recordProgress(lesson.id, score >= 70, score);
  };
  if (progressQuery.isLoading) return <LoadingPanel label="نجهّز دروسك القصيرة"/>;
  if (progressQuery.isError) return <ErrorPanel retry={() => progressQuery.refetch()}/>;
  return <div className="page-wrap"><PageTitle kicker="تعلّم بالممارسة" title="المذاكرة في أثر" detail="دروس قصيرة تساعدك على تقديم تجاربك بصدق ووضوح."/>
    <section className="academy-banner"><div><span className="section-kicker">مهارة اليوم</span><h2>تعلّمها الآن،<br/><em>واستخدمها حين تحتاجها.</em></h2><p>كل درس ينتهي بسؤال صغير. اجتز الاختبار عند ٧٠٪ أو أكثر ليُحتسب تقدّمك.</p></div><div className="academy-emblem"><GraduationCap size={38}/><span>تعلّم<br/>ثم جرّب</span></div></section>
    {notice && <p className="success-note" role="status"><Check size={15}/>{notice}</p>}
    <div className="lesson-list">{lessons.map(item => { const savedItem = progress.find(p => p.lessonId === item.id); return <article className={`lesson-card ${active === item.id ? 'lesson-active' : ''}`} key={item.id}><div className="lesson-index">{item.number}</div><div className="lesson-copy"><div className="lesson-meta"><span>{item.time}</span>{savedItem?.completed && <span className="lesson-done"><CheckCircle2 size={14}/> مكتمل · {savedItem.quizScore}%</span>}{savedItem && !savedItem.completed && savedItem.quizScore !== null && <span className="lesson-retry">نتيجتك {savedItem.quizScore}% · حاول مجدداً</span>}</div><h3>{item.title}</h3><p>{item.intro}</p></div><button className="button button-outline button-compact" type="button" onClick={() => { setActive(active === item.id ? null : item.id); setAnswer(null); setNotice(''); }} data-testid={`button-open-lesson-${item.id}`}>{active === item.id ? 'إغلاق الدرس' : <><Play size={14}/> ابدأ الدرس</>}</button></article>; })}</div>
    {lesson && <section className="lesson-detail panel" aria-labelledby="active-lesson-title"><div className="panel-header"><div><span className="section-kicker">درس تطبيقي</span><h2 id="active-lesson-title">{lesson.title}</h2></div><span className="lesson-detail-number">{lesson.number}</span></div><p className="lesson-intro">{lesson.intro}</p><ol className="lesson-steps">{lesson.steps.map(step => <li key={step}>{step}</li>)}</ol><div className="quiz-box"><span className="section-kicker">اختبر فهمك</span><h3>{lesson.question}</h3><div className="quiz-options">{lesson.answers.map((choice, index) => <label className={`quiz-option ${answer === index ? 'quiz-selected' : ''}`} key={choice}><input type="radio" name={`quiz-${lesson.id}`} checked={answer === index} onChange={() => setAnswer(index)}/><span>{choice}</span></label>)}</div>{saved?.completed && <p className="success-note"><Check size={15}/> اجتزت هذا الاختبار مسبقاً بنتيجة {saved.quizScore}%.</p>}{save.isError && <p className="form-error" role="alert">تعذّر حفظ نتيجتك. حاول مرة أخرى.</p>}<button className="button button-primary" type="button" disabled={answer === null || save.isPending} onClick={submitQuiz} data-testid="button-submit-lesson-quiz">{save.isPending ? 'جارٍ حفظ النتيجة…' : 'تحقق من إجابتي'}</button></div></section>}
  </div>;
}

type ChatMessage = { role: 'user' | 'assistant'; text: string; answers?: string[]; comparisonMode?: boolean };
function AssistantPage() {
  const ask = useAskCareerAssistant();
  const compare = useCompareCareerAssistant();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [comparisonMode, setComparisonMode] = useState(false);
  const pending = ask.isPending || compare.isPending;
  const runQuestion = (text: string, appendUser = true, compareAnswers = comparisonMode) => {
    if (appendUser) setMessages(old => [...old, { role: 'user', text, comparisonMode: compareAnswers }]);
    if (compareAnswers) {
      compare.mutate({ data: { message: text } }, {
        onSuccess: result => setMessages(old => [...old, { role: 'assistant', text: '', answers: result.answers }]),
      });
    } else {
      ask.mutate({ data: { message: text } }, {
        onSuccess: result => setMessages(old => [...old, { role: 'assistant', text: result.reply }]),
      });
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault(); const text = message.trim(); if (text.length < 2 || pending) return;
    setMessage('');
    runQuestion(text);
  };
  return <div className="page-wrap"><PageTitle kicker="مساحة للتفكير بصوت عالٍ" title="مساعدك الدراسي والمهني" detail="اسأل عن خطوة قادمة، أو كيف تروي تجربة، أو ما الذي تتعلّمه بعد ذلك."/>
    <div className="assistant-layout"><section className="assistant-main"><div className="assistant-heading"><span className="assistant-symbol"><MessageCircle size={20}/></span><div><b>محادثة أثر</b><small>{comparisonMode ? 'إجابتان مستقلتان للمقارنة' : 'إجابة تستند إلى معلوماتك المحفوظة'}</small></div><span className="session-badge">جلسة مؤقتة</span></div>
      <div className="assistant-mode-switch" role="group" aria-label="طريقة عرض الإجابة"><button type="button" className={!comparisonMode ? 'active' : ''} onClick={() => setComparisonMode(false)}>إجابة واحدة</button><button type="button" className={comparisonMode ? 'active' : ''} onClick={() => setComparisonMode(true)}>مقارنة إجابتين</button></div>
      {comparisonMode && <p className="assistant-compare-note"><CircleHelp size={14}/> يُرسل سؤالك وحده لإنتاج إجابتين، ولا تُرسل بيانات ملفك. المقارنة تستهلك رصيد استخدام أكثر.</p>}
      <div className="chat-window" aria-live="polite">{messages.length === 0 ? <div className="assistant-empty"><span className="assistant-orbit"><Lightbulb size={25}/></span><h2>من أين تحب أن تبدأ؟</h2><p>{comparisonMode ? 'اكتب سؤالك، وستحصل على إجابتين مستقلتين من دون إرسال معلومات ملفك.' : 'اكتب سؤالك، وسنربطه بتجاربك وأهدافك المحفوظة.'}</p><div className="prompt-chips">{['كيف أعرّف بنفسي في مقابلة؟', 'ما المهارة التي أركز عليها الآن؟', 'ساعدني في وصف أحد إنجازاتي'].map(prompt => <button type="button" key={prompt} onClick={() => setMessage(prompt)}>{prompt}</button>)}</div></div> : messages.map((item, index) => <div key={`${index}-${item.role}`} className={`chat-message ${item.role === 'user' ? 'chat-user' : 'chat-assistant'}`}><span>{item.role === 'user' ? 'أنت' : 'أثر'}</span>{item.answers ? <div className="assistant-answer-pair">{item.answers.map((answer, answerIndex) => <article key={answerIndex}><b>الإجابة {answerIndex + 1}</b><p>{answer}</p></article>)}</div> : <p>{item.text}</p>}</div>)}{pending && <div className="chat-message chat-assistant" role="status"><span>أثر</span><p className="typing-dots">نرتّب إجابة تناسبك…</p></div>}</div>
      {(ask.isError || compare.isError) && <div className="assistant-error" role="alert"><span>تعذّر إرسال سؤالك.</span><button type="button" onClick={() => { const last = [...messages].reverse().find(item => item.role === 'user'); if (last) runQuestion(last.text, false, last.comparisonMode ?? false); }}>أعد المحاولة</button></div>}
      <form className="assistant-form" onSubmit={submit}><label className="sr-only" htmlFor="assistant-message">اكتب سؤالك</label><textarea id="assistant-message" rows={2} maxLength={2000} value={message} onChange={e => setMessage(e.target.value)} placeholder="مثال: كيف أحوّل مشروعي الجامعي إلى قصة واضحة؟" data-testid="input-assistant-message"/><button type="submit" className="button button-primary" disabled={message.trim().length < 2 || pending} aria-label="إرسال السؤال" data-testid="button-send-assistant">{pending ? <LoaderCircle size={18} className="spin"/> : <Send size={17}/>}<span>إرسال</span></button></form>
      <p className="session-note"><CircleHelp size={14}/> المحادثة مؤقتة لهذه الجلسة فقط، ولا تُحفظ في سجلّك.</p>
    </section><aside className="assistant-aside"><span className="section-kicker">أسئلة تساعدك على البدء</span><h3>اسأل سؤالاً محدداً، وخذ إجابة قابلة للتطبيق.</h3><div className="assistant-tip"><NotebookPen size={18}/><p>شارك سياقاً بسيطاً عن هدفك أو التحدي الذي تواجهه.</p></div><div className="assistant-tip"><Target size={18}/><p>اطلب خطوة واحدة تستطيع تنفيذها هذا الأسبوع.</p></div><Link href="/achievements" className="subtle-link">أضف تجربة إلى ملفك <ArrowLeft size={14}/></Link></aside></div>
  </div>;
}

function NotFound() {
  return <div className="not-found" dir="rtl"><Brand/><span className="section-kicker">الصفحة غير موجودة</span><h1>يبدو أن هذا الطريق لا يقود إلى أثر.</h1><Link href="/" className="button button-primary" data-testid="link-not-found-home">العودة إلى البداية <ArrowLeft size={17}/></Link></div>;
}

function GuestLanguageRoute() {
  const platform = useGetPlatformContent({ query: { queryKey: getGetPlatformContentQueryKey() } });
  if (platform.isLoading) return <LoadingPanel label="جارٍ التحقق من إتاحة القسم"/>;
  if (platform.isError) return <ErrorPanel retry={() => platform.refetch()} title="تعذّر التحقق من إتاحة القسم"/>;
  if (!platform.data?.enabledModules.includes('languages')) return <main className="page-wrap" dir="rtl">
    <div className="state-panel" role="status"><h2>قسم اللغات غير متاح حاليًا</h2><p>تُحدّث إدارة أثر الأقسام من وقت لآخر.</p><Link href="/about" className="button button-primary">العودة إلى أثر</Link></div>
  </main>;
  return <GuestLanguageDemoPage/>;
}

function AuthRouter() {
  const [, setLocation] = useLocation();
  const { resolvedTheme } = useTheme();
  const platform = useGetPlatformContent({ query: { queryKey: getGetPlatformContentQueryKey() } });
  const appearanceSettings = platform.data?.appearance ?? DEFAULT_APPEARANCE;
  const appearance = useMemo(() => ({
    ...clerkAppearance,
    variables: resolvedTheme === 'dark' ? {
      ...clerkAppearance.variables,
      colorPrimary: getAppearancePrimary(appearanceSettings, true), colorForeground: '#F1F5F9', colorMutedForeground: '#CBD5E1',
      colorDanger: '#F87171', colorBackground: '#172033', colorInput: '#0F172A',
      colorInputForeground: '#F1F5F9', colorNeutral: '#334155',
    } : { ...clerkAppearance.variables, colorPrimary: appearanceSettings.primaryColor },
  }), [resolvedTheme, appearanceSettings]);
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{
      ...arSA,
      formFieldInputPlaceholder__emailAddress: 'اكتب بريدك الإلكتروني',
      formFieldInputPlaceholder__password: 'اكتب كلمة المرور',
      formFieldInputPlaceholder__signUpPassword: 'أنشئ كلمة مرور',
      formFieldInputPlaceholder__firstName: 'الاسم الأول',
      formFieldInputPlaceholder__lastName: 'اسم العائلة',
      signIn: {
        ...(arSA.signIn ?? {}),
        start: { ...(arSA.signIn?.start ?? {}), title: 'مرحباً بعودتك', subtitle: 'سجّل الدخول لتكمل بناء أثرك.' },
      },
      signUp: {
        ...(arSA.signUp ?? {}),
        start: { ...(arSA.signUp?.start ?? {}), title: 'ابدأ رحلتك مع أثر', subtitle: 'مساحتك المهنية تبدأ بتجربة حقيقية.' },
      },
    }}
    routerPush={to => setLocation(stripBase(to))}
    routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <ClerkCacheReset/><Suspense fallback={<div className="auth-loading" role="status">جارٍ تحميل الصفحة…</div>}><Switch>
      <Route path="/" component={HomeRedirect}/>
      <Route path="/about" component={Home}/>
      <Route path="/privacy" component={PrivacyPage}/>
      <Route path="/languages" component={GuestLanguageRoute}/>
      <Route path="/sign-in/*?" component={SignInPage}/>
      <Route path="/sign-up/*?" component={SignUpPage}/>
      <Route path="/portfolio/:token"><PublicResumePage/></Route>
      <Route path="/dashboard"><Protected><DashboardPage/></Protected></Route>
      <Route path="/achievements"><Protected><AchievementsPage/></Protected></Route>
      <Route path="/learning"><Protected><LearningPage/></Protected></Route>
      <Route path="/graduates"><Protected><GraduatesPage/></Protected></Route>
      <Route path="/demo-data"><Protected><DemoDataPage/></Protected></Route>
      <Route path="/languages/study"><Protected><LanguageStudyPage/></Protected></Route>
      <Route path="/sections/:slug">{params => <Protected><CustomSectionPage slug={params.slug}/></Protected>}</Route>
      <Route path="/academy/subjects/:subjectId"><Protected><AcademySubjectPage/></Protected></Route>
      <Route path="/academy/lessons/:lessonId"><Protected><AcademyLessonPage/></Protected></Route>
      <Route path="/academy/attempts/:attemptId"><Protected><AcademyAttemptPage/></Protected></Route>
      <Route path="/academy/search"><Protected><AcademySearchPage/></Protected></Route>
      <Route path="/academy/assistant"><Protected><AcademyAssistantPage/></Protected></Route>
      <Route path="/academy/files"><Protected><AcademyFilesPage/></Protected></Route>
      <Route path="/academy"><Protected><AcademyHomePage/></Protected></Route>
      <Route path="/roadmap"><Protected><RoadmapPage/></Protected></Route>
      <Route path="/resume"><Protected><ResumePage/></Protected></Route>
      <Route path="/resume-templates"><Protected><ResumeTemplatesPage/></Protected></Route>
      <Route path="/office"><Protected><OfficeToolsPage/></Protected></Route>
      <Route path="/assistant"><Protected><AssistantPage/></Protected></Route>
      <Route path="/profile"><Protected><ProfilePage/></Protected></Route>
      <Route path="/admin"><Protected admin><AdminPage/></Protected></Route>
      <Route component={NotFound}/>
    </Switch></Suspense>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <QueryClientProvider client={queryClient}>
    <PlatformThemeSync/>
    <WouterRouter base={basePath}><BrowserBackGuard/><AuthRouter/></WouterRouter>
  </QueryClientProvider>;
}

function PlatformThemeSync() {
  const platform = useGetPlatformContent({ query: { queryKey: getGetPlatformContentQueryKey(), staleTime: 30_000 } });
  useEffect(() => { applyPlatformAppearance(platform.data?.appearance ?? DEFAULT_APPEARANCE); }, [platform.data?.appearance]);
  return null;
}

export default App;
