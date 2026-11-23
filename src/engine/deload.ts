// Data-driven deloads: a lighter week when the numbers say you need one.
import type { EventRec, Exercise, SetRec } from './types';
import type { Exposure } from './history';
import { diffDays, toDay, type Day } from '../lib/dates';
import { lowerIsBetter } from './progression';

export type DeloadTrigger = 'stall' | 'max' | 'pain' | 'calendar';
export type DeloadAdvice = { suggest: boolean; trigger?: DeloadTrigger; reason: string };

export type DeloadInput = {
  today: Day;
  /** Exposures of the current stage's main lifts, by exercise. */
  mainExposures: { ex: Exercise; exposures: Exposure[] }[];
  /** Working sets with their session day, for the "Max" share. */
  recentSets: (SetRec & { day: Day })[];
  events: EventRec[];
  liftDays: Day[];
  everyWeeks: number;
};

function better(ex: Exercise, a: Exposure, b: Exposure) {
  // Is b better than a? Load first, then total reps at the same load.
  const top = (e: Exposure) => {
    const ws = e.sets.map((s) => s.weight);
    return lowerIsBetter(ex) ? Math.min(...ws) : Math.max(...ws);
  };
  const ta = top(a);
  const tb = top(b);
  if (Math.abs(ta - tb) > 0.01) return lowerIsBetter(ex) ? tb < ta : tb > ta;
  const reps = (e: Exposure) => e.sets.reduce((n, s) => n + s.reps, 0);
  return reps(b) > reps(a);
}

export function isStalled(ex: Exercise, exposures: Exposure[]) {
  const real = exposures.filter((e) => !e.isDeload && !e.isReentry && !e.isShort);
  if (real.length < 3) return false;
  const [a, b, c] = real.slice(-3);
  return !better(ex, a, b) && !better(ex, b, c);
}

/** Last deload accepted (date), if any. */
export function lastDeloadDay(events: EventRec[]): Day | undefined {
  const acc = events.filter((e) => !e.deletedAt && e.type === 'deload-accepted').map((e) => toDay(e.date)).sort();
  return acc[acc.length - 1];
}

/** A deload lasts 7 days from acceptance. */
export function deloadActive(events: EventRec[], today: Day): boolean {
  const d = lastDeloadDay(events);
  return !!d && diffDays(today, d) < 7;
}

/** Weeks of continuous training (no 7+ day gaps) since the last deload or break. */
export function continuousWeeks(liftDays: Day[], today: Day, sinceDay?: Day): number {
  const days = [...new Set(liftDays)].filter((d) => !sinceDay || d > sinceDay).sort();
  if (!days.length) return 0;
  let start = days[0];
  for (let i = 1; i < days.length; i++) if (diffDays(days[i], days[i - 1]) >= 7) start = days[i];
  if (diffDays(today, days[days.length - 1]) >= 7) return 0;
  return diffDays(today, start) / 7;
}

export function evaluateDeload(input: DeloadInput): DeloadAdvice {
  const { today, events } = input;
  const no = { suggest: false, reason: '' };
  if (deloadActive(events, today)) return no;
  const dismissed = events.some((e) => !e.deletedAt && e.type === 'deload-dismissed' && diffDays(today, toDay(e.date)) < 7);
  if (dismissed) return no;
  const since = lastDeloadDay(events);

  const pains = events.filter((e) => !e.deletedAt && e.type === 'pain' && diffDays(today, toDay(e.date)) < 7);
  if (pains.length >= 2)
    return {
      suggest: true,
      trigger: 'pain',
      reason: 'You logged "something hurts" twice this week. A lighter week lets things settle.',
    };

  const stalled = input.mainExposures.filter(({ ex, exposures }) =>
    isStalled(ex, exposures.filter((e) => !since || e.day > since)),
  );
  if (stalled.length >= 2)
    return {
      suggest: true,
      trigger: 'stall',
      reason: `${stalled.map((s) => s.ex.name).slice(0, 2).join(' and ')} haven't moved for 2 sessions. A lighter week usually unlocks new progress.`,
    };

  const week = input.recentSets.filter((s) => diffDays(today, s.day) < 7 && !s.isWarmup && s.kind === 'work');
  const maxShare = week.length ? week.filter((s) => s.feel === 'max').length / week.length : 0;
  if (week.length >= 6 && maxShare >= 0.5)
    return {
      suggest: true,
      trigger: 'max',
      reason: `Half your sets this week felt like Max effort. That's a sign to back off for a week.`,
    };

  const weeks = continuousWeeks(input.liftDays, today, since);
  if (weeks >= input.everyWeeks)
    return {
      suggest: true,
      trigger: 'calendar',
      reason: `${Math.floor(weeks)} weeks of steady training. A planned lighter week now keeps you progressing.`,
    };
  return no;
}

export const DELOAD_EXPLAINER =
  'Deload: a lighter week (about 60% weight, 2 sets) so your body can catch up. You come back stronger.';

