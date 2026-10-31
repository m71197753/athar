const b = import.meta.env.BASE_URL + 'images/';
export const IMG = (n: string) => b + n;
export type Field = 'paper' | 'ink' | 'saffron' | 'sage' | 'coral';
export const FIELDS: Record<Field, { bg: string; fg: string; accent: string; sub: string }> = {
  paper: { bg: '#f3ecdf', fg: '#191c45', accent: '#e0603f', sub: '#4a4c6e' },
  ink: { bg: '#191c45', fg: '#f3ecdf', accent: '#e9a23b', sub: '#c9c3d8' },
  saffron: { bg: '#e9a23b', fg: '#191c45', accent: '#f3ecdf', sub: '#3a2f2a' },
  sage: { bg: '#2e7a70', fg: '#f3ecdf', accent: '#e9a23b', sub: '#d8e8e2' },
  coral: { bg: '#e0603f', fg: '#fbf4ea', accent: '#191c45', sub: '#fde3d6' },
};
export interface Feature { title: string; lines: string[]; img: string; field: Field; variant: 'right' | 'left' | 'full'; tag: string }
export const FEATURES: Record<string, Feature> = {
  courses: { tag: '٠٥', title: 'تعلّم منظّم ودورات تفاعلية', field: 'paper', variant: 'left', img: 'ai-courses.png',
    lines: ['قسّم المحتوى إلى دورات ووحدات ودروس', 'تابع الدروس المرئية وموضع تقدّمك', 'تدرب بالاختبارات والأنشطة، وراجع نتائجك'] },
  languages: { tag: '٠٦', title: 'تعلّم اللغات بالممارسة', field: 'ink', variant: 'right', img: 'ai-language.png',
    lines: ['تدرب على المفردات والاستماع والمحادثة', 'راجع ما تعلمته وتابع تقدمك', 'اجعل الممارسة جزءًا ثابتًا من رحلتك التعليمية'] },
  achievements: { tag: '٠٧', title: 'إنجازات موثّقة وخصوصية واضحة', field: 'paper', variant: 'full', img: 'ai-achievement.png',
    lines: ['سجّل إنجازك وأضف وصفًا أو رابطًا أو مرفقًا', 'احتفظ بأدلتك في مساحة مرتبطة بحسابك', 'يراجع الطالب والإدارة الأدلة؛ لا تظهر لبقية الطلاب'] },
  resume: { tag: '٠٨', title: 'سيرة ذاتية تناسب هدفك', field: 'paper', variant: 'right', img: 'ai-resume.png',
    lines: ['اختر قالبًا موجّهًا لـ ATS أو قالبًا مهنيًا', 'خصّص الخط والحجم والألوان من داخل السيرة', 'قارن مهاراتك بمتطلبات وظيفة مستهدفة', 'راجع المحتوى بنفسك؛ التوافق لا يضمن القبول'] },
  career: { tag: '٠٩', title: 'خطة مهنية بخطوات قابلة للتنفيذ', field: 'ink', variant: 'left', img: 'ai-career.png',
    lines: ['حدّد هدفك المهني والمدة المناسبة', 'حوّل الهدف إلى مهام ومتابعة أسبوعية', 'استخدم التذكيرات للعودة إلى خطتك', 'استكشف مساحة الخريجين والفرص المهنية'] },
  office: { tag: '١٠', title: 'مستندات وجداول داخل المنصة', field: 'paper', variant: 'full', img: 'ai-office.png',
    lines: ['أنشئ مستندات وجداول في مساحة الطالب', 'نسّق النصوص والعناوين والقوائم', 'استخدم صيغًا حسابية ومراجع خلايا أساسية', 'احفظ تلقائيًا وصدّر إلى DOCX أو XLSX'] },
  admin: { tag: '١١', title: 'إدارة تدعم تجربة آمنة ومنظمة', field: 'ink', variant: 'right', img: 'ai-admin.png',
    lines: ['تضبط الإدارة الأقسام والمحتوى ومسارات التعلّم', 'تراجع أدلة الإنجاز ضمن صلاحيات محددة', 'تسجّل عمليات المراجعة مع حماية تفاصيل الملفات'] },
};
