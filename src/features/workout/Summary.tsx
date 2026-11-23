// Finish screen: summary, personal records, what changes next time, stage progress.
import { useEffect, useMemo } from 'react';
import { useData } from '../../app/data';
import { buildSession } from '../../engine/session';
import { sessionPRs, sessionVolume } from '../../engine/stats';
import { exerciseById, templateById } from '../../engine/program';
import { evaluateStage } from '../../engine/gates';
import { gateContext, sessionsInStage } from '../../app/derive';
import type { SessionRec } from '../../engine/types';
import { fmtWeight } from '../../lib/units';
import { fmtDate } from '../../lib/dates';
import { scheduleSync } from '../../db/sync';
import { IconTrophy } from '../../components/Icons';

export function Summary({ session }: { session: SessionRec }) {
  const d = useData();
  const unit = d.settings.loadUnit;
  const found = templateById(session.workoutTemplateId);
  const sets = d.sets.filter((s) => s.sessionId === session.id && !s.isWarmup && s.kind === 'work');
  const minutes = session.finishedAt ? Math.max(1, Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 60000)) : undefined;

  useEffect(() => {
    if (d.settings.gistToken) scheduleSync(1500);
  }, [d.settings.gistToken]);

  const prs = useMemo(
    () => sessionPRs(session.id, d.done, d.sets, { exercise: exerciseById, bodyWeightKg: d.bodyWeightKg }),
    [session.id, d.done, d.sets, d.bodyWeightKg],
  );

  // What the next session of this workout will ask for.
  const nextChanges = useMemo(() => {
    if (!found) return [];
    const next = buildSession({
      stage: found.stage,
      template: found.template,
      settings: d.settings,
      preferences: d.prefs,
      exposures: d.exposures,
      bodyWeightKg: d.bodyWeightKg,
      sessionsInStage: sessionsInStage(d, found.stage.id),
      short: false,
      mode: 'normal',
      legsLight: false,
      today: d.today,
    });
    const done = new Set(sets.map((s) => s.exerciseId));
    return next
      .filter((p) => done.has(p.exercise.id) && ['up', 'down', 'reset'].includes(p.change))
      .map((p) => {
        const w = `${fmtWeight(p.targetWeightKg, unit)} ${unit}`;
        if (p.change === 'up')
          return p.exercise.loadType === 'assisted' ? `${p.exercise.name}: less help, ${w}` : `${p.exercise.name} goes up to ${w}`;
        return `${p.exercise.name} steps back to ${w} to build up again`;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found?.template.id, d.done.length, d.settings, d.prefs]);

  const stageLine = useMemo(() => {
    if (!found || found.stage.id !== d.stage.id) return undefined;
    const after = evaluateStage(gateContext(d));
    const before = evaluateStage(gateContext(d, d.stage, d.sessions.filter((s) => s.id !== session.id)));
    const newly = after.gates.filter((g, i) => g.met && !before.gates[i].met);
    const sess = after.gates.find((g) => g.gate.type === 'sessions');
    return { sess, newly, after };
  }, [d, found, session.id]);

  const volume = sessionVolume(sets);
  return (
    <div className="page">
      <div className="celebrate">
        <div className="big" aria-hidden>
          {prs.length ? '🏆' : '💪'}
        </div>
        <h2 style={{ fontSize: 34, margin: '8px 0 0' }}>Workout done</h2>
        <p className="muted">
          {found?.template.name} · {fmtDate(session.startedAt)}
          {minutes ? ` · ${minutes} min` : ''}
        </p>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="eyebrow">Sets</div>
          <div className="num">{sets.length}</div>
        </div>
        <div className="kpi">
          <div className="eyebrow">
            Volume ({unit})
          </div>
          <div className="num">{Math.round(Number(fmtWeight(volume, unit, 0))).toLocaleString()}</div>
        </div>
      </div>

      {prs.length > 0 && (
        <div className="card accent">
          <div className="row">
            <IconTrophy />
            <strong>Personal records</strong>
          </div>
          <ul className="bullets">
            {prs.map((p) => (
              <li key={p.exerciseId}>
                {exerciseById(p.exerciseId)?.name}: {p.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextChanges.length > 0 && (
        <div className="card">
          <strong>Next time</strong>
          <ul className="bullets">
            {nextChanges.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {stageLine && (
        <a className="card card-link" href="#/plan">
          <div className="eyebrow">
            Stage {d.stage.number} · {d.stage.name}
          </div>
          <p style={{ margin: '6px 0' }}>
            {stageLine.sess ? `${stageLine.sess.detail} sessions` : ''}
            {stageLine.newly.length > 0 && (
              <>
                {' · '}
                <strong>New target hit: {stageLine.newly.map((g) => g.label).join(', ')}</strong>
              </>
            )}
          </p>
          <div className={`bar ${stageLine.after.allMet ? 'done' : ''}`}>
            <span style={{ width: `${(stageLine.after.metCount / stageLine.after.total) * 100}%` }} />
          </div>
          <p className="small muted">
            {stageLine.after.metCount} of {stageLine.after.total} targets hit
            {stageLine.after.allMet && ' · Ready to move up! Open the Plan.'}
          </p>
        </a>
      )}

      <a className="btn primary big block" href="#/today" style={{ marginTop: 16 }}>
        Done
      </a>
      <a className="btn ghost block" href={`#/history/${session.id}`}>
        View or edit this session
      </a>
    </div>
  );
}
