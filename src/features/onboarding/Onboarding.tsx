// First run: four quick steps, every one skippable. Under 60 seconds to the Today screen.
import { useState } from 'react';
import * as repo from '../../db/repo';
import { stageById, exerciseById, stepFor, DEFAULT_SETTINGS } from '../../engine/program';
import { toKg, lengthToCm } from '../../lib/units';
import { toDay, WEEKDAY_SHORT } from '../../lib/dates';
import type { Settings } from '../../engine/types';
import { go } from '../../app/router';

type Step = 0 | 1 | 2 | 3;

export function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const [loadUnit, setLoadUnit] = useState<'lb' | 'kg'>('lb');
  const [bodyUnit, setBodyUnit] = useState<'kg' | 'lb'>('kg');
  const [lengthUnit, setLengthUnit] = useState<'cm' | 'in'>('cm');
  const [weight, setWeight] = useState('75');
  const [height, setHeight] = useState('176');
  const [navel, setNavel] = useState('97.5');
  const [narrow, setNarrow] = useState('93');
  const [target, setTarget] = useState(3);
  const [time, setTime] = useState<Settings['preferredTime']>('morning');
  const [rideDays, setRideDays] = useState<number[]>([6]);
  const [exp, setExp] = useState<'never' | 'some'>('never');
  const [prior, setPrior] = useState('4');
  const [weights, setWeights] = useState<Record<string, string>>({});

  const finish = async () => {
    const num = (s: string) => {
      const v = parseFloat(s.replace(',', '.'));
      return Number.isFinite(v) && v > 0 ? v : undefined;
    };
    await repo.saveSettings({
      loadUnit,
      bodyUnit,
      lengthUnit,
      targetPerWeek: target,
      preferredTime: time,
      longRideDays: rideDays,
      heightCm: num(height) ? lengthToCm(num(height)!, lengthUnit) : DEFAULT_SETTINGS.heightCm,
      priorStage1Sessions: exp === 'some' ? Math.min(40, Math.round(num(prior) ?? 0)) : 0,
      onboardingDone: true,
      currentStageId: 's1',
      stageStartedAt: new Date().toISOString(),
    });
    const w = num(weight);
    if (w || num(navel) || num(narrow)) {
      await repo.addBody({
        date: toDay(new Date()),
        weightKg: w ? toKg(w, bodyUnit) : undefined,
        waistNavelCm: num(navel) ? lengthToCm(num(navel)!, lengthUnit) : undefined,
        waistNarrowCm: num(narrow) ? lengthToCm(num(narrow)!, lengthUnit) : undefined,
      });
    }
    if (exp === 'some') {
      for (const [id, v] of Object.entries(weights)) {
        const n = num(v);
        if (n) await repo.setPreference(id, { startingWeightKg: toKg(n, loadUnit) });
      }
    }
    await repo.addEvent('stage-start', { data: { stageId: 's1' } });
    go('today');
  };

  const next = () => (step < 3 ? setStep((step + 1) as Step) : finish());
  const s1 = stageById('s1')!;
  const s1Exercises = [...new Set(s1.workouts.flatMap((w) => w.slots.map((s) => s.exerciseId)))]
    .map((id) => exerciseById(id)!)
    .filter((e) => e.loadType !== 'time' && e.loadType !== 'bodyweight');

  return (
    <div className="onb">
      <div className="row between">
        <span className="sr-only">Step {step + 1} of 4</span>
        <div className="dots" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <button className="btn ghost" onClick={finish}>
          Skip setup
        </button>
      </div>

      <div className="grow">
        {step === 0 && (
          <>
            <h1 className="display" style={{ fontSize: 44, margin: '24px 0 4px', textTransform: 'uppercase' }}>
              Hi. I'm Rep.
            </h1>
            <p className="muted">
              Your strength coach. Each day I'll tell you what to do, and you log it with one tap. Four quick questions first.
            </p>
            <h2>Units</h2>
            <Field label="Gym weights">
              <Seg value={loadUnit} options={['lb', 'kg']} onChange={setLoadUnit} />
            </Field>
            <Field label="Body weight">
              <Seg value={bodyUnit} options={['kg', 'lb']} onChange={setBodyUnit} />
            </Field>
            <Field label="Measurements">
              <Seg value={lengthUnit} options={['cm', 'in']} onChange={setLengthUnit} />
            </Field>
          </>
        )}
        {step === 1 && (
          <>
            <h2>Your body</h2>
            <p className="muted small">All optional. Strength targets scale with your body weight, so this makes them fit you.</p>
            <label className="field">
              <span>Weight ({bodyUnit})</span>
              <input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <label className="field">
              <span>Height ({lengthUnit})</span>
              <input className="input" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
            </label>
            <div className="grid2">
              <label className="field">
                <span>Waist at navel ({lengthUnit})</span>
                <input className="input" inputMode="decimal" value={navel} onChange={(e) => setNavel(e.target.value)} />
              </label>
              <label className="field">
                <span>Waist, narrowest ({lengthUnit})</span>
                <input className="input" inputMode="decimal" value={narrow} onChange={(e) => setNarrow(e.target.value)} />
              </label>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Your week</h2>
            <Field label="Lifting sessions per week">
              <div className="seg">
                {[2, 3, 4].map((n) => (
                  <button key={n} aria-pressed={target === n} onClick={() => setTarget(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <p className="small muted">Busy week? Fewer is fine. The plan just takes a bit longer, and nothing is lost.</p>
            <Field label="Usual training time">
              <div className="seg">
                {(['morning', 'midday', 'evening'] as const).map((t) => (
                  <button key={t} aria-pressed={time === t} onClick={() => setTime(t)}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Days you usually do a long ride">
              <div className="chips">
                {WEEKDAY_SHORT.map((w, i) => (
                  <button
                    key={w}
                    className="chip"
                    style={{ minWidth: 48, justifyContent: 'center', padding: 0 }}
                    aria-pressed={rideDays.includes(i + 1)}
                    onClick={() => setRideDays(rideDays.includes(i + 1) ? rideDays.filter((x) => x !== i + 1) : [...rideDays, i + 1])}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </Field>
            <p className="small muted">I'll keep heavy leg days away from them.</p>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Experience</h2>
            <div className="stack">
              <button className={`btn block ${exp === 'never' ? 'primary' : ''}`} onClick={() => setExp('never')}>
                I've never lifted
              </button>
              <button className={`btn block ${exp === 'some' ? 'primary' : ''}`} onClick={() => setExp('some')}>
                I've done a few sessions of the A/B plan
              </button>
            </div>
            {exp === 'never' ? (
              <p className="muted small" style={{ marginTop: 12 }}>
                Perfect. The first time you do each exercise, I'll help you find the right weight.
              </p>
            ) : (
              <>
                <label className="field">
                  <span>How many sessions have you done?</span>
                  <input className="input" inputMode="numeric" value={prior} onChange={(e) => setPrior(e.target.value)} />
                </label>
                <p className="small muted">Optional: your latest weights ({loadUnit}). Leave blank and I'll help you find them.</p>
                {s1Exercises.map((e) => (
                  <label className="row" key={e.id} style={{ margin: '6px 0' }}>
                    <span className="grow small">{e.name}</span>
                    <input
                      className="input"
                      style={{ width: 110 }}
                      inputMode="decimal"
                      placeholder={`step ${stepFor(e, { loadUnit, incrementsLb: DEFAULT_SETTINGS.incrementsLb, incrementsKg: DEFAULT_SETTINGS.incrementsKg })}`}
                      aria-label={`${e.name} weight in ${loadUnit}`}
                      value={weights[e.id] ?? ''}
                      onChange={(ev) => setWeights({ ...weights, [e.id]: ev.target.value })}
                    />
                  </label>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div className="row" style={{ marginTop: 20 }}>
        {step > 0 && (
          <button className="btn" onClick={() => setStep((step - 1) as Step)}>
            Back
          </button>
        )}
        <button className="btn primary big grow" onClick={next}>
          {step < 3 ? 'Next' : "Let's go"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o} aria-pressed={value === o} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
