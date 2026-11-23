// Live workout logging: one exercise at a time, one tap per prescribed set.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData, type AppData } from '../../app/data';
import { go } from '../../app/router';
import { buildSession, substituteOptions, type PlannedExercise } from '../../engine/session';
import { exercises, stepFor, templateById, exerciseById } from '../../engine/program';
import { nextCalibration, usesLoad, measureOf, barFor } from '../../engine/progression';
import type { Exercise, Feel, SessionRec, SetRec } from '../../engine/types';
import * as repo from '../../db/repo';
import { computeRows, type Row } from './rows';
import { fmtWeight, fromKg, toKg, roundToStep } from '../../lib/units';
import { lsGet, lsSet } from '../../lib/storage';
import { beep, unlockAudio } from '../../lib/sound';
import { useWakeLock } from '../../lib/useWakeLock';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import { Confirm, Sheet } from '../../components/Sheet';
import { Term } from '../../components/Term';
import { useToast } from '../../components/Toast';
import { IconBack, IconCheck, IconHurt, IconInfo, IconNext, IconNote, IconSwap, IconX } from '../../components/Icons';
import { ExerciseGuide } from '../library/ExerciseGuide';
import { Summary } from './Summary';
import { sessionsInStage } from '../../app/derive';

const FEELS: { f: Feel; label: string; hint: string }[] = [
  { f: 'easy', label: 'Easy', hint: 'could do 4+ more' },
  { f: 'solid', label: 'Solid', hint: '2–3 more' },
  { f: 'max', label: 'Max', hint: '0–1 more' },
];

export function Workout({ id }: { id: string }) {
  const d = useData();
  const session = d.sessions.find((s) => s.id === id);
  if (!session)
    return (
      <div className="page">
        <h2>Workout not found</h2>
        <a className="btn" href="#/today">
          Back to Today
        </a>
      </div>
    );
  if (session.status === 'done') return <Summary session={session} />;
  if (session.status === 'discarded')
    return (
      <div className="page">
        <h2>Workout discarded</h2>
        <a className="btn" href="#/today">
          Back to Today
        </a>
      </div>
    );
  return <Live d={d} session={session} />;
}

function usePlan(d: AppData, session: SessionRec) {
  const found = templateById(session.workoutTemplateId)!;
  const inStage = sessionsInStage(d, found.stage.id);
  const sessionDay = session.startedAt.slice(0, 10);
  return useMemo(
    () =>
      buildSession({
        stage: found.stage,
        template: found.template,
        settings: d.settings,
        preferences: d.prefs,
        exposures: d.exposures,
        bodyWeightKg: d.bodyWeightKg,
        sessionsInStage: inStage,
        short: session.isShortVersion,
        mode: session.isDeload ? 'deload' : session.isReentry ? 'reentry' : 'normal',
        reentryFactor: session.reentryFactor,
        legsLight: !!session.legsLight,
        today: sessionDay,
        slotExercise: session.slotExercise,
      }),
    // Exposures only change when another session finishes, not on each set logged here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [found.template.id, d.settings, d.prefs, d.done.length, d.bodyWeightKg, session.slotExercise, session.isShortVersion, session.isDeload, session.isReentry, session.legsLight],
  );
}

function Live({ d, session }: { d: AppData; session: SessionRec }) {
  const plan = usePlan(d, session);
  const found = templateById(session.workoutTemplateId)!;
  const sets = useMemo(() => d.sets.filter((s) => s.sessionId === session.id), [d.sets, session.id]);
  const curKey = `rep:cur:${session.id}`;
  const [cur, setCurRaw] = useState(() => Math.min(lsGet(curKey, 0), plan.length - 1));
  const setCur = (i: number) => {
    const n = Math.max(0, Math.min(plan.length - 1, i));
    setCurRaw(n);
    lsSet(curKey, n);
    window.scrollTo({ top: 0 });
  };
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const rest = useRest(session.id, d.settings.sound);
  useWakeLock(true);
  const toast = useToast();

  const workDoneFor = (pe: PlannedExercise) => sets.filter((s) => s.slotIndex === pe.slotIndex && s.kind === 'work').length;
  const allDone = plan.every((pe) => workDoneFor(pe) >= pe.sets);
  const anyLogged = sets.some((s) => s.kind === 'work');

  const finish = async () => {
    await repo.finishSession(session.id);
    lsSet(curKey, undefined);
    lsSet(`rep:rest:${session.id}`, undefined);
    window.scrollTo(0, 0);
  };

  // Swipe left/right between exercises.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 40) setCur(cur + (dx < 0 ? 1 : -1));
  };

  const pe = plan[cur];
  const flags = [
    session.isShortVersion && '20-minute version',
    session.isDeload && 'Deload week',
    session.isReentry && 'Easing back in',
    session.legsLight && 'Legs light',
  ].filter(Boolean) as string[];

  return (
    <div>
      <div className="header" style={{ paddingBottom: 0 }}>
        <button className="icon-btn" aria-label="Leave workout (it's saved)" onClick={() => setConfirmLeave(true)}>
          <IconX />
        </button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div className="display" style={{ fontSize: 20, textTransform: 'uppercase' }}>
            {found.template.name}
          </div>
          {flags.length > 0 && <div className="tiny muted">{flags.join(' · ')}</div>}
        </div>
        <button className="btn ghost" style={{ padding: '0 8px' }} onClick={() => (allDone ? finish() : setConfirmFinish(true))}>
          Finish
        </button>
      </div>
      <div className="pips" role="tablist" aria-label="Exercises">
        {plan.map((p, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === cur}
            aria-label={`${p.exercise.name}${workDoneFor(p) >= p.sets ? ', done' : ''}`}
            className={i === cur ? 'current' : workDoneFor(p) >= p.sets ? 'done' : ''}
            onClick={() => setCur(i)}
          >
            <span />
          </button>
        ))}
      </div>
      <div className="page" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <ExercisePanel
          key={`${pe.slotIndex}-${pe.exercise.id}`}
          d={d}
          session={session}
          pe={pe}
          index={cur}
          count={plan.length}
          sets={sets}
          onLogged={(restSec, isLastSet) => {
            if (!isLastSet || cur < plan.length - 1) rest.start(restSec);
          }}
          onSkip={() => setCur(cur + 1)}
          toast={toast}
        />
      </div>
      {rest.view}
      <div className="workout-nav">
        <button className="btn quiet" onClick={() => setCur(cur - 1)} disabled={cur === 0} aria-label="Previous exercise">
          <IconBack />
        </button>
        {cur < plan.length - 1 ? (
          <button className={`btn grow ${workDoneFor(pe) >= pe.sets ? 'primary' : ''}`} onClick={() => setCur(cur + 1)}>
            Next: {plan[cur + 1].exercise.name} <IconNext />
          </button>
        ) : (
          <button className="btn grow primary" onClick={() => (allDone ? finish() : setConfirmFinish(true))}>
            Finish workout
          </button>
        )}
      </div>
      {confirmFinish && (
        <Confirm
          title="Finish now?"
          body={
            anyLogged
              ? "Some sets aren't logged yet. I'll save what you did; that still counts."
              : "Nothing is logged yet. Finishing will save an empty session. Discard it instead?"
          }
          confirmLabel={anyLogged ? 'Finish with what I logged' : 'Discard workout'}
          danger={!anyLogged}
          onCancel={() => setConfirmFinish(false)}
          onConfirm={async () => {
            setConfirmFinish(false);
            if (anyLogged) await finish();
            else {
              await repo.discardSession(session.id);
              go('today');
            }
          }}
        />
      )}
      {confirmLeave && (
        <Confirm
          title="Leave for now?"
          body="Everything you logged is saved. Tap Resume on the Today screen to come back."
          confirmLabel="Leave"
          onCancel={() => setConfirmLeave(false)}
          onConfirm={() => go('today')}
        />
      )}
    </div>
  );
}

// ---------------- one exercise ----------------

function ExercisePanel({
  d,
  session,
  pe,
  index,
  count,
  sets,
  onLogged,
  onSkip,
  toast,
}: {
  d: AppData;
  session: SessionRec;
  pe: PlannedExercise;
  index: number;
  count: number;
  sets: SetRec[];
  onLogged: (restSec: number, isLastSet: boolean) => void;
  onSkip: () => void;
  toast: (m: string) => void;
}) {
  const ex = pe.exercise;
  const unit = d.settings.loadUnit;
  const pref = d.prefs.find((p) => p.id === ex.id);
  const step = stepFor(ex, d.settings, pref?.incrementLb);
  const ctx = { unit, step, bodyWeightKg: d.bodyWeightKg };
  const [extra, setExtra] = useState(0);
  const { rows, activeIndex, calibrating, calibrationMessage, workDone, workTotal } = computeRows(pe, sets, ctx, extra);
  const warmLogged = sets.filter((s) => s.slotIndex === pe.slotIndex && s.kind === 'warmup');
  const [skipWarm, setSkipWarm] = useState(() => lsGet(`rep:skipwarm:${session.id}`, false));
  const [sheet, setSheet] = useState<'howto' | 'sub' | 'pain' | 'note' | { edit: SetRec } | undefined>();
  const loaded = usesLoad(ex);
  const seconds = measureOf(ex) === 'seconds';
  const lastLogged = [...rows].reverse().find((r) => r.logged)?.logged;

  // Draft for the active row (resets when the active row changes).
  const active = activeIndex !== undefined ? rows[activeIndex] : undefined;
  const [draft, setDraft] = useState<{ key: string; kg: number; reps: number }>();
  const dkey = active ? `${active.key}:${active.targetKg.toFixed(3)}` : '';
  const cur = draft && draft.key === dkey ? draft : active ? { key: dkey, kg: active.targetKg, reps: active.targetReps } : undefined;

  const logging = useRef<string | undefined>(undefined);
  const logActive = async () => {
    if (!active || !cur) return;
    // Ignore a double tap on the same row while the first one is being saved.
    if (logging.current === active.key) return;
    logging.current = active.key;
    window.setTimeout(() => (logging.current = undefined), 800);
    unlockAudio();
    const isCal = active.kind === 'calibration';
    const rec = await repo.logSet({
      sessionId: session.id,
      exerciseId: ex.id,
      slotIndex: pe.slotIndex,
      setIndex: active.setIndex,
      isWarmup: isCal,
      kind: active.kind,
      targetWeight: active.targetKg,
      targetReps: active.targetReps,
      weight: loaded ? cur.kg : 0,
      reps: cur.reps,
      feel: 'solid',
      substitutedFrom: pe.substitutedFrom,
    });
    if (isCal) await resolveCalibration(rec, 'solid');
    const isLast = !isCal && workDone + 1 >= workTotal;
    onLogged(pe.restSec, isLast);
    if (isLast && index < count - 1) toast(`${ex.name} done. Swipe or tap Next when ready.`);
  };

  /** After a calibration set's feel is known: Solid (with all reps) locks it in as working set 1. */
  const resolveCalibration = async (rec: SetRec, feel: Feel) => {
    const calCount = sets.filter((s) => s.slotIndex === pe.slotIndex && s.kind === 'calibration' && s.id !== rec.id).length + 1;
    const stepRes = nextCalibration(ex, rec.weight, feel, rec.reps, rec.targetReps, calCount, ctx);
    if (stepRes.done && feel === 'solid' && rec.reps >= rec.targetReps) {
      await repo.updateSet(rec.id, { kind: 'work', isWarmup: false, feel });
    }
  };

  const changeFeel = async (s: SetRec, f: Feel) => {
    await repo.setFeel(s.id, f);
    if (!pe.calibrate) return;
    const workSets = sets.filter((x) => x.slotIndex === pe.slotIndex && x.kind === 'work');
    if (s.kind === 'calibration') await resolveCalibration({ ...s, feel: f }, f);
    else if (s.kind === 'work' && workSets.length === 1 && workSets[0].id === s.id && f !== 'solid') {
      // Not Solid after all: keep looking for the right weight.
      await repo.updateSet(s.id, { kind: 'calibration', isWarmup: true });
    }
  };

  const fmt = (kg: number) => fmtWeight(kg, unit);
  const loadLabel =
    ex.loadType === 'dumbbell-per-hand'
      ? `${unit} each`
      : ex.loadType === 'barbell-total'
        ? `${unit} total`
        : ex.loadType === 'assisted'
          ? `${unit} help`
          : ex.loadType === 'bodyweight'
            ? `+${unit}`
            : unit;
  const repWord = seconds ? 'seconds' : ex.perSide ? 'reps each side' : 'reps';
  const range = pe.repMin === pe.repMax ? `${pe.repMin}` : `${pe.repMin}–${pe.repMax}`;
  const targetLine = calibrating
    ? `Find your weight: ${active?.targetReps} reps, then rate it`
    : `${pe.sets} set${pe.sets > 1 ? 's' : ''} × ${range} ${repWord}${loaded && pe.targetWeightKg > 0 ? ` · ${fmt(rows.find((r) => r.kind === 'work')?.targetKg ?? pe.targetWeightKg)} ${loadLabel}` : ''} · rest ${pe.restSec} s`;

  return (
    <div>
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="eyebrow">
          Exercise {index + 1} of {count}
          {pe.substitutedFrom && ` · swapped in for ${exerciseById(pe.substitutedFrom)?.name}`}
        </span>
      </div>
      <h2 style={{ margin: '2px 0 8px', fontSize: 28, lineHeight: 1.05 }}>{ex.name}</h2>
      <div className="ex-top">
        <button className="ex-media" onClick={() => setSheet('howto')} aria-label={`How to do ${ex.name}`}>
          <ExerciseMedia ex={ex} compact />
        </button>
        <div>
          <p style={{ fontWeight: 600, margin: '0 0 8px', fontSize: 15 }}>{ex.cue}</p>
          <button className="btn quiet" style={{ minHeight: 44, padding: '0 12px', fontSize: 14 }} onClick={() => setSheet('howto')}>
            <IconInfo width={18} /> How to do it
          </button>
        </div>
      </div>

      <p className="target" style={{ marginTop: 12 }}>
        {targetLine}
      </p>
      <div className="why">
        <span aria-hidden>💡</span>
        <span>{calibrationMessage ?? pe.reason}</span>
      </div>
      {pe.slot.note && <p className="small muted">{pe.slot.note}</p>}

      {pe.warmups.length > 0 && !skipWarm && workDone === 0 && (
        <div style={{ margin: '6px 0 10px' }}>
          <div className="row between">
            <span className="eyebrow">
              <Term k="warmup">Warm-up</Term> (doesn't count)
            </span>
            <button
              className="btn ghost"
              style={{ minHeight: 40 }}
              onClick={() => {
                setSkipWarm(true);
                lsSet(`rep:skipwarm:${session.id}`, true);
              }}
            >
              Skip warm-ups
            </button>
          </div>
          {pe.warmups.map((w, i) => {
            const done = warmLogged.find((s) => s.setIndex === i);
            return (
              <div className="set-row warm" key={i}>
                <span className="label">W{i + 1}</span>
                <span>
                  <span className="num" style={{ fontSize: 20, color: 'var(--text)' }}>
                    {fmt(w.weightKg)}
                  </span>{' '}
                  {loadLabel} × {w.reps}
                  {ex.loadType === 'barbell-total' && Math.abs(w.weightKg - barFor(ex, unit)) < 0.01 && ' (empty bar)'}
                </span>
                <button
                  className={`check small ${done ? 'done' : ''}`}
                  aria-label={done ? `Warm-up ${i + 1} done` : `Mark warm-up ${i + 1} done, ${fmt(w.weightKg)} ${unit}, ${w.reps} reps`}
                  onClick={async () => {
                    unlockAudio();
                    if (done) await repo.deleteSet(done.id);
                    else
                      await repo.logSet({
                        sessionId: session.id,
                        exerciseId: ex.id,
                        slotIndex: pe.slotIndex,
                        setIndex: i,
                        isWarmup: true,
                        kind: 'warmup',
                        targetWeight: w.weightKg,
                        targetReps: w.reps,
                        weight: w.weightKg,
                        reps: w.reps,
                        substitutedFrom: pe.substitutedFrom,
                      });
                  }}
                >
                  <IconCheck width={20} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div role="list" aria-label="Sets">
        {rows.map((r, i) => (
          <div key={r.key} role="listitem">
            <SetRowView
              row={r}
              n={r.kind === 'calibration' ? `T${i + 1}` : `${rows.filter((x, k) => x.kind === 'work' && k <= i).length}`}
              state={r.logged ? 'logged' : i === activeIndex ? 'active' : 'future'}
              ex={ex}
              unit={unit}
              step={step}
              loadLabel={loadLabel}
              seconds={seconds}
              draft={i === activeIndex ? cur : undefined}
              onDraft={(kg, reps) => setDraft({ key: dkey, kg, reps })}
              onLog={logActive}
              onEdit={() => r.logged && setSheet({ edit: r.logged })}
            />
            {r.logged && r.logged.id === lastLogged?.id && (
              <div className="feel" role="group" aria-label="How did that feel?">
                <span className="small muted" style={{ width: '100%' }}>
                  How did that feel?
                </span>
                {FEELS.map(({ f, label, hint }) => (
                  <button
                    key={f}
                    className="chip"
                    aria-pressed={(r.logged!.feel ?? 'solid') === f}
                    onClick={() => changeFeel(r.logged!, f)}
                    title={hint}
                  >
                    {label} <span className="tiny" style={{ opacity: 0.75 }}>{hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {activeIndex === undefined && !calibrating && (
        <div className="row" style={{ marginTop: 10 }}>
          <span className="badge done">✓ {ex.name} done</span>
          <button className="btn ghost" onClick={() => setExtra(extra + 1)}>
            + Add a set
          </button>
        </div>
      )}

      <div className="workout-actions">
        <button className="btn quiet" onClick={() => setSheet('sub')}>
          <IconSwap width={18} /> Substitute
        </button>
        <button className="btn quiet" onClick={() => setSheet('pain')}>
          <IconHurt width={18} /> Something hurts
        </button>
        <button className="btn quiet" onClick={() => setSheet('note')} aria-label="Notes for this exercise">
          <IconNote width={18} /> {session.exerciseNotes?.[ex.id] ? 'Note ✓' : 'Note'}
        </button>
      </div>

      {sheet === 'howto' && (
        <Sheet title={ex.name} onClose={() => setSheet(undefined)}>
          <ExerciseGuide ex={ex} />
        </Sheet>
      )}
      {sheet === 'sub' && <SubstituteSheet d={d} session={session} pe={pe} onClose={() => setSheet(undefined)} />}
      {sheet === 'pain' && (
        <PainSheet
          ex={ex}
          session={session}
          pe={pe}
          onClose={() => setSheet(undefined)}
          onSkip={() => {
            setSheet(undefined);
            onSkip();
          }}
          onLighter={() => {
            if (cur && active) {
              const v = roundToStep(fromKg(cur.kg, unit) * (ex.loadType === 'assisted' ? 1.2 : 0.8), step, 'down');
              setDraft({ key: dkey, kg: toKg(v, unit), reps: cur.reps });
            }
            setSheet(undefined);
          }}
        />
      )}
      {sheet === 'note' && <NoteSheet session={session} exId={ex.id} onClose={() => setSheet(undefined)} />}
      {typeof sheet === 'object' && (
        <EditSetSheet set={sheet.edit} ex={ex} unit={unit} step={step} loadLabel={loadLabel} seconds={seconds} onClose={() => setSheet(undefined)} />
      )}
    </div>
  );
}

// ---------------- set row ----------------

function SetRowView({
  row,
  n,
  state,
  ex,
  unit,
  step,
  loadLabel,
  seconds,
  draft,
  onDraft,
  onLog,
  onEdit,
}: {
  row: Row;
  n: string;
  state: 'logged' | 'active' | 'future';
  ex: Exercise;
  unit: 'lb' | 'kg';
  step: number;
  loadLabel: string;
  seconds: boolean;
  draft?: { kg: number; reps: number };
  onDraft: (kg: number, reps: number) => void;
  onLog: () => void;
  onEdit: () => void;
}) {
  const loaded = usesLoad(ex);
  const repStep = seconds ? 5 : 1;
  const repLabel = seconds ? 'sec' : ex.perSide ? 'reps/side' : 'reps';
  if (state === 'logged' && row.logged) {
    const l = row.logged;
    return (
      <div className="set-row logged">
        <span className="label">{n}</span>
        <button className="static-val btn ghost" style={{ color: 'var(--text)' }} onClick={onEdit} aria-label={`Edit set ${n}`}>
          {loaded ? (
            <>
              <span className="num">{fmtWeight(l.weight, unit)}</span>&nbsp;<span className="tiny muted">{loadLabel}</span>
            </>
          ) : (
            <span className="muted small">body weight</span>
          )}
        </button>
        <button className="static-val btn ghost" style={{ color: 'var(--text)' }} onClick={onEdit} aria-label={`Edit set ${n}`}>
          <span className="num">{l.reps}</span>&nbsp;<span className="tiny muted">{repLabel}</span>
        </button>
        <span className="check done" aria-label={`Set ${n} done`}>
          <IconCheck />
        </span>
      </div>
    );
  }
  const kg = draft?.kg ?? row.targetKg;
  const reps = draft?.reps ?? row.targetReps;
  const disp = roundToStep(fromKg(kg, unit), 0.1);
  if (state === 'future') {
    return (
      <div className="set-row future" aria-label={`Set ${n}, coming up`}>
        <span className="label">{n}</span>
        <span className="static-val">
          {loaded ? (
            <>
              <span className="num">{fmtWeight(kg, unit)}</span> <span className="tiny muted">{loadLabel}</span>
            </>
          ) : (
            <span className="muted small">body weight</span>
          )}
        </span>
        <span className="static-val">
          <span className="num">{reps}</span> <span className="tiny muted">{repLabel}</span>
        </span>
        <span className="check" aria-hidden>
          <IconCheck />
        </span>
      </div>
    );
  }
  const minW = ex.loadType === 'barbell-total' ? fromKg(barFor(ex, unit), unit) : 0;
  return (
    <div className="set-row" style={{ borderBottom: 0 }}>
      <span className="label">{n}</span>
      {loaded ? (
        <Stepper
          value={disp}
          step={step}
          min={minW}
          unitLabel={loadLabel}
          label={`Weight in ${unit}`}
          onChange={(v) => onDraft(toKg(v, unit), reps)}
        />
      ) : (
        <span className="static-val muted small">body weight</span>
      )}
      <Stepper value={reps} step={repStep} min={0} unitLabel={repLabel} label={seconds ? 'Seconds' : 'Reps'} onChange={(v) => onDraft(kg, v)} integer />
      <button
        className="check primary"
        onClick={onLog}
        aria-label={`Mark set ${n} done${loaded ? `, ${fmtWeight(kg, unit)} ${unit === 'lb' ? 'pounds' : 'kilograms'}` : ''}, ${reps} ${seconds ? 'seconds' : 'reps'}`}
      >
        <IconCheck />
      </button>
    </div>
  );
}

function Stepper({
  value,
  step,
  min = 0,
  unitLabel,
  label,
  onChange,
  integer,
}: {
  value: number;
  step: number;
  min?: number;
  unitLabel: string;
  label: string;
  onChange: (v: number) => void;
  integer?: boolean;
}) {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const clamp = (v: number) => Math.max(min, integer ? Math.round(v) : Math.round(v * 100) / 100);
  return (
    <div className="stepper">
      <button aria-label={`Decrease ${label.toLowerCase()}`} onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      {typing ? (
        <input
          className="val"
          autoFocus
          inputMode={integer ? 'numeric' : 'decimal'}
          aria-label={label}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const v = parseFloat(text.replace(',', '.'));
            if (!Number.isNaN(v)) onChange(clamp(v));
            setTyping(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <button
          className="val"
          aria-label={`${label}: ${value}. Tap to type.`}
          onClick={() => {
            setText(String(value));
            setTyping(true);
          }}
        >
          {Number.isInteger(value) ? value : value.toFixed(1)}
          <small>{unitLabel}</small>
        </button>
      )}
      <button aria-label={`Increase ${label.toLowerCase()}`} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </div>
  );
}

// ---------------- rest timer ----------------

function useRest(sessionId: string, sound: boolean) {
  const key = `rep:rest:${sessionId}`;
  const [state, setState] = useState<{ endsAt: number; total: number } | undefined>(() => lsGet(key, undefined));
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    if (!state) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [state]);
  const left = state ? Math.ceil((state.endsAt - now) / 1000) : 0;
  useEffect(() => {
    if (!state) return;
    if (left <= 0 && !fired.current) {
      fired.current = true;
      if (sound) beep();
    }
    if (left < -8) {
      setState(undefined);
      lsSet(key, undefined);
    }
  }, [left, state, sound, key]);
  const start = useCallback(
    (sec: number) => {
      fired.current = false;
      const s = { endsAt: Date.now() + sec * 1000, total: sec };
      setState(s);
      setNow(Date.now());
      lsSet(key, s);
    },
    [key],
  );
  const adjust = (delta: number) => {
    if (!state) return;
    const s = { ...state, endsAt: state.endsAt + delta * 1000 };
    setState(s);
    lsSet(key, s);
  };
  const stop = () => {
    setState(undefined);
    lsSet(key, undefined);
  };
  const over = state && left <= 0;
  const mm = Math.floor(Math.max(0, left) / 60);
  const ss = String(Math.max(0, left) % 60).padStart(2, '0');
  const view = state ? (
    <div className={`rest-bar ${over ? 'over' : ''}`} role="timer" aria-live={over ? 'assertive' : 'off'}>
      <div className="grow">
        <div className="tiny" style={{ fontWeight: 700, opacity: 0.8 }}>
          {over ? 'REST DONE — GO!' : 'REST'}
        </div>
        <div className="num">{over ? '0:00' : `${mm}:${ss}`}</div>
      </div>
      {!over && (
        <>
          <button className="btn" onClick={() => adjust(-15)} aria-label="15 seconds less">
            −15
          </button>
          <button className="btn" onClick={() => adjust(15)} aria-label="15 seconds more">
            +15
          </button>
        </>
      )}
      <button className="btn" onClick={stop}>
        {over ? 'OK' : 'Skip'}
      </button>
    </div>
  ) : null;
  return { start, view };
}

// ---------------- sheets ----------------

function SubstituteSheet({ d, session, pe, onClose }: { d: AppData; session: SessionRec; pe: PlannedExercise; onClose: () => void }) {
  const original = exerciseById(pe.slot.exerciseId)!;
  const stageNum = templateById(session.workoutTemplateId)!.stage.number;
  const opts = substituteOptions(original, exercises, stageNum).filter((e) => e.id !== pe.exercise.id);
  const [always, setAlways] = useState(false);
  const loggedHere = d.sets.some((s) => s.sessionId === session.id && s.slotIndex === pe.slotIndex);
  const choose = async (id: string) => {
    const map = { ...(session.slotExercise ?? {}), [pe.slotIndex]: id };
    if (id === original.id) delete map[pe.slotIndex];
    await repo.updateSession(session.id, { slotExercise: map });
    if (always) await repo.setPreference(original.id, { alwaysSubstituteWith: id === original.id ? undefined : id });
    onClose();
  };
  return (
    <Sheet title="Swap exercise" onClose={onClose}>
      <p className="muted">Machine taken, or it doesn't feel right? These train the same movement, so your progress carries on.</p>
      {loggedHere && <p className="small">Sets you already logged stay saved under {pe.exercise.name}.</p>}
      <ul className="list">
        {pe.exercise.id !== original.id && (
          <li>
            <button className="list-row" onClick={() => choose(original.id)}>
              <span className="grow">
                <strong>Back to {original.name}</strong>
                <span className="small muted" style={{ display: 'block' }}>
                  The original exercise in your plan
                </span>
              </span>
            </button>
          </li>
        )}
        {opts.map((e) => (
          <li key={e.id}>
            <button className="list-row" onClick={() => choose(e.id)}>
              <span className="grow">
                <strong>{e.name}</strong>
                <span className="small muted" style={{ display: 'block' }}>
                  {e.purpose}
                </span>
              </span>
              <IconNext />
            </button>
          </li>
        ))}
      </ul>
      <label className="row" style={{ marginTop: 12, minHeight: 48 }}>
        <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} style={{ width: 22, height: 22 }} />
        <span>Always use this instead of {original.name}</span>
      </label>
    </Sheet>
  );
}

function PainSheet({
  ex,
  session,
  pe,
  onClose,
  onSkip,
  onLighter,
}: {
  ex: Exercise;
  session: SessionRec;
  pe: PlannedExercise;
  onClose: () => void;
  onSkip: () => void;
  onLighter: () => void;
}) {
  const [kind, setKind] = useState<'sharp' | 'ache'>();
  const easier = ex.regressionId ? exerciseById(ex.regressionId) : undefined;
  const record = async (k: 'sharp' | 'ache') => {
    setKind(k);
    await repo.addEvent('pain', { exerciseId: ex.id, data: { kind: k, sessionId: session.id } });
  };
  const swapEasier = async () => {
    if (!easier) return;
    await repo.updateSession(session.id, { slotExercise: { ...(session.slotExercise ?? {}), [pe.slotIndex]: easier.id } });
    onClose();
  };
  return (
    <Sheet title="Something hurts" onClose={onClose}>
      {!kind ? (
        <>
          <p>What does it feel like?</p>
          <div className="stack">
            <button className="btn block danger" onClick={() => record('sharp')}>
              Sharp or stabbing pain
            </button>
            <button className="btn block" onClick={() => record('ache')}>
              Dull ache or discomfort
            </button>
          </div>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            This is a general training app, not medical advice.
          </p>
        </>
      ) : kind === 'sharp' ? (
        <>
          <p>
            <strong>Stop this exercise now.</strong> Sharp pain is a signal, not something to push through. Move on to the next exercise
            if it doesn't hurt, or end the session.
          </p>
          <p className="small muted">If the pain persists over the next days, please check with a doctor or physio. I've noted it.</p>
          <button className="btn primary block" onClick={onSkip}>
            Skip to the next exercise
          </button>
        </>
      ) : (
        <>
          <p>Noted. Try one of these:</p>
          <div className="stack">
            <button className="btn block" onClick={onLighter}>
              Go about 20% lighter on the next set
            </button>
            {easier && (
              <button className="btn block" onClick={swapEasier}>
                Swap to the easier version: {easier.name}
              </button>
            )}
            <button className="btn block quiet" onClick={onSkip}>
              Skip this exercise today
            </button>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            If it turns sharp, stop. If it keeps coming back, check with a doctor or physio.
          </p>
        </>
      )}
    </Sheet>
  );
}

function NoteSheet({ session, exId, onClose }: { session: SessionRec; exId: string; onClose: () => void }) {
  const [text, setText] = useState(session.exerciseNotes?.[exId] ?? '');
  return (
    <Sheet title="Note" onClose={onClose}>
      <textarea
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Seat height 4, felt it in the lower back"
        aria-label="Note for this exercise"
        autoFocus
      />
      <button
        className="btn primary block"
        style={{ marginTop: 12 }}
        onClick={async () => {
          await repo.updateSession(session.id, { exerciseNotes: { ...(session.exerciseNotes ?? {}), [exId]: text } });
          onClose();
        }}
      >
        Save note
      </button>
    </Sheet>
  );
}

export function EditSetSheet({
  set,
  ex,
  unit,
  step,
  loadLabel,
  seconds,
  onClose,
}: {
  set: SetRec;
  ex: Exercise;
  unit: 'lb' | 'kg';
  step: number;
  loadLabel: string;
  seconds: boolean;
  onClose: () => void;
}) {
  const [kg, setKg] = useState(set.weight);
  const [reps, setReps] = useState(set.reps);
  const [feel, setFeel] = useState<Feel>(set.feel ?? 'solid');
  const [confirm, setConfirm] = useState(false);
  const loaded = usesLoad(ex);
  return (
    <Sheet title={`Edit set`} onClose={onClose}>
      <p className="muted">{ex.name}</p>
      <div className="grid2">
        {loaded && (
          <Stepper value={roundToStep(fromKg(kg, unit), 0.1)} step={step} unitLabel={loadLabel} label={`Weight in ${unit}`} onChange={(v) => setKg(toKg(v, unit))} />
        )}
        <Stepper value={reps} step={seconds ? 5 : 1} unitLabel={seconds ? 'sec' : 'reps'} label={seconds ? 'Seconds' : 'Reps'} onChange={setReps} integer />
      </div>
      <div className="feel">
        {FEELS.map(({ f, label }) => (
          <button key={f} className="chip" aria-pressed={feel === f} onClick={() => setFeel(f)}>
            {label}
          </button>
        ))}
      </div>
      <button
        className="btn primary block"
        onClick={async () => {
          await repo.updateSet(set.id, { weight: loaded ? kg : 0, reps, feel });
          onClose();
        }}
      >
        Save
      </button>
      <button className="btn danger block" style={{ marginTop: 8 }} onClick={() => setConfirm(true)}>
        Delete this set
      </button>
      {confirm && (
        <Confirm
          title="Delete this set?"
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            await repo.deleteSet(set.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
