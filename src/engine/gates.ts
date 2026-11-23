// Stage unlock criteria: consistency + performance + skill. Pure functions.
import type { BodyMetricRec, EventRec, Exercise, Gate, LoadUnit, SessionRec, SetRec, Stage } from './types';
import { effectiveLoadKg } from './progression';
import { e1rm, weightForReps } from '../lib/e1rm';
import { addDays, toDay, weekStart, diffDays, type Day } from '../lib/dates';
import { fmtWeight } from '../lib/units';

export type GateProgress = {
  gate: Gate;
  label: string;
  detail: string;
  progress: number; // 0..1
  met: boolean;
  /** For lift gates: the absolute target in kg, so the UI can show "250 lb × 10". */
  targetKg?: number;
};

export type GateContext = {
  today: Day;
  stage: Stage;
  sessions: SessionRec[];
  sets: SetRec[];
  events: EventRec[];
  bodyWeightKg: number;
  unit: LoadUnit;
  exercise: (id: string) => Exercise | undefined;
  /** Sessions done before the app, counted toward Stage 1. */
  priorSessions?: number;
  /** Use year-2 gates on the final stage. */
  year?: number;
};

/** Latest 7-day average body weight: the mean of entries within 7 days of the newest one. */
export function bodyWeight7d(metrics: BodyMetricRec[], fallbackKg = 75): number {
  const ws = metrics
    .filter((m) => !m.deletedAt && typeof m.weightKg === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!ws.length) return fallbackKg;
  const last = toDay(ws[ws.length - 1].date);
  const recent = ws.filter((m) => diffDays(last, toDay(m.date)) < 7);
  return recent.reduce((a, m) => a + (m.weightKg as number), 0) / recent.length;
}

const doneSessions = (ctx: GateContext) => ctx.sessions.filter((s) => s.status === 'done' && !s.deletedAt);

/** Weeks (Mon–Sun) ending with the current one that had ≥ minPerWeek sessions. */
export function consistencyWeeks(sessionDays: Day[], today: Day, minPerWeek: number, windowWeeks: number) {
  const counts = new Map<Day, number>();
  for (const d of sessionDays) counts.set(weekStart(d), (counts.get(weekStart(d)) ?? 0) + 1);
  let n = 0;
  const cur = weekStart(today);
  for (let i = 0; i < windowWeeks; i++) {
    if ((counts.get(addDays(cur, -7 * i)) ?? 0) >= minPerWeek) n++;
  }
  return n;
}

function workSetsFor(ctx: GateContext, ids: string[]) {
  const done = new Set(doneSessions(ctx).map((s) => s.id));
  return ctx.sets.filter((s) => !s.deletedAt && !s.isWarmup && s.kind === 'work' && done.has(s.sessionId) && ids.includes(s.exerciseId));
}

export function evaluateGate(gate: Gate, ctx: GateContext): GateProgress {
  const bw = ctx.bodyWeightKg;
  const name = (id: string) => ctx.exercise(id)?.name ?? id;
  const kg = (v: number) => `${fmtWeight(v, ctx.unit)} ${ctx.unit}`;
  switch (gate.type) {
    case 'sessions': {
      const n =
        doneSessions(ctx).filter((s) => s.stageId === ctx.stage.id).length +
        (ctx.stage.number === 1 ? ctx.priorSessions ?? 0 : 0);
      return {
        gate,
        label: `Complete ${gate.min} sessions in this stage`,
        detail: `${Math.min(n, gate.min)}/${gate.min}`,
        progress: Math.min(1, n / gate.min),
        met: n >= gate.min,
      };
    }
    case 'consistency': {
      const days = doneSessions(ctx).map((s) => toDay(s.startedAt));
      const n = consistencyWeeks(days, ctx.today, gate.minPerWeek, gate.windowWeeks);
      return {
        gate,
        label: `Train ≥ ${gate.minPerWeek}×/week in ${gate.weeksRequired} of the last ${gate.windowWeeks} weeks`,
        detail: `${Math.min(n, gate.weeksRequired)}/${gate.weeksRequired}`,
        progress: Math.min(1, n / gate.weeksRequired),
        met: n >= gate.weeksRequired,
      };
    }
    case 'lift': {
      const ex = ctx.exercise(gate.exerciseId);
      const accept = [{ exerciseId: gate.exerciseId, factor: 1 }, ...(gate.accept ?? [])];
      const target = gate.ratio * bw;
      let met = false;
      let bestEst = 0;
      for (const a of accept) {
        const aex = ctx.exercise(a.exerciseId);
        if (!aex) continue;
        for (const s of workSetsFor(ctx, [a.exerciseId])) {
          const load = s.weight * a.factor;
          if (load >= target - 0.01 && s.reps >= gate.reps) met = true;
          bestEst = Math.max(bestEst, weightForReps(e1rm(load, s.reps), gate.reps));
        }
      }
      const progress = met ? 1 : Math.min(0.99, bestEst / target);
      const perHand = ex?.loadType === 'dumbbell-per-hand' && ex.id !== 'goblet-squat' ? ' per hand' : '';
      return {
        gate,
        label: `${name(gate.exerciseId)} ${gate.ratio} × body weight${perHand} for ${gate.reps}`,
        detail: met ? '✓' : `${kg(target)} × ${gate.reps} · ${Math.round(progress * 100)}%`,
        progress,
        met,
        targetKg: target,
      };
    }
    case 'e1rm': {
      const accept = [{ exerciseId: gate.exerciseId, factor: 1 }, ...(gate.accept ?? [])];
      const target = gate.ratio * bw;
      let best = 0;
      for (const a of accept) {
        const aex = ctx.exercise(a.exerciseId);
        if (!aex) continue;
        for (const s of workSetsFor(ctx, [a.exerciseId])) best = Math.max(best, e1rm(s.weight * a.factor, s.reps));
      }
      const met = best >= target - 0.01;
      return {
        gate,
        label: `${name(gate.exerciseId)}: estimated max ${gate.ratio} × body weight`,
        detail: met ? '✓' : `${kg(target)} · ${Math.round(Math.min(1, best / target) * 100)}%`,
        progress: Math.min(1, best / target),
        met,
        targetKg: target,
      };
    }
    case 'assist': {
      const ex = ctx.exercise(gate.exerciseId);
      const assistSets = workSetsFor(ctx, [gate.exerciseId]).filter((s) => s.reps >= gate.reps);
      const strict = workSetsFor(ctx, [gate.orStrictExerciseId, 'chin-up', 'weighted-pull-up']).some((s) => s.reps >= gate.orStrictReps);
      const targetAssist = gate.maxAssistRatio * bw;
      const bestAssist = assistSets.length ? Math.min(...assistSets.map((s) => s.weight)) : undefined;
      const met = strict || (bestAssist !== undefined && bestAssist <= targetAssist + 0.01);
      const lifted = bestAssist === undefined ? 0 : ex ? effectiveLoadKg(ex, bestAssist, bw) : 0;
      const progress = met ? 1 : Math.min(0.99, lifted / Math.max(1, bw - targetAssist));
      return {
        gate,
        label: `${name(gate.exerciseId)} with ≤ ${Math.round(gate.maxAssistRatio * 100)}% body-weight help for ${gate.reps} (or ${gate.orStrictReps} strict pull-up)`,
        detail: met ? '✓' : `≤ ${kg(targetAssist)} help · ${Math.round(progress * 100)}%`,
        progress,
        met,
        targetKg: targetAssist,
      };
    }
    case 'bodyweightReps': {
      const ids = [gate.exerciseId, ...(gate.accept ?? [])];
      const best = Math.max(0, ...workSetsFor(ctx, ids).map((s) => s.reps));
      return {
        gate,
        label: `${gate.reps} strict ${name(gate.exerciseId).toLowerCase()}${gate.reps === 1 ? '' : 's'} in one set`,
        detail: `${Math.min(best, gate.reps)}/${gate.reps}`,
        progress: Math.min(1, best / gate.reps),
        met: best >= gate.reps,
      };
    }
    case 'technique': {
      const met = ctx.events.some((e) => !e.deletedAt && e.type === 'technique-passed' && e.exerciseId === gate.exerciseId);
      return {
        gate,
        label: `Technique check: ${name(gate.exerciseId)}`,
        detail: met ? '✓' : 'Tap to do the self-check',
        progress: met ? 1 : 0,
        met,
      };
    }
  }
}

export function stageGates(ctx: GateContext): Gate[] {
  if ((ctx.year ?? 1) >= 2 && ctx.stage.year2Gates) return ctx.stage.year2Gates;
  return ctx.stage.gates;
}

export function evaluateStage(ctx: GateContext) {
  const gates = stageGates(ctx).map((g) => evaluateGate(g, ctx));
  const metCount = gates.filter((g) => g.met).length;
  return { gates, metCount, total: gates.length, allMet: metCount === gates.length };
}

/**
 * Offer "Move up anyway": most gates met (≥ 70%), the session gate met at least 6 weeks ago,
 * and still not everything done. Explains itself in one line.
 */
export function moveUpAnyway(ctx: GateContext): { offer: boolean; why: string } {
  const res = evaluateStage(ctx);
  if (res.allMet) return { offer: false, why: '' };
  const sessGate = stageGates(ctx).find((g) => g.type === 'sessions');
  if (!sessGate || sessGate.type !== 'sessions') return { offer: false, why: '' };
  const inStage = doneSessions(ctx)
    .filter((s) => s.stageId === ctx.stage.id)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const needed = sessGate.min - (ctx.stage.number === 1 ? ctx.priorSessions ?? 0 : 0);
  const nth = inStage[Math.max(0, needed - 1)];
  if (!nth) return { offer: false, why: '' };
  const weeksSince = diffDays(ctx.today, toDay(nth.startedAt)) / 7;
  const offer = res.metCount / res.total >= 0.7 && weeksSince >= 6;
  return {
    offer,
    why: offer
      ? `You've done the sessions and most targets, and the last ${res.total - res.metCount === 1 ? 'one has' : 'few have'} been stuck for 6+ weeks. Moving up changes the exercises, which often gets things moving again.`
      : '',
  };
}
