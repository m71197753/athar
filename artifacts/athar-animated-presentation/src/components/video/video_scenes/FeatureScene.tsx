import { FEATURES, IMG } from '../data';
import { Figure, Frame, Line, Rule, Title } from '../Kit';

export function FeatureScene({ id }: { id: string }) {
  const f = FEATURES[id];
  const dark = f.field === 'ink';
  return (
    <Frame num={f.tag} section="مزايا المنصة" dark={dark}>
      <Figure src={IMG(f.img)} style={{ left: '7%', top: '20%', width: '36%', height: '60%' }} />
      <div style={{ position: 'absolute', right: '7%', top: '21%', width: '47%' }}>
        <Title text={f.title} color={dark ? '#f6f3ec' : undefined} />
        <Rule />
        {f.lines.map((t, i) => <Line key={i} n={i} delay={1.2 + i * 0.8} color={dark ? '#f6f3ec' : undefined}>{t}</Line>)}
      </div>
    </Frame>
  );
}
