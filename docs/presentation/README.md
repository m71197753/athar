# عرض منصة أثر

## ملفات التسليم

| الصيغة | رابط التنزيل |
| --- | --- |
| PowerPoint | [Athar-Platform-Presentation.pptx](https://github.com/m71197753/athar/releases/download/athar-delivery-2026-11-01/Athar-Platform-Presentation.pptx) |
| PDF | [Athar-Platform-Presentation.pdf](https://github.com/m71197753/athar/releases/download/athar-delivery-2026-11-01/Athar-Platform-Presentation.pdf) |
| جميع المرفقات | [صفحة إصدار التسليم](https://github.com/m71197753/athar/releases/tag/athar-delivery-2026-11-01) |

ملفا التصدير مرفقان بالمستودع عبر GitHub Releases حتى لا يضاف ملف PowerPoint كبير إلى كل نسخة من سجل الكود.

## مصدر العرض

- المجلد: [`artifacts/athar-investor-presentation`](../../artifacts/athar-investor-presentation/).
- [قائمة الشرائح](../../artifacts/athar-investor-presentation/src/data/slides-manifest.json).
- [مكونات الشرائح](../../artifacts/athar-investor-presentation/src/pages/slides/).
- [ألوان وخطوط العرض](../../artifacts/athar-investor-presentation/src/index.css).
- [الصور](../../artifacts/athar-investor-presentation/public/).
- الشعارات اللازمة للبناء موجودة مع أصول المصدر؛ لا يلزم تنزيل مجلد المرفقات الخاص بمساحة العمل.

## المحتوى الحالي

تحتوي النسخة المصدرة على **11 شريحة** وفق القائمة الحالية:

1. الغلاف: أثر من التعلم إلى الإنجاز.
2. المشكلة: رحلة الطالب المتفرقة.
3. الحل: مساحة واحدة.
4. خطوات الحل داخل أثر.
5. الدورات والتعلم المنظم.
6. تعلم اللغات بالممارسة.
7. الإنجازات والخصوصية.
8. السيرة الذاتية.
9. الخطة المهنية.
10. الاستثمار في أثر.
11. الشكر والختام.

تستخدم الشرائح صورًا وأشكالًا مرتبطة بموضوع كل شريحة، مع خلفيات متغيرة وهوية لونية مشتركة. لا تتضمن أرقام أرباح أو بيانات سوق غير موثقة.

## تشغيل المصدر وفحصه

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/athar-investor-presentation run validate-slides

PORT=22567 BASE_PATH=/athar-investor-presentation/ \
  pnpm --filter @workspace/athar-investor-presentation run dev
```

للبناء:

```bash
PORT=22567 BASE_PATH=/athar-investor-presentation/ \
  pnpm --filter @workspace/athar-investor-presentation run build
```

أُنتجت ملفات التسليم من العرض الحالي. عند تعديل المصدر، لا تتغير الملفات المرفقة تلقائيًا؛ صدّر نسخة جديدة، وراجعها، وأرفقها بإصدار مناسب، وحدّث الروابط وبصمات الملفات.

## التحقق من سلامة التنزيل

تتوفر البصمات في [`SHA256SUMS`](SHA256SUMS). ضع الملف بجانب العرضين بعد تنزيلهما ثم شغّل:

```bash
sha256sum -c SHA256SUMS
```

## حقوق الشعارات والمواد

شعارات أثر وReplit وNordpoints مستخدمة ضمن العرض المقدم للمشروع، مع بقاء حقوق كل علامة لأصحابها. هذا لا يثبت شراكة أو اعتمادًا رسميًا من الجهات الظاهرة.
