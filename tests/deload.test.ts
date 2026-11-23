import { describe, expect, it } from 'vitest';
import { evaluateDeload, isStalled, continuousWeeks, deloadActive, type DeloadInput } from '../src/engine/deload';
import { buildExposures } from '../src/engine/history';
import { mustExercise, schemeOf } from '../src/engine/program';
import type { EventRec } from '../src/engine/types';
import { collect, session } from './helpers';
import { addDays } from '../src/lib/dates';

const lp = mustExercise('leg-press');
const cp = mustExercise('chest-press-machine');
const TODAY = '2026-11-23';

function input(list: ReturnType<typeof session>[], over: Partial<DeloadInput> = {}): DeloadInput {
  const data = collect(list);
  const exps = buildExposures(data.sessions, data.sets, schemeOf);
  return {
    today: TODAY,
    mainExposures: [lp, cp].map((ex) => ({ ex, exposures: exps.get(ex.id) ?? [] })),
    recentSets: data.sets.map((s) => ({ ...s, day: s.completedAt.slice(0, 10) })),
    events: [],
    liftDays: data.sessions.map((s) => s.startedAt.slice(0, 10)),
    everyWeeks: 8,
    ...over,
  };
}
const stuck = (d: string) =>
  session(d, 's1-a', [
    { ex: 'leg-press', lb: 200, reps: [10, 9, 8] },
    { ex: 'chest-press-machine', lb: 100, reps: [10, 9, 8] },
  ]);

describe('deload', () => {
  it('two main lifts stalled across two exposures → suggest', () => {
    const r = evaluateDeload(input([stuck('2026-11-16'), stuck('2026-11-18'), stuck('2026-11-20')]));
    expect(r.suggest).toBe(true);
    expect(r.trigger).toBe('stall');
  });
  it('progress on reps means not stalled', () => {
    const list = [10, 11, 12].map((r, i) => session(addDays('2026-11-16', i * 2), 's1-a', [{ ex: 'leg-press', lb: 200, reps: [r, r, r] }]));
    expect(isStalled(lp, buildExposures(collect(list).sessions, collect(list).sets).get('leg-press')!)).toBe(false);
  });
  it('≥ 50% of the week’s sets rated Max → suggest', () => {
    const s = session('2026-11-20', 's1-a', [{ ex: 'leg-press', lb: 200, reps: [10, 10, 10, 10, 10, 10], feel: 'max' }]);
    expect(evaluateDeload(input([s])).trigger).toBe('max');
  });
  it('pain twice in 7 days → suggest', () => {
    const events: EventRec[] = [
      { id: 'a', type: 'pain', date: '2026-11-18T07:00:00', updatedAt: 1 },
      { id: 'b', type: 'pain', date: '2026-11-21T07:00:00', updatedAt: 1 },
    ];
    expect(evaluateDeload(input([], { events })).trigger).toBe('pain');
  });
  it('~8 weeks of continuous training → calendar suggestion; a 7-day gap resets it', () => {
    const days = Array.from({ length: 30 }, (_, i) => addDays('2026-09-24', i * 2 + (i % 2)));
    expect(continuousWeeks(days, TODAY)).toBeGreaterThanOrEqual(8);
    const r = evaluateDeload(input([], { liftDays: days }));
    expect(r.trigger).toBe('calendar');
    const gap = [...days.filter((d) => d < '2026-10-20'), ...days.filter((d) => d > '2026-10-30')];
    expect(continuousWeeks(gap, TODAY)).toBeLessThan(8);
  });
  it('dismissed recently → quiet for a week; accepted → active for 7 days', () => {
    const events: EventRec[] = [{ id: 'd', type: 'deload-dismissed', date: '2026-11-20T07:00:00', updatedAt: 1 }];
    expect(evaluateDeload(input([stuck('2026-11-16'), stuck('2026-11-18'), stuck('2026-11-20')], { events })).suggest).toBe(false);
    const acc: EventRec[] = [{ id: 'a', type: 'deload-accepted', date: '2026-11-20T07:00:00', updatedAt: 1 }];
    expect(deloadActive(acc, TODAY)).toBe(true);
    expect(deloadActive(acc, '2026-11-28')).toBe(false);
  });
});
