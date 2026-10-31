import { IMG } from '../data';
import { Figure, Frame, Line, Rule, Title } from '../Kit';

export function Solution() {
  return (
    <Frame num="٠٣" section="الحل" dark>
      <Figure src={IMG('ai-solution.png')} style={{ left: '7%', top: '20%', width: '36%', height: '60%' }} />
      <div style={{ position: 'absolute', right: '7%', top: '21%', width: '47%' }}>
        <Title text="الحل: مساحة واحدة باسم أثر" color="#f6f3ec" />
        <Rule />
        {['يجمع أثر التعلّم والإنجازات والسيرة والخطة المهنية', 'يساعد الطالب على توثيق تقدّمه في مكان واحد', 'يربط التعلّم بخطوات مهنية قابلة للمتابعة'].map((t, i) =>
          <Line key={i} n={i} delay={1.1 + i * 0.75} color="#f6f3ec">{t}</Line>)}
      </div>
    </Frame>
  );
}
