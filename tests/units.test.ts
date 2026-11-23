import { describe, expect, it } from 'vitest';
import { fromKg, lbToKg, kgToLb, roundKg, roundToStep, toKg, fmtWeight } from '../src/lib/units';
import { e1rm, weightForReps } from '../src/lib/e1rm';
import { addDays, diffDays, isoWeekday, weekStart, relativeDayName } from '../src/lib/dates';

describe('units', () => {
  it('round-trips lb ↔ kg without drift', () => {
    for (const lb of [5, 45, 90, 135, 225, 315]) expect(kgToLb(lbToKg(lb))).toBeCloseTo(lb, 9);
    expect(fmtWeight(lbToKg(90), 'lb')).toBe('90');
  });
  it('rounds to equipment steps in the display unit', () => {
    expect(roundToStep(92, 10)).toBe(90);
    expect(roundToStep(96, 10)).toBe(100);
    expect(roundToStep(41, 2.5, 'down')).toBe(40);
    expect(roundToStep(40.01, 2.5, 'up')).toBe(42.5);
    expect(fromKg(roundKg(lbToKg(93), 5, 'lb'), 'lb')).toBeCloseTo(95, 6);
  });
  it('switching unit re-rounds to the new unit’s steps', () => {
    const kg = toKg(90, 'lb'); // 40.8 kg
    expect(fromKg(roundKg(kg, 2.5, 'kg'), 'kg')).toBe(40);
    expect(fmtWeight(kg, 'kg')).toBe('40.8');
  });
});

describe('e1rm', () => {
  it('uses Epley and caps reps at 12', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
    expect(e1rm(100, 20)).toBeCloseTo(e1rm(100, 12), 9);
    expect(weightForReps(e1rm(80, 8), 8)).toBeCloseTo(80, 9);
  });
});

describe('dates', () => {
  it('handles weeks Monday–Sunday', () => {
    expect(isoWeekday('2026-11-23')).toBe(1); // Monday
    expect(isoWeekday('2026-11-29')).toBe(7);
    expect(weekStart('2026-11-29')).toBe('2026-11-23');
    expect(addDays('2026-11-30', 2)).toBe('2026-12-02');
    expect(diffDays('2026-12-02', '2026-11-23')).toBe(9);
    expect(relativeDayName('2026-11-24', '2026-11-23')).toBe('tomorrow');
    expect(relativeDayName('2026-11-26', '2026-11-23')).toBe('Thursday');
  });
});
