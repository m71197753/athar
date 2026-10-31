import { IMG } from '../data';
import { Figure, Frame, Line, Rule, Title } from '../Kit';

export function Problem() {
  return (
    <Frame num="٠٢" section="المشكلة">
      <div style={{ position: 'absolute', right: '7%', top: '21%', width: '50%' }}>
        <Title text="المشكلة: رحلة الطالب متفرقة" />
        <Rule />
        {['التعلّم والإنجازات والسيرة موزعة بين أدوات مختلفة', 'صعب متابعة التقدم وتحويل الخبرات إلى قصة مهنية واضحة', 'ملفات الطالب وأدلته تحتاج تنظيمًا وخصوصية'].map((t, i) =>
          <Line key={i} n={i} delay={1.3 + i * 1.1}>{t}</Line>)}
      </div>
      <Figure src={IMG('ai-problem.png')} style={{ left: '7%', top: '20%', width: '33%', height: '60%' }} />
    </Frame>
  );
}
