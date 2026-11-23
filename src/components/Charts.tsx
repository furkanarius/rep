// Tiny hand-rolled SVG charts (no chart library needed).
type Pt = { x: number; y: number; label?: string };

const W = 340;

export function LineChart({
  points,
  avg,
  height = 160,
  fmt = (v: number) => String(Math.round(v)),
  xfmt,
  label,
}: {
  points: Pt[];
  avg?: Pt[];
  height?: number;
  fmt?: (v: number) => string;
  xfmt?: (x: number) => string;
  label: string;
}) {
  if (!points.length) return null;
  const all = [...points, ...(avg ?? [])];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  let [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  if (y1 - y0 < 1e-6) {
    y0 -= 1;
    y1 += 1;
  }
  const pad = (y1 - y0) * 0.12;
  y0 -= pad;
  y1 += pad;
  const [x0, x1] = [Math.min(...xs), Math.max(...xs) === Math.min(...xs) ? Math.min(...xs) + 1 : Math.max(...xs)];
  const L = 40;
  const R = 8;
  const T = 10;
  const B = 22;
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (height - T - B);
  const path = (ps: Pt[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const ticks = [y0 + pad, (y0 + y1) / 2, y1 - pad];
  const last = points[points.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${label}. Latest: ${fmt(last.y)}.`} style={{ width: '100%', height: 'auto' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="grid" x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} strokeWidth="1" />
          <text x={L - 6} y={sy(t) + 4} textAnchor="end">
            {fmt(t)}
          </text>
        </g>
      ))}
      {xfmt && (
        <>
          <text x={sx(x0)} y={height - 4} textAnchor="start">
            {xfmt(x0)}
          </text>
          <text x={sx(x1)} y={height - 4} textAnchor="end">
            {xfmt(x1)}
          </text>
        </>
      )}
      {avg && avg.length > 1 && <path className="ln" d={path(avg)} />}
      <path className={avg ? 'ln2' : 'ln'} d={path(points)} />
      {!avg && points.map((p, i) => <circle key={i} className="pt" cx={sx(p.x)} cy={sy(p.y)} r="3.5" />)}
    </svg>
  );
}

export function BarChart({
  bars,
  target,
  height = 140,
  label,
}: {
  bars: { label: string; value: number }[];
  target?: number;
  height?: number;
  label: string;
}) {
  const max = Math.max(1, target ?? 0, ...bars.map((b) => b.value));
  const L = 24;
  const B = 20;
  const T = 8;
  const bw = (W - L) / bars.length;
  const sy = (v: number) => T + (1 - v / max) * (height - T - B);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${label}: ${bars.map((b) => `${b.label} ${b.value}`).join(', ')}`} style={{ width: '100%', height: 'auto' }}>
      {bars.map((b, i) => (
        <g key={i}>
          <rect
            className={`barr ${target !== undefined && b.value >= target ? 'met' : ''}`}
            x={L + i * bw + bw * 0.18}
            width={bw * 0.64}
            y={sy(b.value)}
            height={Math.max(0, height - B - sy(b.value))}
            rx="3"
          />
          <text x={L + i * bw + bw / 2} y={height - 5} textAnchor="middle">
            {b.label}
          </text>
        </g>
      ))}
      {target !== undefined && (
        <>
          <line x1={L} x2={W} y1={sy(target)} y2={sy(target)} stroke="var(--text)" strokeDasharray="4 4" strokeWidth="1.5" />
          <text x={L - 4} y={sy(target) + 4} textAnchor="end">
            {target}
          </text>
        </>
      )}
    </svg>
  );
}
