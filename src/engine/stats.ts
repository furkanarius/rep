// Derived numbers for the Progress screen. Computed, never stored.
import type { Exercise, Muscle, SessionRec, SetRec, StrengthStandard } from './types';
import { e1rm } from '../lib/e1rm';
import { addDays, toDay, weekStart, type Day } from '../lib/dates';
import { effectiveLoadKg, lowerIsBetter, measureOf } from './progression';

export type Record_ = {
  exerciseId: string;
  heaviest?: { weightKg: number; reps: number; day: Day };
  bestE1rm?: { value: number; weightKg: number; reps: number; day: Day };
  mostReps?: { reps: number; day: Day };
};

type Ctx = { exercise: (id: string) => Exercise | undefined; bodyWeightKg: number };

export function workSets(sessions: SessionRec[], sets: SetRec[]) {
  const done = new Map(sessions.filter((s) => s.status === 'done' && !s.deletedAt).map((s) => [s.id, s]));
  return sets
    .filter((s) => !s.deletedAt && !s.isWarmup && s.kind === 'work' && done.has(s.sessionId))
    .map((s) => ({ ...s, day: toDay(done.get(s.sessionId)!.startedAt) }));
}

export function records(sessions: SessionRec[], sets: SetRec[], ctx: Ctx): Map<string, Record_> {
  const out = new Map<string, Record_>();
  for (const s of workSets(sessions, sets).sort((a, b) => a.completedAt.localeCompare(b.completedAt))) {
    const ex = ctx.exercise(s.exerciseId);
    if (!ex) continue;
    const r = out.get(s.exerciseId) ?? { exerciseId: s.exerciseId };
    if (measureOf(ex) === 'seconds' || ex.loadType === 'bodyweight' && !ex.canAddWeight) {
      if (!r.mostReps || s.reps > r.mostReps.reps) r.mostReps = { reps: s.reps, day: s.day };
    } else {
      const heavier = lowerIsBetter(ex)
        ? !r.heaviest || s.weight < r.heaviest.weightKg || (s.weight === r.heaviest.weightKg && s.reps > r.heaviest.reps)
        : !r.heaviest || s.weight > r.heaviest.weightKg || (s.weight === r.heaviest.weightKg && s.reps > r.heaviest.reps);
      if (heavier) r.heaviest = { weightKg: s.weight, reps: s.reps, day: s.day };
      const v = e1rm(effectiveLoadKg(ex, s.weight, ctx.bodyWeightKg), s.reps);
      if (!r.bestE1rm || v > r.bestE1rm.value + 0.01) r.bestE1rm = { value: v, weightKg: s.weight, reps: s.reps, day: s.day };
      if (ex.loadType === 'bodyweight' && (!r.mostReps || s.reps > r.mostReps.reps)) r.mostReps = { reps: s.reps, day: s.day };
    }
    out.set(s.exerciseId, r);
  }
  return out;
}

export type PR = { exerciseId: string; kind: 'e1rm' | 'weight' | 'reps'; text: string; setId: string };

/** Personal records set in one session, compared with everything before it. */
export function sessionPRs(sessionId: string, sessions: SessionRec[], sets: SetRec[], ctx: Ctx): PR[] {
  const target = sessions.find((s) => s.id === sessionId);
  if (!target) return [];
  const before = sessions.filter((s) => s.id !== sessionId && s.startedAt < target.startedAt);
  const prev = records(before, sets, ctx);
  const mine = workSets([{ ...target, status: 'done' }], sets.filter((s) => s.sessionId === sessionId));
  const out: PR[] = [];
  const seen = new Set<string>();
  for (const s of mine) {
    const ex = ctx.exercise(s.exerciseId);
    if (!ex || seen.has(s.exerciseId)) continue;
    const p = prev.get(s.exerciseId);
    if (!p) continue; // first time is not a "record"
    const exSets = mine.filter((x) => x.exerciseId === s.exerciseId);
    if (measureOf(ex) === 'seconds' || (ex.loadType === 'bodyweight' && !ex.canAddWeight)) {
      const best = exSets.reduce((a, b) => (b.reps > a.reps ? b : a));
      if (p.mostReps && best.reps > p.mostReps.reps) {
        out.push({ exerciseId: ex.id, kind: 'reps', text: `${best.reps} ${measureOf(ex) === 'seconds' ? 's' : 'reps'}`, setId: best.id });
        seen.add(ex.id);
      }
      continue;
    }
    const bestSet = exSets.reduce((a, b) =>
      e1rm(effectiveLoadKg(ex, b.weight, ctx.bodyWeightKg), b.reps) > e1rm(effectiveLoadKg(ex, a.weight, ctx.bodyWeightKg), a.reps) ? b : a,
    );
    const v = e1rm(effectiveLoadKg(ex, bestSet.weight, ctx.bodyWeightKg), bestSet.reps);
    if (p.bestE1rm && v > p.bestE1rm.value + 0.01) {
      out.push({ exerciseId: ex.id, kind: 'e1rm', text: 'best set ever', setId: bestSet.id });
      seen.add(ex.id);
    }
  }
  return out;
}

/** Sessions per week for the last N weeks (oldest first). */
export function weeklySessions(sessions: SessionRec[], today: Day, weeks = 8) {
  const done = sessions.filter((s) => s.status === 'done' && !s.deletedAt);
  const cur = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const wk = addDays(cur, -7 * (weeks - 1 - i));
    return { week: wk, count: done.filter((s) => weekStart(toDay(s.startedAt)) === wk).length };
  });
}

/** Hard sets per muscle for one week. Primary muscles count 1, secondary 0.5. */
export function weeklyVolume(sessions: SessionRec[], sets: SetRec[], ctx: Ctx, week: Day) {
  const out = new Map<Muscle, number>();
  for (const s of workSets(sessions, sets)) {
    if (weekStart(s.day) !== week) continue;
    const ex = ctx.exercise(s.exerciseId);
    if (!ex) continue;
    for (const m of ex.primaryMuscles) out.set(m, (out.get(m) ?? 0) + 1);
    for (const m of ex.secondaryMuscles) out.set(m, (out.get(m) ?? 0) + 0.5);
  }
  return out;
}

/** e1RM per session for one exercise: [{day, e1rm, best set}] (oldest first). */
export function e1rmSeries(exerciseId: string, sessions: SessionRec[], sets: SetRec[], ctx: Ctx) {
  const ex = ctx.exercise(exerciseId);
  if (!ex) return [];
  const bySession = new Map<string, { day: Day; best: number; weightKg: number; reps: number }>();
  for (const s of workSets(sessions, sets)) {
    if (s.exerciseId !== exerciseId) continue;
    const v = e1rm(effectiveLoadKg(ex, s.weight, ctx.bodyWeightKg), s.reps);
    const cur = bySession.get(s.sessionId);
    if (!cur || v > cur.best) bySession.set(s.sessionId, { day: s.day, best: v, weightKg: s.weight, reps: s.reps });
  }
  return [...bySession.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Average % change in e1RM (first 2 sessions vs last 2) across lifts with enough data. */
export function strengthChange(exerciseIds: string[], sessions: SessionRec[], sets: SetRec[], ctx: Ctx) {
  const changes: number[] = [];
  for (const id of exerciseIds) {
    const s = e1rmSeries(id, sessions, sets, ctx);
    if (s.length < 3) continue;
    const first = Math.max(...s.slice(0, 2).map((x) => x.best));
    const last = Math.max(...s.slice(-2).map((x) => x.best));
    if (first > 0) changes.push((last - first) / first);
  }
  if (!changes.length) return undefined;
  return changes.reduce((a, b) => a + b, 0) / changes.length;
}

export function standardLevel(std: StrengthStandard, bestE1rmKg: number, bodyWeightKg: number) {
  const ratio = bestE1rmKg / bodyWeightKg;
  let label = 'Getting started';
  let next = std.levels[0];
  for (let i = 0; i < std.levels.length; i++) {
    if (ratio >= std.levels[i].ratio) {
      label = std.levels[i].label;
      next = std.levels[i + 1];
    }
  }
  return { ratio, label, next };
}

/** Total volume (weight × reps) of a session's working sets, in kg. */
export function sessionVolume(sessionSets: SetRec[]) {
  return sessionSets.filter((s) => !s.isWarmup && s.kind === 'work').reduce((a, s) => a + s.weight * s.reps, 0);
}
