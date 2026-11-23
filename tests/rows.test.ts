import { describe, expect, it } from 'vitest';
import { computeRows } from '../src/features/workout/rows';
import { buildSession } from '../src/engine/session';
import { prescribe } from '../src/engine/progression';
import { buildExposures, schemeKey } from '../src/engine/history';
import { DEFAULT_SETTINGS, stageById, mustExercise, schemeOf } from '../src/engine/program';
import type { Feel, SessionRec, SetRec, Settings } from '../src/engine/types';
import { lbToKg, fromKg } from '../src/lib/units';

const s1 = stageById('s1')!;
const settings = { ...DEFAULT_SETTINGS, updatedAt: 0 } as Settings;
const plan = buildSession({ stage: s1, template: s1.workouts[0], settings, preferences: [], exposures: new Map(), bodyWeightKg: 75, sessionsInStage: 0, short: false, mode: 'normal', legsLight: false, today: '2026-11-23' });
const ctx = { unit: 'lb' as const, step: 10, bodyWeightKg: 75 };
const lb = (kg: number) => Math.round(fromKg(kg, 'lb'));
const set = (i: number, w: number, trial: boolean, feel?: Feel, reps = 10): SetRec => ({ id: `s${i}`, sessionId: 'x', exerciseId: 'leg-press', slotIndex: 0, setIndex: i, isWarmup: false, kind: 'work', trial: trial || undefined, targetWeight: lbToKg(w), targetReps: 10, weight: lbToKg(w), reps, feel, completedAt: '', updatedAt: 0 });

describe('workout rows', () => {
  const lp = plan[0];
  it('starts in find-your-weight mode with 2 intro sets', () => {
    expect(lp.calibrate).toBe(true);
    expect(lp.sets).toBe(2);
    const r = computeRows(lp, [], ctx);
    expect(r.calibrating).toBe(true);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].trial).toBe(true);
  });
  it('test sets count as sets: Easy trial → set 2 is a heavier trial', () => {
    const r = computeRows(lp, [set(0, 90, true, 'easy')], ctx);
    expect(r.workDone).toBe(1);
    expect(r.calibrating).toBe(true);
    expect(r.rows[1].n).toBe(2);
    expect(lb(r.rows[1].targetKg)).toBe(110);
  });
  it('unrated trial counts as Solid → found, remaining sets use it', () => {
    const r = computeRows({ ...lp, sets: 3 }, [set(0, 90, true)], ctx);
    expect(r.calibrating).toBe(false);
    expect(r.rows[1].trial).toBe(false);
    expect(lb(r.rows[1].targetKg)).toBe(90);
  });
  it('all planned sets used while testing → exercise done (both counted)', () => {
    const r = computeRows(lp, [set(0, 90, true, 'easy'), set(1, 110, true, 'max')], ctx);
    expect(r.activeIndex).toBeUndefined();
    expect(r.workDone).toBe(2);
  });
  it('a changed weight carries forward to the next sets', () => {
    const cp = plan[1];
    const logged = [{ ...set(0, 70, false, 'solid'), slotIndex: 1, exerciseId: cp.exercise.id }];
    const r = computeRows({ ...cp, calibrate: false, targetWeightKg: lbToKg(60) }, logged, ctx);
    expect(lb(r.rows[1].targetKg)).toBe(70);
  });
  it('next session continues from the last test set when no weight was settled', () => {
    const ses: SessionRec = { id: 'x', workoutTemplateId: 's1-a', stageId: 's1', startedAt: '2026-11-20T07:00:00', status: 'done', isShortVersion: false, isDeload: false, isReentry: false, updatedAt: 1 };
    const exps = buildExposures([ses], [set(0, 90, true, 'easy'), set(1, 110, true, 'easy')], schemeOf).get('leg-press')!;
    const p = prescribe(mustExercise('leg-press'), s1.workouts[0].slots[0], exps, { unit: 'lb', step: 10, barbellStep: 5, bodyWeightKg: 75, mode: 'normal', scheme: schemeKey(8, 12, 'double') });
    expect(p.calibrate).toBe(false);
    expect(lb(p.targetWeightKg)).toBe(120);
  });
  it('test sets do not block progression once a weight is settled', () => {
    const ses: SessionRec = { id: 'x', workoutTemplateId: 's1-a', stageId: 's1', startedAt: '2026-11-20T07:00:00', status: 'done', isShortVersion: false, isDeload: false, isReentry: false, updatedAt: 1 };
    const sets = [set(0, 90, true, 'easy'), set(1, 110, false, 'solid', 12), set(2, 110, false, 'solid', 12)];
    const exps = buildExposures([ses], sets, schemeOf).get('leg-press')!;
    const p = prescribe(mustExercise('leg-press'), s1.workouts[0].slots[0], exps, { unit: 'lb', step: 10, barbellStep: 5, bodyWeightKg: 75, mode: 'normal', scheme: schemeKey(8, 12, 'double') });
    expect(lb(p.targetWeightKg)).toBe(120);
    expect(p.change).toBe('up');
  });
});
