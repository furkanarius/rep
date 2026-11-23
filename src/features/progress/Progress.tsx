// Depth lives here: headline numbers, charts, strength standards, history, records.
import { useMemo, useState } from 'react';
import { useData } from '../../app/data';
import { streak } from '../../app/derive';
import { e1rmSeries, records, standardLevel, strengthChange, weeklySessions, weeklyVolume } from '../../engine/stats';
import { exerciseById, program, MAIN_LIFTS_ALL, templateById } from '../../engine/program';
import { measureOf } from '../../engine/progression';
import { BarChart, LineChart } from '../../components/Charts';
import { MUSCLE_NAMES } from '../../components/BodyDiagram';
import { Term } from '../../components/Term';
import { fmtWeight, fromKg, cmToLength } from '../../lib/units';
import { addDays, fmtDate, parseDay, toDay, weekStart } from '../../lib/dates';
import type { Muscle } from '../../engine/types';

export function Progress() {
  const d = useData();
  const ctx = { exercise: exerciseById, bodyWeightKg: d.bodyWeightKg };
  const [tab, setTab] = useState<'charts' | 'history' | 'records'>('charts');
  const monthStart = d.today.slice(0, 8) + '01';
  const thisMonth = d.done.filter((s) => toDay(s.startedAt) >= monthStart).length;
  const change = useMemo(() => strengthChange(MAIN_LIFTS_ALL, d.done, d.sets, ctx), [d.done, d.sets]); // eslint-disable-line react-hooks/exhaustive-deps
  const bwTrend = useMemo(() => {
    const w = d.body.filter((m) => m.weightKg);
    if (w.length < 2) return undefined;
    return (w[w.length - 1].weightKg as number) - (w[0].weightKg as number);
  }, [d.body]);

  return (
    <div className="page">
      <div className="kpis">
        <Kpi label="Sessions this month" value={String(thisMonth)} />
        <Kpi label="Week streak" value={String(streak(d))} sub="weeks with 2+ lifts" />
        <Kpi
          label="Strength since start"
          value={change === undefined ? '—' : `${change >= 0 ? '+' : ''}${Math.round(change * 100)}%`}
          sub={change === undefined ? 'after a few sessions' : 'avg est. max, main lifts'}
        />
        <Kpi
          label="Body weight"
          value={d.body.some((m) => m.weightKg) ? `${fmtWeight(d.bodyWeightKg, d.settings.bodyUnit)}` : '—'}
          sub={bwTrend === undefined ? d.settings.bodyUnit : `${bwTrend >= 0 ? '+' : ''}${fmtWeight(Math.abs(bwTrend), d.settings.bodyUnit)} ${d.settings.bodyUnit} since start`}
        />
      </div>

      <div className="seg" style={{ marginTop: 16, display: 'flex' }}>
        {(['charts', 'history', 'records'] as const).map((t) => (
          <button key={t} className="grow" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'charts' && <Charts />}
      {tab === 'history' && <History />}
      {tab === 'records' && <Records />}
    </div>
  );

  function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
      <div className="kpi">
        <div className="eyebrow">{label}</div>
        <div className="num">{value}</div>
        {sub && <div className="tiny muted">{sub}</div>}
      </div>
    );
  }
}

function Charts() {
  const d = useData();
  const unit = d.settings.loadUnit;
  const ctx = { exercise: exerciseById, bodyWeightKg: d.bodyWeightKg };
  const withData = [...d.exposures.keys()]
    .map((id) => exerciseById(id)!)
    .filter((e) => e && measureOf(e) !== 'seconds' && (d.exposures.get(e.id)?.length ?? 0) > 0)
    .sort((a, b) => Number(MAIN_LIFTS_ALL.includes(b.id)) - Number(MAIN_LIFTS_ALL.includes(a.id)) || a.name.localeCompare(b.name));
  const [exId, setExId] = useState(withData[0]?.id ?? '');
  const series = exId ? e1rmSeries(exId, d.done, d.sets, ctx) : [];
  const weeks = weeklySessions(d.done, d.today, 8);
  const [volWeek, setVolWeek] = useState(weekStart(d.today));
  const vol = weeklyVolume(d.done, d.sets, ctx, volWeek);
  const volList = [...vol.entries()].sort((a, b) => b[1] - a[1]);
  const maxVol = Math.max(16, ...volList.map((v) => v[1]));
  const bw = d.body.filter((m) => m.weightKg);
  const waist = d.body.filter((m) => m.waistNavelCm);
  const avg7 = bw.map((m) => {
    const day = toDay(m.date);
    const win = bw.filter((x) => toDay(x.date) <= day && toDay(x.date) > addDays(day, -7));
    return { x: parseDay(day).getTime(), y: fromKg(win.reduce((a, x) => a + (x.weightKg as number), 0) / win.length, d.settings.bodyUnit) };
  });
  const xfmt = (x: number) => new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <>
      <h2>
        Strength (<Term k="e1rm">est. max</Term>)
      </h2>
      {withData.length === 0 ? (
        <p className="muted">Finish your first workout and your strength trend appears here.</p>
      ) : (
        <>
          <select className="input" value={exId} onChange={(e) => setExId(e.target.value)} aria-label="Choose exercise">
            {withData.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          {series.length >= 2 ? (
            <LineChart label={`${exerciseById(exId)?.name} estimated max`} points={series.map((s) => ({ x: parseDay(s.day).getTime(), y: fromKg(s.best, unit) }))} xfmt={xfmt} />
          ) : (
            <p className="small muted">One more session of this and you'll see a trend line.</p>
          )}
          {series.length > 0 && (
            <p className="small">
              Best set last time: <strong>{fmtWeight(series[series.length - 1].weightKg, unit)} {unit} × {series[series.length - 1].reps}</strong>{' '}
              (est. max {fmtWeight(series[series.length - 1].best, unit, 0)} {unit})
            </p>
          )}
        </>
      )}

      <h2>Sessions per week</h2>
      <BarChart label="Sessions per week, last 8 weeks" bars={weeks.map((w) => ({ label: parseDay(w.week).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' }), value: w.count }))} target={d.settings.targetPerWeek} />
      <p className="tiny muted">Green bars hit your weekly target. Dashed line = target.</p>

      <h2>
        <Term k="volume">Volume</Term> by muscle
      </h2>
      <div className="seg" style={{ marginBottom: 8 }}>
        <button aria-pressed={volWeek === weekStart(d.today)} onClick={() => setVolWeek(weekStart(d.today))}>
          This week
        </button>
        <button aria-pressed={volWeek === addDays(weekStart(d.today), -7)} onClick={() => setVolWeek(addDays(weekStart(d.today), -7))}>
          Last week
        </button>
      </div>
      {volList.length === 0 ? (
        <p className="small muted">No sets logged in this week.</p>
      ) : (
        volList.map(([m, v]) => (
          <div className="hbar" key={m}>
            <span>{MUSCLE_NAMES[m as Muscle]}</span>
            <div className="bar">
              <span style={{ width: `${(v / maxVol) * 100}%` }} />
            </div>
            <span className="num" style={{ textAlign: 'right' }}>
              {Math.round(v)}
            </span>
          </div>
        ))
      )}
      <p className="tiny muted">Hard sets per muscle (main muscle 1, helper muscle ½).</p>

      <h2>Body</h2>
      {bw.length >= 2 ? (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Weight ({d.settings.bodyUnit}): solid line = 7-day average, dashed = daily
          </p>
          <LineChart
            label="Body weight"
            points={bw.map((m) => ({ x: parseDay(toDay(m.date)).getTime(), y: fromKg(m.weightKg as number, d.settings.bodyUnit) }))}
            avg={avg7}
            fmt={(v) => v.toFixed(1)}
            xfmt={xfmt}
          />
        </>
      ) : (
        <p className="small muted">Log your weight a few times (+ Body check-in on Today) to see the trend.</p>
      )}
      {waist.length >= 2 && (
        <>
          <p className="small muted" style={{ margin: '12px 0 0' }}>
            Waist at navel ({d.settings.lengthUnit})
          </p>
          <LineChart
            label="Waist"
            points={waist.map((m) => ({ x: parseDay(toDay(m.date)).getTime(), y: cmToLength(m.waistNavelCm as number, d.settings.lengthUnit) }))}
            fmt={(v) => v.toFixed(1)}
            xfmt={xfmt}
          />
        </>
      )}

      <h2>Strength standards</h2>
      <p className="small muted">Your best estimated max compared with your body weight. Conservative levels for lifters who train for health and looks.</p>
      <Standards />
    </>
  );
}

function Standards() {
  const d = useData();
  const unit = d.settings.loadUnit;
  const ctx = { exercise: exerciseById, bodyWeightKg: d.bodyWeightKg };
  const rec = records(d.done, d.sets, ctx);
  const rows = program.strengthStandards
    .map((std) => {
      const best = Math.max(0, ...std.exerciseIds.map((id) => rec.get(id)?.bestE1rm?.value ?? 0));
      return { std, best };
    })
    .filter((r) => r.best > 0);
  if (!rows.length) return <p className="small muted">Shows up once you've done the main lifts.</p>;
  return (
    <ul className="list">
      {rows.map(({ std, best }) => {
        const lvl = standardLevel(std, best, d.bodyWeightKg);
        return (
          <li key={std.id} style={{ padding: '10px 0' }}>
            <div className="row between">
              <strong>{std.name}</strong>
              <span className="badge accent">{lvl.label}</span>
            </div>
            <p className="small muted" style={{ margin: '2px 0' }}>
              {lvl.ratio.toFixed(2)} × body weight ({fmtWeight(best, unit, 0)} {unit} est. max)
              {lvl.next && ` · ${lvl.next.label} at ${lvl.next.ratio} × (${fmtWeight(lvl.next.ratio * d.bodyWeightKg, unit, 0)} ${unit})`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function History() {
  const d = useData();
  const list = [...d.sessions].filter((s) => s.status !== 'in_progress').reverse();
  if (!list.length) return <p className="muted" style={{ marginTop: 16 }}>No sessions yet. Your history shows up here after your first workout.</p>;
  return (
    <ul className="list" style={{ marginTop: 8 }}>
      {list.map((s) => {
        const n = d.sets.filter((x) => x.sessionId === s.id && x.kind === 'work').length;
        return (
          <li key={s.id}>
            <a className="list-row" href={`#/history/${s.id}`}>
              <span className="grow">
                <strong>{templateById(s.workoutTemplateId)?.template.name ?? s.workoutTemplateId}</strong>
                {s.status === 'discarded' && <span className="badge" style={{ marginLeft: 6 }}>discarded</span>}
                {s.isShortVersion && <span className="badge" style={{ marginLeft: 6 }}>20-min</span>}
                {s.isDeload && <span className="badge" style={{ marginLeft: 6 }}>deload</span>}
                <span className="small muted" style={{ display: 'block' }}>
                  {fmtDate(s.startedAt)} · {n} sets
                </span>
              </span>
              ›
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function Records() {
  const d = useData();
  const unit = d.settings.loadUnit;
  const ctx = { exercise: exerciseById, bodyWeightKg: d.bodyWeightKg };
  const rec = [...records(d.done, d.sets, ctx).values()];
  if (!rec.length) return <p className="muted" style={{ marginTop: 16 }}>Your best lifts show up here.</p>;
  return (
    <ul className="list" style={{ marginTop: 8 }}>
      {rec
        .map((r) => ({ r, ex: exerciseById(r.exerciseId)! }))
        .sort((a, b) => a.ex.name.localeCompare(b.ex.name))
        .map(({ r, ex }) => (
          <li key={r.exerciseId} style={{ padding: '10px 0' }}>
            <a href={`#/library/${ex.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              <strong>{ex.name}</strong>
            </a>
            <div className="small muted">
              {r.heaviest && (
                <>
                  Heaviest: {fmtWeight(r.heaviest.weightKg, unit)} {unit} × {r.heaviest.reps}
                  {ex.loadType === 'assisted' ? ' (least help)' : ''}
                </>
              )}
              {r.bestE1rm && ex.loadType !== 'assisted' && <> · Best est. max {fmtWeight(r.bestE1rm.value, unit, 0)} {unit}</>}
              {r.mostReps && !r.heaviest && <>Best: {r.mostReps.reps} {measureOf(ex) === 'seconds' ? 's' : 'reps'}</>}
            </div>
          </li>
        ))}
    </ul>
  );
}

