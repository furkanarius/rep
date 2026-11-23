import { describe, expect, it } from 'vitest';
import { recommend, planWeek, nextTemplateId, computeReentry, weekStreak, upcoming, type SchedulerInput, type LiftLog } from '../src/engine/scheduler';
import { stageById } from '../src/engine/program';
import { buildIcs } from '../src/engine/ics';

// 2026-11-23 is a Monday.
const MON = '2026-11-23';
const s1 = stageById('s1')!;
const s4 = stageById('s4')!;
const info = (st: typeof s1) => st.workouts.map((w) => ({ id: w.id, name: w.name, focus: w.focus, lowerHeavy: w.lowerHeavy, estMinutes: w.estMinutes }));

const base = (over: Partial<SchedulerInput> = {}): SchedulerInput => ({
  today: MON,
  lifts: [],
  rides: [],
  targetPerWeek: 3,
  longRideDays: [6],
  preferredTime: 'morning',
  stageId: 's1',
  split: 'full',
  workouts: info(s1),
  ...over,
});
const lift = (day: string, templateId = 's1-a', extra: Partial<LiftLog> = {}): LiftLog => ({
  day,
  templateId,
  focus: 'full',
  lowerHeavy: true,
  stageId: 's1',
  ...extra,
});

describe('rotation', () => {
  it('rotates by order, never by weekday', () => {
    expect(nextTemplateId([], info(s1), 's1')).toBe('s1-a');
    expect(nextTemplateId([lift('2026-11-20', 's1-a')], info(s1), 's1')).toBe('s1-b');
    expect(nextTemplateId([lift('2026-11-18', 's1-a'), lift('2026-11-20', 's1-b')], info(s1), 's1')).toBe('s1-a');
  });
  it('a new stage starts at its first workout', () => {
    expect(nextTemplateId([lift('2026-11-20', 's1-a')], info(s4), 's4')).toBe('s4-ua');
  });
});

describe('recommendation', () => {
  it('first session ever: lift today, Workout A', () => {
    const r = recommend(base());
    expect(r.kind).toBe('lift');
    expect(r.templateId).toBe('s1-a');
    expect(r.reason).toMatch(/First session/);
  });
  it('lifted yesterday (full body) and week not urgent → rest, next lift tomorrow', () => {
    const r = recommend(base({ today: '2026-11-24', lifts: [lift(MON)] }));
    expect(r.kind).toBe('rest');
    expect(r.reason).toMatch(/You lifted yesterday/);
    expect(r.nextLift?.day).toBe('2026-11-25');
    expect(r.reason).toMatch(/Next lift: tomorrow morning \(Workout B\)/);
  });
  it('2 days since last lift → lift with a one-line reason', () => {
    const r = recommend(base({ today: '2026-11-25', lifts: [lift(MON)] }));
    expect(r.kind).toBe('lift');
    expect(r.templateId).toBe('s1-b');
    expect(r.reason).toMatch(/Last session was 2 days ago; legs are recovered; no long ride tomorrow/);
  });
  it('never 3 days in a row, even when behind', () => {
    const r = recommend(base({ today: '2026-11-28', lifts: [lift('2026-11-26'), lift('2026-11-27', 's1-b')], targetPerWeek: 4 }));
    expect(r.kind).toBe('rest');
  });
  it('back-to-back allowed only when the week requires it, as the short version (full body)', () => {
    // Sunday: done Wed + Sat, target 3 → Sunday is the last chance, so a short back-to-back is OK.
    const r = recommend(base({ today: '2026-11-29', lifts: [lift('2026-11-25'), lift('2026-11-28', 's1-b')], longRideDays: [] }));
    expect(r.kind).toBe('lift');
    expect(r.short).toBe(true);
    expect(r.reason).toMatch(/short version/);
  });
  it('refuses back-to-back if it would make 3 days in a row with a planned day', () => {
    const r = recommend(base({ today: '2026-11-28', lifts: [lift('2026-11-27')], longRideDays: [] }));
    expect(r.kind).toBe('rest');
    expect(r.nextLift?.day).toBe('2026-11-29');
  });
  it('back-to-back NOT recommended when there is time left in the week', () => {
    const r = recommend(base({ today: '2026-11-24', lifts: [lift(MON)], longRideDays: [] }));
    expect(r.kind).toBe('rest');
  });
  it('long ride tomorrow → avoid heavy legs: rest if the week allows', () => {
    // Friday, 2 done Mon/Wed, long ride Saturday. Sunday is still free.
    const r = recommend(base({ today: '2026-11-27', lifts: [lift(MON), lift('2026-11-25', 's1-b')] }));
    expect(r.kind).toBe('rest');
    expect(r.reason).toMatch(/Long ride tomorrow/);
    expect(r.nextLift?.day).toBe('2026-11-29');
  });
  it('long ride tomorrow and the week needs it → lift with legs light', () => {
    const r = recommend(base({ today: '2026-11-27', lifts: [lift('2026-11-25')], longRideDays: [6, 7] }));
    expect(r.kind).toBe('lift');
    expect(r.legsLight).toBe(true);
    expect(r.reason).toMatch(/long ride tomorrow, so legs go light/);
  });
  it('a logged hard ride today counts like a long ride', () => {
    const r = recommend(base({ today: '2026-11-25', lifts: [lift(MON)], longRideDays: [], rides: [{ day: '2026-11-25', minutes: 60, type: 'hard' }] }));
    expect(r.kind).toBe('rest');
  });
  it('upper/lower: swaps to an upper day before a long ride', () => {
    const r = recommend(
      base({
        today: '2026-11-27',
        stageId: 's4',
        split: 'upper-lower',
        workouts: info(s4),
        targetPerWeek: 4,
        lifts: [lift(MON, 's4-ua', { focus: 'upper', lowerHeavy: false, stageId: 's4' }), lift('2026-11-25', 's4-la', { focus: 'lower', stageId: 's4' })],
      }),
    );
    // Next in rotation is UB (upper) anyway; verify the planner never puts a lower day on Friday.
    expect(r.planned.find((p) => p.day === '2026-11-27')?.templateId ?? r.templateId).not.toMatch(/-l[ab]$/);
  });
  it('weekly target hit → rest with "bonus" line, Lift anyway still possible', () => {
    const r = recommend(base({ today: '2026-11-28', lifts: [lift(MON), lift('2026-11-25', 's1-b'), lift('2026-11-27')] }));
    expect(r.kind).toBe('rest');
    expect(r.weekLine).toMatch(/Weekly target hit/);
    expect(r.templateId).toBe('s1-b');
  });
  it('behind on the week: neutral line with the best remaining days', () => {
    const r = recommend(base({ today: '2026-11-26', longRideDays: [] }));
    // Thu, (not Fri: Thu-Fri-Sat would be 3 in a row), Sat, then Sun as a short back-to-back.
    expect(r.weekLine).toBe('3 more this week: today + Sat + Sun works.');
    expect(r.planned.find((p) => p.day === '2026-11-29')?.short).toBe(true);
  });
  it('lifted today → rest card', () => {
    const r = recommend(base({ lifts: [lift(MON)] }));
    expect(r.liftedToday).toBe(true);
    expect(r.kind).toBe('rest');
    expect(r.reason).toMatch(/Nice work today/);
  });
});

describe('re-entry', () => {
  it('7+ days off → lighter session', () => {
    const r = computeReentry([lift('2026-11-10')], MON);
    expect(r?.factor).toBe(0.85);
  });
  it('21+ days → two easy sessions (80%, then 90%)', () => {
    expect(computeReentry([lift('2026-10-20')], MON)?.factor).toBe(0.8);
    const second = computeReentry([lift('2026-10-20'), lift('2026-11-21', 's1-b', { isReentry: true })], MON);
    expect(second?.factor).toBe(0.9);
    const done = computeReentry(
      [lift('2026-10-20'), lift('2026-11-19', 's1-b', { isReentry: true }), lift('2026-11-21', 's1-a', { isReentry: true })],
      MON,
    );
    expect(done).toBeUndefined();
  });
  it('recent training → no re-entry', () => {
    expect(computeReentry([lift('2026-11-20')], MON)).toBeUndefined();
  });
  it('missed whole weeks: the recommendation still says lift, with the friendly line', () => {
    const r = recommend(base({ lifts: [lift('2026-11-12')] }));
    expect(r.kind).toBe('lift');
    expect(r.reentry).toBeDefined();
    expect(r.reason).toMatch(/Missed a few days\? No problem/);
  });
});

describe('streak, planning and calendar', () => {
  it('week streak counts weeks with ≥ 2 lifts; the current week only once it qualifies', () => {
    const days = ['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-12', '2026-11-16', '2026-11-18', MON];
    expect(weekStreak(days, MON)).toBe(3);
    expect(weekStreak([...days, '2026-11-25'], '2026-11-25')).toBe(4);
    expect(weekStreak(['2026-11-02', '2026-11-04'], MON)).toBe(0);
  });
  it('plans the week with a rest day between full-body sessions', () => {
    const p = planWeek(base({ longRideDays: [] }));
    expect(p.map((x) => x.day)).toEqual(['2026-11-23', '2026-11-25', '2026-11-27']);
    expect(p.map((x) => x.templateId)).toEqual(['s1-a', 's1-b', 's1-a']);
  });
  it('2 sessions per week target is respected', () => {
    expect(planWeek(base({ targetPerWeek: 2, longRideDays: [] }))).toHaveLength(2);
  });
  it('generates two weeks of .ics events', () => {
    const list = upcoming(base(), 14);
    expect(list.length).toBeGreaterThanOrEqual(5);
    const ics = buildIcs(list, { 's1-a': 'Workout A', 's1-b': 'Workout B' }, 'morning', 'https://x/', new Date(2026, 10, 23));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(list.length);
    expect(ics).toContain('DTSTART:20261123T064500');
  });
});
