import { describe, expect, it } from 'vitest';
import { computeRows } from '../src/features/workout/rows';
import { buildSession } from '../src/engine/session';
import { DEFAULT_SETTINGS, stageById } from '../src/engine/program';
import type { Feel, SetRec, Settings } from '../src/engine/types';
import { lbToKg, fromKg } from '../src/lib/units';

const s1 = stageById('s1')!;
const settings = { ...DEFAULT_SETTINGS, updatedAt: 0 } as Settings;
const plan = buildSession({ stage: s1, template: s1.workouts[0], settings, preferences: [], exposures: new Map(), bodyWeightKg: 75, sessionsInStage: 0, short: false, mode: 'normal', legsLight: false, today: '2026-11-23' });
const ctx = { unit: 'lb' as const, step: 10, bodyWeightKg: 75 };
const set = (i: number, lb: number, kind: SetRec['kind'], feel: Feel, reps = 10): SetRec => ({ id: `s${i}`, sessionId: 'x', exerciseId: 'leg-press', slotIndex: 0, setIndex: i, isWarmup: kind !== 'work', kind, targetWeight: lbToKg(lb), targetReps: 10, weight: lbToKg(lb), reps, feel, completedAt: '', updatedAt: 0 });

describe('workout rows', () => {
  const lp = plan[0];
  it('starts in calibration mode with 2 intro sets', () => {
    expect(lp.calibrate).toBe(true);
    expect(lp.sets).toBe(2);
    const r = computeRows(lp, [], ctx);
    expect(r.calibrating).toBe(true);
    expect(r.rows).toHaveLength(1);
  });
  it('Easy trial → heavier next trial', () => {
    const r = computeRows(lp, [set(0, 90, 'calibration', 'easy')], ctx);
    expect(r.calibrating).toBe(true);
    expect(Math.round(fromKg(r.rows[1].targetKg, 'lb'))).toBe(110);
  });
  it('after the working weight is found, the remaining sets use it', () => {
    const r = computeRows(lp, [set(0, 90, 'calibration', 'easy'), set(1, 110, 'work', 'solid')], ctx);
    expect(r.calibrating).toBe(false);
    expect(r.workDone).toBe(1);
    const next = r.rows[r.activeIndex!];
    expect(Math.round(fromKg(next.targetKg, 'lb'))).toBe(110);
  });
  it('a changed weight carries forward to the next sets', () => {
    const cp = plan[1];
    const logged = [{ ...set(0, 70, 'work', 'solid'), slotIndex: 1, exerciseId: cp.exercise.id }];
    const r = computeRows({ ...cp, calibrate: false, targetWeightKg: lbToKg(60) }, logged, ctx);
    expect(Math.round(fromKg(r.rows[1].targetKg, 'lb'))).toBe(70);
  });
});
