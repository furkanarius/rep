import { describe, expect, it } from 'vitest';
import { prescribe, nextCalibration, warmupsFor, type ProgressionContext } from '../src/engine/progression';
import { buildExposures, schemeKey } from '../src/engine/history';
import { mustExercise, schemeOf } from '../src/engine/program';
import type { Slot } from '../src/engine/types';
import { fromKg, lbToKg } from '../src/lib/units';
import { collect, session } from './helpers';

const slot = (ex: string, sets = 3, repMin = 8, repMax = 12, progression: Slot['progression'] = 'double'): Slot => ({
  exerciseId: ex,
  role: 'main',
  sets,
  repMin,
  repMax,
  progression,
});
const ctx = (over: Partial<ProgressionContext> = {}): ProgressionContext => ({
  unit: 'lb',
  step: 10,
  barbellStep: 5,
  bodyWeightKg: 75,
  mode: 'normal',
  scheme: schemeKey(8, 12, 'double'),
  ...over,
});
const lb = (kg: number) => Math.round(fromKg(kg, 'lb') * 100) / 100;

function exposuresFor(list: ReturnType<typeof session>[], ex: string) {
  const { sessions, sets } = collect(list);
  return buildExposures(sessions, sets, schemeOf).get(ex) ?? [];
}

describe('double progression', () => {
  const legPress = mustExercise('leg-press');
  it('adds one increment when every set hit the top of the range at Solid', () => {
    const exp = exposuresFor([session('2026-11-02', 's1-a', [{ ex: 'leg-press', lb: 90, reps: [12, 12, 12] }])], 'leg-press');
    const p = prescribe(legPress, slot('leg-press'), exp, ctx());
    expect(lb(p.targetWeightKg)).toBe(100);
    expect(p.targetReps).toBe(8);
    expect(p.change).toBe('up');
    expect(p.reason).toBe('Up 10 lb: you hit 12 reps on every set last time.');
  });
  it('holds weight if a top set was rated Max', () => {
    const exp = exposuresFor(
      [session('2026-11-02', 's1-a', [{ ex: 'leg-press', lb: 90, reps: [12, 12, 12], feel: ['solid', 'solid', 'max'] }])],
      'leg-press',
    );
    const p = prescribe(legPress, slot('leg-press'), exp, ctx());
    expect(lb(p.targetWeightKg)).toBe(90);
    expect(p.change).toBe('same');
  });
  it('asks for one more rep when inside the range', () => {
    const exp = exposuresFor([session('2026-11-02', 's1-a', [{ ex: 'leg-press', lb: 90, reps: [10, 9, 9] }])], 'leg-press');
    const p = prescribe(legPress, slot('leg-press'), exp, ctx());
    expect(lb(p.targetWeightKg)).toBe(90);
    expect(p.targetReps).toBe(10);
    expect(p.change).toBe('more-reps');
  });
  it('failed sets: repeat once, then step back after two failures at the same weight', () => {
    const one = exposuresFor([session('2026-11-02', 's1-a', [{ ex: 'leg-press', lb: 100, reps: [8, 7, 6], feel: 'max' }])], 'leg-press');
    expect(prescribe(legPress, slot('leg-press'), one, ctx()).change).toBe('same');
    const two = exposuresFor(
      [
        session('2026-11-02', 's1-a', [{ ex: 'leg-press', lb: 100, reps: [8, 7, 6], feel: 'max' }]),
        session('2026-11-05', 's1-a', [{ ex: 'leg-press', lb: 100, reps: [8, 6, 6], feel: 'max' }]),
      ],
      'leg-press',
    );
    const p = prescribe(legPress, slot('leg-press'), two, ctx());
    expect(p.change).toBe('down');
    expect(lb(p.targetWeightKg)).toBe(90);
  });
  it('first time ever → calibration flow from a conservative start weight', () => {
    const p = prescribe(legPress, slot('leg-press'), [], ctx());
    expect(p.calibrate).toBe(true);
    expect(lb(p.targetWeightKg)).toBe(90);
    expect(p.targetReps).toBe(10);
  });
  it('uses the onboarding weight instead of calibrating', () => {
    const p = prescribe(legPress, slot('leg-press'), [], ctx({ startingWeightKg: lbToKg(140) }));
    expect(p.calibrate).toBe(false);
    expect(lb(p.targetWeightKg)).toBe(140);
  });
  it('ignores deload and re-entry sessions when progressing', () => {
    const exp = exposuresFor(
      [
        session('2026-11-02', 's1-a', [{ ex: 'leg-press', lb: 150, reps: [10, 10, 10] }]),
        session('2026-11-20', 's1-a', [{ ex: 'leg-press', lb: 90, reps: [12, 12] }], { isDeload: true }),
      ],
      'leg-press',
    );
    const p = prescribe(legPress, slot('leg-press'), exp, ctx());
    expect(lb(p.targetWeightKg)).toBe(150);
    expect(p.targetReps).toBe(11);
  });
});

describe('special load types', () => {
  it('assisted: progress means LESS assistance', () => {
    const ex = mustExercise('assisted-pull-up');
    const exp = exposuresFor([session('2026-11-02', 's2-b', [{ ex: 'assisted-pull-up', lb: 70, reps: [10, 10, 10], slot: 2 }])], ex.id);
    const p = prescribe(ex, slot(ex.id, 3, 6, 10), exp, ctx({ scheme: schemeKey(6, 10, 'double') }));
    expect(lb(p.targetWeightKg)).toBe(60);
    expect(p.reason).toMatch(/less help/);
  });
  it('bodyweight core moves top out instead of adding load', () => {
    const ex = mustExercise('dead-bug');
    const exp = exposuresFor([session('2026-11-02', 's1-b', [{ ex: 'dead-bug', lb: 0, reps: [10, 10], slot: 6 }])], ex.id);
    const p = prescribe(ex, slot(ex.id, 2, 6, 10), exp, ctx({ scheme: schemeKey(6, 10, 'double') }));
    expect(p.change).toBe('topped-out');
    expect(p.targetWeightKg).toBe(0);
  });
  it('timed holds progress in seconds', () => {
    const ex = mustExercise('plank');
    const exp = exposuresFor([session('2026-11-02', 's1-a', [{ ex: 'plank', lb: 0, reps: [30, 25], slot: 5 }])], ex.id);
    const p = prescribe(ex, slot(ex.id, 2, 20, 45), exp, ctx({ scheme: schemeKey(20, 45, 'double') }));
    expect(p.targetReps).toBe(30);
    expect(p.measure).toBe('seconds');
  });
});

describe('linear progression (Stage 3)', () => {
  const squat = mustExercise('barbell-back-squat');
  const bench = mustExercise('bench-press');
  const lin = (ex: string) => slot(ex, 3, 5, 5, 'linear');
  const c = ctx({ step: 5, scheme: schemeKey(5, 5, 'linear') });
  it('+10 lb for legs, +5 lb for upper body after a successful session', () => {
    const s = exposuresFor([session('2026-11-02', 's3-a', [{ ex: squat.id, lb: 135, reps: [5, 5, 5] }])], squat.id);
    expect(lb(prescribe(squat, lin(squat.id), s, c).targetWeightKg)).toBe(145);
    const b = exposuresFor([session('2026-11-02', 's3-a', [{ ex: bench.id, lb: 95, reps: [5, 5, 5], slot: 1 }])], bench.id);
    expect(lb(prescribe(bench, lin(bench.id), b, c).targetWeightKg)).toBe(100);
  });
  it('one failed session → repeat; two in a row → 10% reset', () => {
    const one = exposuresFor([session('2026-11-02', 's3-a', [{ ex: squat.id, lb: 185, reps: [5, 4, 3] }])], squat.id);
    expect(lb(prescribe(squat, lin(squat.id), one, c).targetWeightKg)).toBe(185);
    const two = exposuresFor(
      [
        session('2026-11-02', 's3-a', [{ ex: squat.id, lb: 185, reps: [5, 4, 3] }]),
        session('2026-11-06', 's3-a', [{ ex: squat.id, lb: 185, reps: [5, 5, 3] }]),
      ],
      squat.id,
    );
    const p = prescribe(squat, lin(squat.id), two, c);
    expect(p.change).toBe('reset');
    expect(lb(p.targetWeightKg)).toBe(165); // 166.5 rounded down to 5
  });
  it('after a reset, old failures at the heavier weight do not count again', () => {
    const exps = exposuresFor(
      [
        session('2026-11-02', 's3-a', [{ ex: squat.id, lb: 185, reps: [5, 4, 3] }]),
        session('2026-11-06', 's3-a', [{ ex: squat.id, lb: 185, reps: [5, 5, 3] }]),
        session('2026-11-09', 's3-a', [{ ex: squat.id, lb: 165, reps: [5, 5, 4] }]),
      ],
      squat.id,
    );
    expect(prescribe(squat, lin(squat.id), exps, c).change).toBe('same');
  });
  it('new rep range (stage change) derives the weight from e1RM', () => {
    const exps = exposuresFor([session('2026-11-02', 's3-a', [{ ex: squat.id, lb: 200, reps: [5, 5, 5] }])], squat.id);
    const p = prescribe(squat, slot(squat.id, 4, 4, 6), exps, ctx({ step: 5, scheme: schemeKey(4, 6, 'double') }));
    expect(p.change).toBe('from-e1rm');
    expect(lb(p.targetWeightKg)).toBeLessThanOrEqual(200);
    expect(lb(p.targetWeightKg)).toBeGreaterThan(170);
  });
});

describe('modifiers', () => {
  const legPress = mustExercise('leg-press');
  const exp = exposuresFor([session('2026-11-02', 's1-a', [{ ex: 'leg-press', lb: 200, reps: [10, 10, 10] }])], 'leg-press');
  it('deload: ~60% and 2 sets', () => {
    const p = prescribe(legPress, slot('leg-press'), exp, ctx({ mode: 'deload' }));
    expect(p.sets).toBe(2);
    expect(lb(p.targetWeightKg)).toBe(120);
  });
  it('re-entry: ~85% and 2 sets', () => {
    const p = prescribe(legPress, slot('leg-press'), exp, ctx({ mode: 'reentry', reentryFactor: 0.85 }));
    expect(p.sets).toBe(2);
    expect(lb(p.targetWeightKg)).toBe(170);
  });
  it('long ride tomorrow: legs hold weight for 2 sets', () => {
    const p = prescribe(legPress, slot('leg-press'), exp, ctx({ legsLight: true }));
    expect(p.sets).toBe(2);
    expect(lb(p.targetWeightKg)).toBe(200);
    expect(p.change).toBe('legs-light');
  });
  it('kg users get kg increments', () => {
    const kgExp = exposuresFor([session('2026-11-02', 's1-a', [{ ex: 'leg-press', lb: 80, kg: true, reps: [12, 12, 12] }])], 'leg-press');
    const p = prescribe(legPress, slot('leg-press'), kgExp, ctx({ unit: 'kg', step: 5 }));
    expect(p.targetWeightKg).toBeCloseTo(85, 6);
    expect(p.reason).toBe('Up 5 kg: you hit 12 reps on every set last time.');
  });
});

describe('warm-ups and calibration', () => {
  it('barbell warm-ups: empty bar, ~50%, ~75%', () => {
    const w = warmupsFor(mustExercise('barbell-back-squat'), lbToKg(185), ctx({ step: 5 }));
    expect(w.map((x) => Math.round(fromKg(x.weightKg, 'lb')))).toEqual([45, 90, 135]);
    expect(w.map((x) => x.reps)).toEqual([10, 5, 3]);
  });
  it('no warm-ups below the bar', () => {
    expect(warmupsFor(mustExercise('bench-press'), lbToKg(45), ctx({ step: 5 }))).toEqual([]);
  });
  it('calibration: Easy jumps up, Max drops, Solid locks in', () => {
    const ex = mustExercise('leg-press');
    const c = { unit: 'lb' as const, step: 10, bodyWeightKg: 75 };
    const up = nextCalibration(ex, lbToKg(90), 'easy', 10, 10, 1, c);
    expect(up.done).toBe(false);
    expect(lb(up.nextKg)).toBe(110);
    const down = nextCalibration(ex, lbToKg(110), 'max', 10, 10, 2, c);
    expect(lb(down.nextKg)).toBe(90);
    const ok = nextCalibration(ex, lbToKg(100), 'solid', 10, 10, 3, c);
    expect(ok.done).toBe(true);
    const missed = nextCalibration(ex, lbToKg(100), 'solid', 7, 10, 1, c);
    expect(missed.done).toBe(false);
  });
});
