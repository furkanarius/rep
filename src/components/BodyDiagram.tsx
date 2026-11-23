// Front and back silhouettes with named muscle regions. Primary = accent, secondary = lighter.
import type { Muscle } from '../engine/types';

type Shape = { m: Muscle; d?: string; e?: [number, number, number, number]; r?: [number, number, number, number, number] };

const mirror = (e: [number, number, number, number]): [number, number, number, number] => [120 - e[0], e[1], e[2], e[3]];
const pair = (m: Muscle, e: [number, number, number, number]): Shape[] => [
  { m, e },
  { m, e: mirror(e) },
];

const FRONT: Shape[] = [
  { m: 'upper-back', d: 'M48 41 L72 41 L84 50 L36 50 Z' },
  ...pair('side-delts', [27, 60, 5, 10]),
  ...pair('front-delts', [35, 57, 8, 9]),
  { m: 'chest', r: [40, 50, 19, 25, 6] },
  { m: 'chest', r: [61, 50, 19, 25, 6] },
  ...pair('biceps', [29, 84, 6.5, 13]),
  ...pair('forearms', [25, 113, 5.5, 15]),
  ...pair('obliques', [42, 100, 5.5, 17]),
  { m: 'abs', r: [49, 79, 22, 44, 6] },
  ...pair('quads', [49, 163, 10, 28]),
  ...pair('adductors', [56.5, 148, 3.5, 15]),
  ...pair('calves', [48.5, 214, 6, 18]),
];
const BACK: Shape[] = [
  { m: 'upper-back', d: 'M60 38 L80 50 L72 80 L60 88 L48 80 L40 50 Z' },
  ...pair('side-delts', [27, 60, 5, 10]),
  ...pair('rear-delts', [35, 57, 8, 9]),
  { m: 'lats', d: 'M41 60 L48 82 L56 104 L45 102 L39 80 Z' },
  { m: 'lats', d: 'M79 60 L72 82 L64 104 L75 102 L81 80 Z' },
  ...pair('triceps', [29, 84, 6.5, 13]),
  ...pair('forearms', [25, 113, 5.5, 15]),
  { m: 'lower-back', r: [51, 92, 18, 26, 5] },
  ...pair('glutes', [50, 134, 10.5, 12]),
  ...pair('hamstrings', [49, 168, 9.5, 24]),
  ...pair('calves', [49, 212, 7, 18]),
];

function Body({ shapes, label, primary, secondary }: { shapes: Shape[]; label: string; primary: Set<Muscle>; secondary: Set<Muscle> }) {
  const cls = (m: Muscle) => `m ${primary.has(m) ? 'p' : secondary.has(m) ? 's' : ''}`;
  return (
    <svg viewBox="0 0 120 240" role="img" aria-label={label}>
      {/* skin: head, neck, hands, knees, feet */}
      <circle className="skin" cx="60" cy="20" r="13" />
      <rect className="skin" x="54" y="31" width="12" height="10" rx="3" />
      <ellipse className="skin" cx="22" cy="134" rx="5" ry="7" />
      <ellipse className="skin" cx="98" cy="134" rx="5" ry="7" />
      <ellipse className="skin" cx="49" cy="232" rx="7" ry="4" />
      <ellipse className="skin" cx="71" cy="232" rx="7" ry="4" />
      {shapes.map((s, i) => {
        if (s.d) return <path key={i} className={cls(s.m)} d={s.d} />;
        if (s.e) return <ellipse key={i} className={cls(s.m)} cx={s.e[0]} cy={s.e[1]} rx={s.e[2]} ry={s.e[3]} />;
        const r = s.r!;
        return <rect key={i} className={cls(s.m)} x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx={r[4]} />;
      })}
    </svg>
  );
}

export const MUSCLE_NAMES: Record<Muscle, string> = {
  chest: 'Chest',
  'front-delts': 'Front shoulders',
  'side-delts': 'Side shoulders',
  'rear-delts': 'Rear shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  lats: 'Lats',
  'upper-back': 'Upper back & traps',
  'lower-back': 'Lower back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Inner thighs',
  calves: 'Calves',
};

export function BodyDiagram({ primary, secondary }: { primary: Muscle[]; secondary: Muscle[] }) {
  const p = new Set(primary);
  const s = new Set(secondary);
  const names = (l: Muscle[]) => l.map((m) => MUSCLE_NAMES[m]).join(', ');
  return (
    <div>
      <div className="body-diagram">
        <Body shapes={FRONT} label="Front of body" primary={p} secondary={s} />
        <Body shapes={BACK} label="Back of body" primary={p} secondary={s} />
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span>
          <i style={{ background: 'var(--accent)' }} />
          Main: {names(primary)}
        </span>
      </div>
      {secondary.length > 0 && (
        <div className="legend" style={{ marginTop: 4 }}>
          <span>
            <i style={{ background: 'var(--muscle-secondary)' }} />
            Also: {names(secondary)}
          </span>
        </div>
      )}
    </div>
  );
}
