import { useMemo } from 'react';
import { useData } from '../../app/data';
import { exerciseById } from '../../engine/program';
import { e1rmSeries, records } from '../../engine/stats';
import { measureOf } from '../../engine/progression';
import { ExerciseGuide } from './ExerciseGuide';
import { LineChart } from '../../components/Charts';
import { fmtWeight, fromKg } from '../../lib/units';
import { fmtDate, parseDay } from '../../lib/dates';

export function ExercisePage({ id }: { id: string }) {
  const d = useData();
  const ex = exerciseById(id);
  const ctx = { exercise: exerciseById, bodyWeightKg: d.bodyWeightKg };
  const series = useMemo(() => (ex ? e1rmSeries(ex.id, d.done, d.sets, ctx) : []), [ex, d.done, d.sets]); // eslint-disable-line react-hooks/exhaustive-deps
  const rec = useMemo(() => (ex ? records(d.done, d.sets, ctx).get(ex.id) : undefined), [ex, d.done, d.sets]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ex)
    return (
      <div className="page">
        <p>Exercise not found.</p>
      </div>
    );
  const unit = d.settings.loadUnit;
  const exps = (d.exposures.get(ex.id) ?? []).slice(-5).reverse();
  const seconds = measureOf(ex) === 'seconds';
  return (
    <div className="page">
      <h2 style={{ marginTop: 4, fontSize: 30 }}>{ex.name}</h2>
      <ExerciseGuide ex={ex} />
      <h3>Your history</h3>
      {exps.length === 0 ? (
        <p className="muted small">Not done yet. When you do, your last sessions and best sets show up here.</p>
      ) : (
        <>
          {series.length > 1 && !seconds && (
            <LineChart
              label={`${ex.name} estimated max`}
              points={series.map((s) => ({ x: parseDay(s.day).getTime(), y: fromKg(s.best, unit) }))}
              fmt={(v) => `${Math.round(v)}`}
              xfmt={(x) => new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            />
          )}
          {rec?.heaviest && (
            <p className="small">
              Heaviest: <strong>{fmtWeight(rec.heaviest.weightKg, unit)} {unit} × {rec.heaviest.reps}</strong>
            </p>
          )}
          <ul className="list">
            {exps.map((e) => (
              <li key={e.sessionId} className="list-row" style={{ cursor: 'default' }}>
                <span className="grow">
                  <span className="small muted">{fmtDate(e.at)}</span>
                  <span style={{ display: 'block', fontWeight: 600 }}>
                    {e.sets
                      .map((s) => (s.weight > 0 ? `${fmtWeight(s.weight, unit)}×${s.reps}` : `${s.reps}${seconds ? ' s' : ''}`))
                      .join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
