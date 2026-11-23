// Side-view stick figure, animated between two poses with SVG <animate> (works in Safari).
import type { StickFigure as Fig, StickPose } from '../engine/types';

const L = { torso: 26, neck: 4, head: 6, upperArm: 14, forearm: 13, thigh: 19, shin: 19 };
const DUR = '3s';

type Pt = [number, number];
const step = (p: Pt, deg: number, len: number): Pt => {
  const r = (deg * Math.PI) / 180;
  return [p[0] + Math.sin(r) * len, p[1] + Math.cos(r) * len];
};

function joints(p: StickPose) {
  const hip: Pt = [p.hipX * 100, p.hipY * 100];
  const shoulder = step(hip, p.torso, L.torso);
  const head = step(shoulder, p.head ?? p.torso, L.neck + L.head);
  const elbow = step(shoulder, p.upperArm, L.upperArm);
  const wrist = step(elbow, p.forearm, L.forearm);
  const elbow2 = step(shoulder, p.upperArm2 ?? p.upperArm, L.upperArm);
  const wrist2 = step(elbow2, p.forearm2 ?? p.forearm, L.forearm);
  const knee = step(hip, p.thigh, L.thigh);
  const ankle = step(knee, p.shin, L.shin);
  const knee2 = step(hip, p.thigh2 ?? p.thigh, L.thigh);
  const ankle2 = step(knee2, p.shin2 ?? p.shin, L.shin);
  return { hip, shoulder, head, elbow, wrist, elbow2, wrist2, knee, ankle, knee2, ankle2 };
}

const f = (n: number) => n.toFixed(1);

function Seg({ a1, b1, a2, b2, cls, animate }: { a1: Pt; b1: Pt; a2: Pt; b2: Pt; cls: string; animate: boolean }) {
  return (
    <line className={cls} x1={f(a1[0])} y1={f(a1[1])} x2={f(b1[0])} y2={f(b1[1])}>
      {animate &&
        (['x1', 'y1', 'x2', 'y2'] as const).map((attr, i) => {
          const v1 = [a1[0], a1[1], b1[0], b1[1]][i];
          const v2 = [a2[0], a2[1], b2[0], b2[1]][i];
          return (
            <animate
              key={attr}
              attributeName={attr}
              values={`${f(v1)};${f(v2)};${f(v1)}`}
              dur={DUR}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            />
          );
        })}
    </line>
  );
}

function Figure({ fig, animate, single }: { fig: Fig; animate: boolean; single?: 'start' | 'end' }) {
  const a = joints(single === 'end' ? fig.end : fig.start);
  const b = joints(single === 'start' ? fig.start : fig.end);
  const segs: [keyof typeof a, keyof typeof a, string][] = [
    ['hip', 'knee2', 'limb back'],
    ['knee2', 'ankle2', 'limb back'],
    ['shoulder', 'elbow2', 'limb back'],
    ['elbow2', 'wrist2', 'limb back'],
    ['hip', 'shoulder', 'limb'],
    ['hip', 'knee', 'limb'],
    ['knee', 'ankle', 'limb'],
    ['shoulder', 'elbow', 'limb'],
    ['elbow', 'wrist', 'limb'],
  ];
  const props = fig.props ?? [];
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Movement demo" style={{ width: '100%', height: '100%' }}>
      <style>{`.limb{stroke:var(--text);stroke-width:4.5;stroke-linecap:round}.back{opacity:.4}.prop{stroke:var(--accent-text);stroke-width:4;stroke-linecap:round;fill:none}.propf{fill:var(--accent-text)}`}</style>
      {props.includes('floor') && <line x1="4" y1="95" x2="96" y2="95" stroke="var(--line)" strokeWidth="2" />}
      {props.includes('bench') && <rect x="6" y="64" width="22" height="7" rx="2" className="propf" opacity="0.8" />}
      {props.includes('bar-overhead') && <line className="prop" x1="20" y1="8" x2="80" y2="8" />}
      {segs.map(([p, q, cls]) => (
        <Seg key={p + q} a1={a[p]} b1={a[q]} a2={b[p]} b2={b[q]} cls={cls} animate={animate} />
      ))}
      <circle r={L.head} fill="var(--text)" cx={f(a.head[0])} cy={f(a.head[1])}>
        {animate && (
          <>
            <animate attributeName="cx" values={`${f(a.head[0])};${f(b.head[0])};${f(a.head[0])}`} dur={DUR} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${f(a.head[1])};${f(b.head[1])};${f(a.head[1])}`} dur={DUR} repeatCount="indefinite" />
          </>
        )}
      </circle>
      {props.includes('dumbbell') && (
        <rect width="9" height="5" rx="1.5" className="propf" x={f(a.wrist[0] - 4.5)} y={f(a.wrist[1] - 1)}>
          {animate && (
            <>
              <animate attributeName="x" values={`${f(a.wrist[0] - 4.5)};${f(b.wrist[0] - 4.5)};${f(a.wrist[0] - 4.5)}`} dur={DUR} repeatCount="indefinite" />
              <animate attributeName="y" values={`${f(a.wrist[1] - 1)};${f(b.wrist[1] - 1)};${f(a.wrist[1] - 1)}`} dur={DUR} repeatCount="indefinite" />
            </>
          )}
        </rect>
      )}
    </svg>
  );
}

export function StickFigure({ fig, reduced }: { fig: Fig; reduced: boolean }) {
  if (reduced)
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
        <Figure fig={fig} animate={false} single="start" />
        <Figure fig={fig} animate={false} single="end" />
      </div>
    );
  return <Figure fig={fig} animate />;
}
