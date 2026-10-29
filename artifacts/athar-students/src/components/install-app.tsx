import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import './install-app.css';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(standalone.matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => { setInstalled(true); setPrompt(null); setOpen(false); };
    update();
    standalone.addEventListener('change', update);
    window.addEventListener('beforeinstallprompt', available);
    window.addEventListener('appinstalled', done);
    return () => {
      standalone.removeEventListener('change', update);
      window.removeEventListener('beforeinstallprompt', available);
      window.removeEventListener('appinstalled', done);
    };
  }, []);

  async function install() {
    if (!prompt) { setOpen(!open); return; }
    setBusy(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setNotice(outcome === 'accepted' ? 'تم قبول التثبيت. تابع الخطوات التي يعرضها المتصفح.' : 'يمكنك التثبيت لاحقًا من قائمة المتصفح.');
      setOpen(true);
    } catch {
      setNotice('لم يكتمل طلب التثبيت. استخدم قائمة المتصفح كما هو موضّح أدناه.');
      setOpen(true);
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }

  if (installed) return null;
  return <div className="install-app" dir="rtl">
    <button type="button" className="theme-toggle" onClick={install} disabled={busy}
      aria-label="تثبيت أثر على جهازك" title="تثبيت أثر على جهازك"
      aria-expanded={open} data-testid="button-install-app"><Download size={18}/></button>
    {open && <section className="install-help" aria-label="تثبيت أثر">
      <button className="install-close" type="button" onClick={() => setOpen(false)} aria-label="إغلاق تعليمات التثبيت"><X size={18}/></button>
      <h3>أثر على شاشتك الرئيسية</h3>
      {notice && <p role="status">{notice}</p>}
      <p><strong>أندرويد — Chrome:</strong> افتح قائمة ⋮ ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</p>
      <p><strong>آيفون — Safari:</strong> اضغط «مشاركة» ثم «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</p>
      <p>افتح رابط التطبيق المنشور مباشرةً في المتصفح، وليس داخل نافذة المعاينة. يحتاج عرض بياناتك وحفظها إلى الإنترنت.</p>
    </section>}
  </div>;
}
