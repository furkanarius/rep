// The year-long journey: stages unlocked by performance, not the calendar.
import { useMemo, useState } from 'react';
import { useData, type AppData } from '../../app/data';
import { stages, program, exerciseById, nextStage, allTemplates, stepFor } from '../../engine/program';
import { evaluateStage, type GateProgress } from '../../engine/gates';
import { gateContext, moveUpOffer, sessionsInStage, optionalUnlocked } from '../../app/derive';
import type { Stage, WorkoutTemplate } from '../../engine/types';
import * as repo from '../../db/repo';
import { Confirm, Sheet } from '../../components/Sheet';
import { Term } from '../../components/Term';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import { IconCheck, IconLock } from '../../components/Icons';
import { fromKg, roundToStep } from '../../lib/units';
import { diffDays, toDay } from '../../lib/dates';
import { activeSpecialization } from '../../engine/session';

export function Plan() {
  const d = useData();
  const cur = d.stage;
  const status = useMemo(() => evaluateStage(gateContext(d)), [d]);
  const [preview, setPreview] = useState<Stage>();
  const [tech, setTech] = useState<string>();
  const [unlocked, setUnlocked] = useState<Stage>();
  const [confirm, setConfirm] = useState<'anyway' | { repeat: Stage } | undefined>();
  const offer = moveUpOffer(d);
  const next = nextStage(cur.id);
  const stayedRecently = d.events.some((e) => e.type === 'stage-stay' && e.data?.stageId === cur.id && diffDays(d.today, toDay(e.date)) < 14);

  const moveUp = async (to: Stage) => {
    await repo.addEvent('stage-unlock', { data: { from: cur.id, to: to.id } });
    await repo.saveSettings({ currentStageId: to.id, stageStartedAt: new Date().toISOString(), specialization: undefined });
    setUnlocked(to);
  };

  return (
    <div className="page">
      <p className="muted small" style={{ marginTop: 0 }}>
        About a year in 5 stages. You move up by doing the work and hitting targets, not because weeks pass.{' '}
        <Term k="stage">How stages work</Term>
      </p>
      <div className="path">
        {stages.map((st) => {
          const state = st.number < cur.number ? 'done' : st.id === cur.id ? 'current' : 'locked';
          return (
            <div key={st.id} className={`node ${state}`}>
              <span className="marker" aria-hidden>
                {state === 'done' ? <IconCheck width={14} /> : state === 'locked' ? <IconLock width={13} /> : st.number}
              </span>
              <div className={`card ${state === 'current' ? 'accent' : ''}`}>
                <div className="row between">
                  <span className="eyebrow">
                    Stage {st.number} · {st.weeksHint}
                  </span>
                  <span className={`badge ${state === 'done' ? 'done' : state === 'current' ? 'accent' : ''}`}>
                    {state === 'done' ? '✓ Done' : state === 'current' ? 'Now' : 'Locked'}
                  </span>
                </div>
                <h2 style={{ margin: '4px 0', fontSize: 22 }}>{st.name}</h2>
                <p className="small" style={{ margin: 0 }}>
                  {st.purpose}
                </p>
                {state === 'current' ? (
                  <CurrentStage d={d} gates={status.gates} onTech={setTech} />
                ) : (
                  <div className="row wrap" style={{ marginTop: 8 }}>
                    <button className="btn quiet" onClick={() => setPreview(st)}>
                      {state === 'locked' ? "What's coming" : 'See workouts'}
                    </button>
                    {state === 'done' && (
                      <button className="btn ghost" onClick={() => setConfirm({ repeat: st })}>
                        Repeat this stage
                      </button>
                    )}
                  </div>
                )}
                {state === 'current' && (
                  <div className="stack" style={{ marginTop: 12 }}>
                    {status.allMet && next && !stayedRecently && (
                      <div className="card soft" style={{ margin: 0 }}>
                        <strong>🎉 Every target hit. Ready for Stage {next.number}: {next.name}.</strong>
                        <div className="grid2" style={{ marginTop: 10 }}>
                          <button className="btn primary" onClick={() => moveUp(next)}>
                            Move up
                          </button>
                          <button className="btn" onClick={() => repo.addEvent('stage-stay', { data: { stageId: cur.id } })}>
                            Stay here longer
                          </button>
                        </div>
                        <button className="btn ghost block" onClick={() => setPreview(next)}>
                          Preview the new workouts
                        </button>
                      </div>
                    )}
                    {status.allMet && next && stayedRecently && (
                      <button className="btn block" onClick={() => moveUp(next)}>
                        Move up to Stage {next.number} when you're ready
                      </button>
                    )}
                    {!status.allMet && offer.offer && next && (
                      <div className="card soft" style={{ margin: 0 }}>
                        <p className="small" style={{ marginTop: 0 }}>
                          {offer.why}
                        </p>
                        <button className="btn block" onClick={() => setConfirm('anyway')}>
                          Move up anyway
                        </button>
                      </div>
                    )}
                    <button className="btn quiet" onClick={() => setPreview(st)}>
                      See this stage's workouts
                    </button>
                    {st.specializations && <Specialization d={d} />}
                    {st.number === 5 && status.allMet && <YearDone d={d} />}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {preview && <StagePreview stage={preview} d={d} onClose={() => setPreview(undefined)} />}
      {tech && <TechniqueCheck exerciseId={tech} onClose={() => setTech(undefined)} />}
      {unlocked && <Unlocked stage={unlocked} onClose={() => setUnlocked(undefined)} onPreview={() => setPreview(unlocked)} />}
      {confirm === 'anyway' && next && (
        <Confirm
          title={`Move up to Stage ${next.number}?`}
          body="Your remaining targets stay visible in your history, and you can always come back to this stage."
          confirmLabel="Move up"
          onCancel={() => setConfirm(undefined)}
          onConfirm={async () => {
            setConfirm(undefined);
            await moveUp(next);
          }}
        />
      )}
      {typeof confirm === 'object' && (
        <Confirm
          title={`Repeat Stage ${confirm.repeat.number}?`}
          body="Your workouts switch back to this stage. Nothing you've logged is lost, and you can move up again any time."
          confirmLabel="Repeat stage"
          onCancel={() => setConfirm(undefined)}
          onConfirm={async () => {
            const st = confirm.repeat;
            setConfirm(undefined);
            await repo.saveSettings({ currentStageId: st.id, stageStartedAt: new Date().toISOString() });
            await repo.addEvent('stage-start', { data: { stageId: st.id, repeat: true } });
          }}
        />
      )}
    </div>
  );
}

function CurrentStage({ d, gates, onTech }: { d: AppData; gates: GateProgress[]; onTech: (id: string) => void }) {
  const unit = d.settings.loadUnit;
  const opt = d.stage.optionalWorkouts?.[0];
  const optOn = optionalUnlocked(d);
  return (
    <div style={{ marginTop: 10 }}>
      <p className="small muted" style={{ margin: '0 0 4px' }}>
        {sessionsInStage(d)} session{sessionsInStage(d) === 1 ? '' : 's'} in this stage so far. {d.stage.number === 5 ? 'Year-one milestones:' : 'To unlock the next stage:'}
      </p>
      {gates.map((g) => {
        const isTech = g.gate.type === 'technique';
        const exId = 'exerciseId' in g.gate ? g.gate.exerciseId : undefined;
        const gex = exId ? exerciseById(exId) : undefined;
        const loadable = gex ? roundToStep(fromKg(g.targetKg ?? 0, unit), stepFor(gex, d.settings), 'up') : 0;
        const abs =
          g.targetKg !== undefined && (g.gate.type === 'lift' || g.gate.type === 'e1rm')
            ? ` (${loadable} ${unit}${g.gate.type === 'lift' ? ` × ${g.gate.reps}` : ''})`
            : '';
        const body = (
          <>
            <div className="gl">
              <span className="small" style={{ fontWeight: 600 }}>
                <span aria-hidden style={{ color: g.met ? 'var(--done)' : 'var(--muted)', marginRight: 6 }}>
                  {g.met ? '✓' : '○'}
                </span>
                {g.label}
                {abs}
              </span>
              <span className={`small ${g.met ? '' : 'muted'}`} style={{ whiteSpace: 'nowrap', color: g.met ? 'var(--done)' : undefined }}>
                {g.met ? 'Done' : isTech ? '' : g.detail.replace(/^.*· /, '')}
              </span>
            </div>
            {!isTech && (
              <div className={`bar ${g.met ? 'done' : ''}`} style={{ marginTop: 6 }} role="progressbar" aria-valuenow={Math.round(g.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={g.label}>
                <span style={{ width: `${g.progress * 100}%` }} />
              </div>
            )}
          </>
        );
        return (
          <div className="gate" key={g.gate.id}>
            {isTech && exId && !g.met ? (
              <button className="list-row" style={{ minHeight: 0, padding: 0, display: 'block' }} onClick={() => onTech(exId)}>
                {body}
                <span className="small" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
                  Tap to do the self-check ›
                </span>
              </button>
            ) : (
              body
            )}
          </div>
        );
      })}
      {gates.some((g) => g.gate.type === 'lift' || g.gate.type === 'e1rm') && (
        <p className="tiny muted">
          Targets use your latest 7-day average body weight. <Term k="bw">Why?</Term>
        </p>
      )}
      {opt && (
        <p className="small" style={{ marginTop: 8 }}>
          <strong>Optional 4th day: {opt.name}.</strong> {optOn ? 'Unlocked! It appears on Today after 3 sessions in a week.' : opt.unlockText}
        </p>
      )}
    </div>
  );
}

function WorkoutList({ w }: { w: WorkoutTemplate }) {
  return (
    <div className="card">
      <div className="row between">
        <strong>{w.name}</strong>
        <span className="small muted">~{w.estMinutes} min</span>
      </div>
      <p className="small muted" style={{ margin: '2px 0 6px' }}>
        {w.description}
      </p>
      <ul className="list">
        {w.slots.map((s, i) => {
          const ex = exerciseById(s.exerciseId)!;
          const range = s.repMin === s.repMax ? `${s.repMin}` : `${s.repMin}–${s.repMax}`;
          const unit = ex.measure === 'seconds' || ex.loadType === 'time' ? ' s' : '';
          return (
            <li key={i}>
              <a className="list-row" href={`#/library/${ex.id}`} style={{ minHeight: 44, padding: '6px 0' }}>
                <span className="grow">{ex.name}</span>
                <span className="small muted">
                  {s.sets} × {range}
                  {unit}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StagePreview({ stage, d, onClose }: { stage: Stage; d: AppData; onClose: () => void }) {
  const gates = evaluateStage(gateContext(d, stage)).gates;
  return (
    <Sheet title={`Stage ${stage.number}: ${stage.name}`} onClose={onClose}>
      <p>{stage.summary}</p>
      <ul className="bullets small">
        {stage.whatsNew.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {allTemplates(stage).map((w) => (
        <WorkoutList key={w.id} w={w} />
      ))}
      <h3>{stage.number === 5 ? 'Year-one milestones' : 'To move on'}</h3>
      <ul className="bullets small">
        {gates.map((g) => (
          <li key={g.gate.id}>{g.label}</li>
        ))}
      </ul>
    </Sheet>
  );
}

function TechniqueCheck({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const ex = exerciseById(exerciseId)!;
  const items = program.techniqueChecks[exerciseId] ?? [];
  const [ticked, setTicked] = useState<boolean[]>(items.map(() => false));
  const all = ticked.every(Boolean);
  return (
    <Sheet title={`Technique check: ${ex.name}`} onClose={onClose}>
      <ExerciseMedia ex={ex} compact />
      <p className="small" style={{ marginTop: 10 }}>
        Read the points, then do a light set (filming yourself from the side helps). Tick the ones you did. <Term k="technique">Why?</Term>
      </p>
      <p className="small">
        <strong>Cue:</strong> {ex.cue}
      </p>
      <div>
        {items.map((it, i) => (
          <label key={i} className="row" style={{ alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <input
              type="checkbox"
              checked={ticked[i]}
              onChange={(e) => setTicked(ticked.map((t, k) => (k === i ? e.target.checked : t)))}
              style={{ width: 24, height: 24, flex: 'none' }}
            />
            <span>{it}</span>
          </label>
        ))}
      </div>
      <a className="btn ghost block" href={`#/library/${ex.id}`}>
        Read the full how-to
      </a>
      <button
        className="btn primary big block"
        disabled={!all}
        onClick={async () => {
          await repo.addEvent('technique-passed', { exerciseId });
          onClose();
        }}
      >
        {all ? 'Passed!' : `Tick all ${items.length} to pass`}
      </button>
      <p className="tiny muted">Not there yet? No problem. Practise with lighter weight and try again another day.</p>
    </Sheet>
  );
}

function Unlocked({ stage, onClose, onPreview }: { stage: Stage; onClose: () => void; onPreview: () => void }) {
  return (
    <Sheet title="Stage unlocked" onClose={onClose}>
      <div className="celebrate">
        <div className="big" aria-hidden>
          🔓
        </div>
        <h2 style={{ fontSize: 30 }}>
          Stage {stage.number}: {stage.name}
        </h2>
        <p>{stage.purpose}</p>
      </div>
      <h3>What's new</h3>
      <ul className="bullets">
        {stage.whatsNew.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <p className="small muted">New exercises start with a quick "find your weight" step, so the first session will feel easy. That's on purpose.</p>
      <div className="stack">
        <button
          className="btn block"
          onClick={() => {
            onClose();
            onPreview();
          }}
        >
          Preview the new workouts
        </button>
        <a className="btn primary big block" href="#/today" onClick={onClose}>
          Let's go
        </a>
      </div>
    </Sheet>
  );
}

function Specialization({ d }: { d: AppData }) {
  const specs = d.stage.specializations ?? [];
  const active = activeSpecialization(d.stage, d.settings, d.today);
  return (
    <div className="card soft" style={{ margin: 0 }}>
      <strong>Specialization block (optional)</strong>
      <p className="small" style={{ margin: '4px 0 8px' }}>
        {active
          ? `${active.name} is on: extra work in every session until ${new Date(Date.parse(d.settings.specialization!.startedAt) + active.weeks * 7 * 86400_000).toLocaleDateString()}.`
          : 'Pick one area to bring up for 4 weeks. It adds two exercises to each session.'}
      </p>
      <div className="stack">
        {specs.map((s) => (
          <button
            key={s.id}
            className={`btn block ${active?.id === s.id ? 'primary' : ''}`}
            onClick={async () => {
              if (active?.id === s.id) await repo.saveSettings({ specialization: undefined });
              else {
                await repo.saveSettings({ specialization: { id: s.id, startedAt: new Date().toISOString() } });
                await repo.addEvent('specialization-start', { data: { id: s.id } });
              }
            }}
          >
            {active?.id === s.id ? `Stop ${s.name}` : s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function YearDone({ d }: { d: AppData }) {
  const total = d.done.length;
  const first = d.done[0];
  const weeks = first ? Math.max(1, Math.round(diffDays(d.today, toDay(first.startedAt)) / 7)) : 0;
  return (
    <div className="card accent" style={{ margin: 0 }}>
      <div className="celebrate" style={{ padding: 8 }}>
        <div className="big" aria-hidden>
          🏆
        </div>
        <h2>{d.settings.year >= 2 ? 'Year two: done!' : 'Year one: done!'}</h2>
      </div>
      <p>
        {total} sessions over {weeks} weeks. You went from never having lifted to genuinely strong. That's rare. Be proud.
      </p>
      {d.settings.year < 2 && (
        <button
          className="btn primary block"
          onClick={async () => {
            await repo.saveSettings({ year: 2 });
            await repo.addEvent('year2-start');
          }}
        >
          Start Year 2
        </button>
      )}
    </div>
  );
}
