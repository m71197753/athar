const base = import.meta.env.BASE_URL;
export default function Slide11Admin() {
  return <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck-frame">
    <div className="content-head"><h1 className="slide-title">إدارة تدعم تجربة آمنة ومنظمة</h1></div>
    <div className="admin-points">
      <p className="admin-point">تضبط الإدارة الأقسام والمحتوى ومسارات التعلّم</p>
      <p className="admin-point">تراجع أدلة الإنجاز ضمن صلاحيات محددة</p>
      <p className="admin-point">تسجّل عمليات المراجعة مع حماية تفاصيل الملفات</p>
    </div>
    <img src={base + "ai-admin.png"} crossOrigin="anonymous" className="admin-art" alt="لوحة إدارة لمراجعة المحتوى والأدلة بصلاحيات واضحة" />
  </div>;
}