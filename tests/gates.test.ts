import { describe, expect, it } from 'vitest';
import { evaluateStage, evaluateGate, bodyWeight7d, moveUpAnyway, consistencyWeeks, type GateContext } from '../src/engine/gates';
import { exerciseById, stageById } from '../src/engine/program';
import type { EventRec, Gate } from '../src/engine/types';
import { collect, session } from './helpers';
import { addDays } from '../src/lib/dates';

const s1 = stageById('s1')!;
const ctxOf = (over: Partial<GateContext>): GateContext => ({
  today: '2026-11-23',
  stage: s1,
  sessions: [],
  sets: [],
  events: [],
  bodyWeightKg: 75,
  unit: 'lb',
  exercise: exerciseById,
  ...over,
});

describe('gates', () => {
  it('lift gate uses body weight and shows an absolute target', () => {
    const gate = s1.gates.find((g) => g.id === 's1-legpress')!;
    const { sessions, sets } = collect([session('2026-11-20', 's1-a', [{ ex: 'leg-press', lb: 250, reps: [10, 10, 9] }])]);
    const g = evaluateGate(gate, ctxOf({ sessions, sets }));
    expect(g.met).toBe(true); // 1.5 × 75 kg = 112.5 kg = 248 lb
    expect(g.targetKg).toBeCloseTo(112.5);
    const light = collect([session('2026-11-20', 's1-a', [{ ex: 'leg-press', lb: 200, reps: [10, 10, 10] }])]);
    const g2 = evaluateGate(gate, ctxOf(light));
    expect(g2.met).toBe(false);
    expect(g2.progress).toBeGreaterThan(0.7);
    expect(g2.detail).toMatch(/248 lb × 10/);
  });
  it('recomputes targets when body weight changes', () => {
    const gate = s1.gates.find((g) => g.id === 's1-legpress')!;
    const data = collect([session('2026-11-20', 's1-a', [{ ex: 'leg-press', lb: 250, reps: [10] }])]);
    expect(evaluateGate(gate, ctxOf({ ...data, bodyWeightKg: 80 })).met).toBe(false);
  });
  it('accepts listed equivalents (substitutions keep progress)', () => {
    const gate: Gate = { id: 'x', type: 'lift', exerciseId: 'deadlift', ratio: 1.25, reps: 5, accept: [{ exerciseId: 'trap-bar-deadlift', factor: 1 }] };
    const data = collect([session('2026-11-20', 's3-b', [{ ex: 'trap-bar-deadlift', lb: 210, reps: [5, 5] }])]);
    expect(evaluateGate(gate, ctxOf(data)).met).toBe(true);
  });
  it('warm-ups and unfinished sessions never count', () => {
    const gate = s1.gates.find((g) => g.id === 's1-legpress')!;
    const data = collect([session('2026-11-20', 's1-a', [{ ex: 'leg-press', lb: 300, reps: [10] }], { status: 'in_progress' })]);
    expect(evaluateGate(gate, ctxOf(data)).met).toBe(false);
  });
  it('sessions gate counts prior sessions from onboarding in Stage 1', () => {
    const gate = s1.gates[0];
    expect(evaluateGate(gate, ctxOf({ priorSessions: 5 })).detail).toBe('5/16');
  });
  it('consistency: weeks with ≥ 2 sessions in the last 6', () => {
    const days = ['2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22', '2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12', '2026-11-17', '2026-11-19'];
    expect(consistencyWeeks(days, '2026-11-23', 2, 6)).toBe(4);
  });
  it('assisted pull-up gate: ≤ 40% BW assistance, or 1 strict pull-up', () => {
    const s2 = stageById('s2')!;
    const gate = s2.gates.find((g) => g.type === 'assist')!;
    const assisted = collect([session('2026-11-20', 's2-b', [{ ex: 'assisted-pull-up', lb: 60, reps: [6, 6, 6], slot: 2 }])]);
    expect(evaluateGate(gate, ctxOf({ ...assisted, stage: s2 })).met).toBe(true); // 60 lb ≤ 66 lb
    const strict = collect([session('2026-11-20', 's3-b', [{ ex: 'pull-up', lb: 0, reps: [1] }])]);
    expect(evaluateGate(gate, ctxOf({ ...strict, stage: s2 })).met).toBe(true);
  });
  it('technique gate is met by a passed self-check event', () => {
    const gate = s1.gates.find((g) => g.type === 'technique')!;
    const ev: EventRec = { id: 'e', type: 'technique-passed', date: '2026-11-20T07:00:00Z', exerciseId: 'goblet-squat', updatedAt: 1 };
    expect(evaluateGate(gate, ctxOf({ events: [ev] })).met).toBe(true);
  });
  it('stage unlocks only when every gate is met, driven by performance not dates', () => {
    const list = [];
    let day = '2026-09-28'; // Monday
    for (let w = 0; w < 8; w++) {
      for (const off of [0, 2, 4]) {
        const d = addDays(day, off);
        list.push(
          session(d, off === 2 ? 's1-b' : 's1-a', [
            { ex: 'leg-press', lb: 250, reps: [10, 10, 10] },
            { ex: 'lat-pulldown', lb: 100, reps: [10, 10, 10] },
            { ex: 'chest-press-machine', lb: 100, reps: [10, 10, 10] },
            { ex: 'goblet-squat', lb: 60, reps: [10, 10, 10] },
          ]),
        );
      }
      day = addDays(day, 7);
    }
    const data = collect(list);
    const noTech = evaluateStage(ctxOf({ ...data }));
    expect(noTech.allMet).toBe(false);
    expect(noTech.total - noTech.metCount).toBe(2);
    const events: EventRec[] = ['goblet-squat', 'dumbbell-rdl'].map((exerciseId) => ({ id: exerciseId, type: 'technique-passed', date: '2026-11-20', exerciseId, updatedAt: 1 }));
    expect(evaluateStage(ctxOf({ ...data, events })).allMet).toBe(true);
  });
  it('"Move up anyway" after 6+ weeks stuck with most gates met', () => {
    const list = [];
    let day = '2026-08-03';
    for (let w = 0; w < 14; w++) {
      for (const off of [0, 2]) list.push(session(addDays(day, off), 's1-a', [{ ex: 'leg-press', lb: 250, reps: [10] }, { ex: 'lat-pulldown', lb: 100, reps: [10] }, { ex: 'chest-press-machine', lb: 100, reps: [10] }]));
      day = addDays(day, 7);
    }
    const events: EventRec[] = ['goblet-squat', 'dumbbell-rdl'].map((exerciseId) => ({ id: exerciseId, type: 'technique-passed', date: '2026-08-20', exerciseId, updatedAt: 1 }));
    const data = collect(list);
    const res = moveUpAnyway(ctxOf({ ...data, events, today: '2026-11-09' }));
    expect(res.offer).toBe(true);
  });
});

describe('body weight', () => {
  it('uses the latest 7-day average', () => {
    const m = [
      { id: '1', date: '2026-11-01', weightKg: 78, updatedAt: 1 },
      { id: '2', date: '2026-11-18', weightKg: 76, updatedAt: 1 },
      { id: '3', date: '2026-11-20', weightKg: 75, updatedAt: 1 },
      { id: '4', date: '2026-11-22', weightKg: 74, updatedAt: 1 },
    ];
    expect(bodyWeight7d(m)).toBeCloseTo(75);
    expect(bodyWeight7d([], 75)).toBe(75);
  });
});
