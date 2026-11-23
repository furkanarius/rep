import type { Exercise, Feel, LoadUnit, Slot } from './types';
import type { Exposure } from './history';
import { fromKg, roundKg, toKg, fmtWeight } from '../lib/units';
import { e1rm, weightForReps } from '../lib/e1rm';

export type Mode = 'normal' | 'deload' | 'reentry';

export type ProgressionContext = {
  unit: LoadUnit;
  /** Load step for this exercise, in the display unit. */
  step: number;
  /** Barbell step in display unit (linear progression uses 1× for upper, 2× for lower body). */
  barbellStep: number;
  bodyWeightKg: number;
  mode: Mode;
  /** Load multiplier for re-entry sessions (e.g. 0.85). */
  reentryFactor?: number;
  /** Overrides the number of working sets (short version, intro sessions, deload). */
  setsOverride?: number;
  /** Long ride tomorrow / today: lower-body work holds weight with 2 sets. */
  legsLight?: boolean;
  /** Weight carried over from before the app (onboarding). */
  startingWeightKg?: number;
  /** Scheme key of the slot being prescribed. */
  scheme: string;
};

export type Change =
  | 'up'
  | 'same'
  | 'more-reps'
  | 'down'
  | 'reset'
  | 'calibrate'
  | 'start'
  | 'new'
  | 'from-e1rm'
  | 'deload'
  | 'reentry'
  | 'legs-light'
  | 'topped-out';

export type Warmup = { weightKg: number; reps: number };

export type Prescription = {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  targetReps: number;
  targetWeightKg: number;
  restSec: number;
  warmups: Warmup[];
  calibrate: boolean;
  change: Change;
  reason: string;
  measure: 'reps' | 'seconds';
};

export const BAR_KG = 20;
export const BAR_LB = 45;
export const barKg = (unit: LoadUnit) => (unit === 'lb' ? toKg(BAR_LB, 'lb') : BAR_KG);
/** Empty-bar weight for this exercise (EZ bars and Smith machines are lighter). */
export const barFor = (ex: Exercise, unit: LoadUnit) => {
  if (!ex.barLb) return barKg(unit);
  return unit === 'lb' ? toKg(ex.barLb, 'lb') : Math.round(toKg(ex.barLb, 'lb') / 2.5) * 2.5 || 10;
};

export const isLowerBody = (ex: Exercise) =>
  ex.pattern === 'squat' ||
  ex.pattern === 'hinge' ||
  ex.pattern === 'lunge' ||
  ex.primaryMuscles.some((m) => m === 'quads' || m === 'hamstrings' || m === 'glutes' || m === 'calves');

export const measureOf = (ex: Exercise): 'reps' | 'seconds' =>
  ex.measure ?? (ex.loadType === 'time' ? 'seconds' : 'reps');

/** Whether weight is part of the prescription at all. */
export const usesLoad = (ex: Exercise) =>
  ex.loadType !== 'time' && !(ex.loadType === 'bodyweight' && !ex.canAddWeight);

/** For assisted exercises a LOWER number is better (less help). */
export const lowerIsBetter = (ex: Exercise) => ex.loadType === 'assisted';

/** The load the muscles actually move, for e1RM and strength comparisons. */
export function effectiveLoadKg(ex: Exercise, weightKg: number, bodyWeightKg: number) {
  if (ex.loadType === 'bodyweight') return bodyWeightKg + weightKg;
  if (ex.loadType === 'assisted') return Math.max(0, bodyWeightKg - weightKg);
  return weightKg;
}

const unitWord = (u: LoadUnit) => u;
const w = (kg: number, ctx: ProgressionContext) => `${fmtWeight(kg, ctx.unit)} ${unitWord(ctx.unit)}`;
const stepKg = (ctx: ProgressionContext, mult = 1) => toKg(ctx.step * mult, ctx.unit);

function topWeight(ex: Exercise, exp: Exposure) {
  const ws = exp.sets.map((s) => s.weight);
  return lowerIsBetter(ex) ? Math.min(...ws) : Math.max(...ws);
}

type Summary = {
  top: number;
  allTop: boolean;
  allMin: boolean;
  anyMax: boolean;
  allEasy: boolean;
  minReps: number;
  sets: number;
};

function summarize(ex: Exercise, exp: Exposure, repMin: number, repMax: number): Summary {
  const top = topWeight(ex, exp);
  const reps = exp.sets.map((s) => s.reps);
  const feels: Feel[] = exp.sets.map((s) => s.feel ?? 'solid');
  // Sets done lighter than the top weight count as "not at target".
  const atTop = exp.sets.every((s) => Math.abs(s.weight - top) < 0.01);
  return {
    top,
    allTop: atTop && reps.every((r) => r >= repMax),
    allMin: reps.every((r) => r >= repMin),
    anyMax: feels.some((f) => f === 'max'),
    allEasy: feels.every((f) => f === 'easy'),
    minReps: Math.min(...reps),
    sets: exp.sets.length,
  };
}

/** Count most-recent consecutive failed exposures at the same weight as the last one. */
function trailingFailures(ex: Exercise, exps: Exposure[], repMin: number) {
  if (!exps.length) return 0;
  const last = topWeight(ex, exps[exps.length - 1]);
  let n = 0;
  for (let i = exps.length - 1; i >= 0; i--) {
    const e = exps[i];
    if (Math.abs(topWeight(ex, e) - last) > 0.01) break;
    if (e.sets.every((s) => s.reps >= repMin)) break;
    n++;
  }
  return n;
}

function bestE1rm(ex: Exercise, exps: Exposure[], bw: number) {
  let best = 0;
  for (const e of exps)
    for (const s of e.sets) best = Math.max(best, e1rm(effectiveLoadKg(ex, s.weight, bw), s.reps));
  return best;
}

/** Load (in the exercise's own terms) from a desired effective load. */
function fromEffective(ex: Exercise, effectiveKg: number, bw: number) {
  if (ex.loadType === 'bodyweight') return Math.max(0, effectiveKg - bw);
  if (ex.loadType === 'assisted') return Math.max(0, bw - effectiveKg);
  return effectiveKg;
}

function clampLoad(ex: Exercise, kg: number, ctx: ProgressionContext, mode: 'nearest' | 'down' | 'up' = 'nearest') {
  // For assisted exercises, "down" in difficulty means more assistance: invert rounding.
  const m = lowerIsBetter(ex) ? (mode === 'down' ? 'up' : mode === 'up' ? 'down' : mode) : mode;
  let r = roundKg(kg, ctx.step, ctx.unit, m);
  if (ex.loadType === 'barbell-total') r = Math.max(r, barFor(ex, ctx.unit));
  else if (ex.loadType === 'stack' || ex.loadType === 'dumbbell-per-hand') r = Math.max(r, stepKg(ctx));
  return Math.max(0, r);
}

export function startWeightKg(ex: Exercise, ctx: ProgressionContext) {
  if (ex.loadType === 'assisted') return clampLoad(ex, ctx.bodyWeightKg * 0.5, ctx);
  if (ex.loadType === 'barbell-total')
    return Math.max(barFor(ex, ctx.unit), ex.startLb ? clampLoad(ex, toKg(ex.startLb, 'lb'), ctx, 'down') : 0);
  const lb = ex.startLb ?? ex.defaultIncrementLb * 2;
  return clampLoad(ex, toKg(lb, 'lb'), ctx, 'down');
}

/**
 * Decide the next working weight and reps for one slot, explaining why in one plain sentence.
 * `exposures` are this exercise's past exposures, oldest first.
 */
export function prescribe(ex: Exercise, slot: Slot, exposures: Exposure[], ctx: ProgressionContext): Prescription {
  const measure = measureOf(ex);
  const unitOfReps = measure === 'seconds' ? 's' : 'reps';
  const baseSets = ctx.setsOverride ?? slot.sets;
  const base: Omit<Prescription, 'targetReps' | 'targetWeightKg' | 'change' | 'reason' | 'calibrate'> = {
    exerciseId: ex.id,
    sets: baseSets,
    repMin: slot.repMin,
    repMax: slot.repMax,
    restSec: slot.restSec ?? ex.defaultRestSec,
    warmups: [],
    measure,
  };
  const loaded = usesLoad(ex);
  // Trial ("find your weight") sets count as work, but only settled sets drive the next weight.
  const settled = exposures.map((e) => ({ ...e, sets: e.sets.filter((s) => !s.trial) }));
  const lastTrialOnly = [...exposures].reverse().find((e) => !e.isDeload && !e.isReentry && e.sets.length > 0);
  const real = settled.filter((e) => !e.isDeload && !e.isReentry && e.sets.length > 0);
  const sameScheme = real.filter((e) => e.scheme === ctx.scheme || e.scheme === undefined);

  let out: Prescription;

  if (!real.length && lastTrialOnly && loaded) {
    // Last time we were still finding the weight: carry on from the last trial.
    const t = lastTrialOnly.sets[lastTrialOnly.sets.length - 1];
    const step = nextCalibration(ex, t.weight, t.feel ?? 'solid', t.reps, t.targetReps, 4, ctx);
    out = {
      ...base,
      targetReps: slot.repMin,
      targetWeightKg: step.nextKg,
      calibrate: false,
      change: 'start',
      reason: `Last time we were still finding your weight, so let's go with ${w(step.nextKg, ctx)}. Aim for ${slot.repMin}–${slot.repMax} ${unitOfReps}.`,
    };
  } else if (!real.length) {
    if (ctx.startingWeightKg && loaded) {
      out = {
        ...base,
        targetReps: slot.repMin,
        targetWeightKg: clampLoad(ex, ctx.startingWeightKg, ctx),
        calibrate: false,
        change: 'start',
        reason: `Starting from your latest weight (${w(ctx.startingWeightKg, ctx)}). Aim for ${slot.repMin} ${unitOfReps}.`,
      };
    } else if (!loaded || ex.loadType === 'bodyweight') {
      out = {
        ...base,
        targetReps: slot.repMin,
        targetWeightKg: 0,
        calibrate: false,
        change: 'new',
        reason:
          measure === 'seconds'
            ? `First time: hold for ${slot.repMin} seconds with good form. Stop early if your form slips.`
            : `First time: aim for ${slot.repMin} ${unitOfReps} with good form. Stop when the form slips.`,
      };
    } else {
      const calReps = calibrationReps(slot);
      out = {
        ...base,
        targetReps: calReps,
        targetWeightKg: startWeightKg(ex, ctx),
        calibrate: true,
        change: 'calibrate',
        reason: `First time: we'll find your weight. Do ${calReps} reps, then tell me how it felt.`,
      };
    }
  } else if (!sameScheme.length) {
    // Done before, but in a different rep range (e.g. new stage): derive from estimated max.
    const best = bestE1rm(ex, real.slice(-3), ctx.bodyWeightKg);
    const reps = Math.min(slot.repMax, slot.repMin + 2);
    const eff = weightForReps(best, reps) * 0.95;
    const target = loaded ? clampLoad(ex, fromEffective(ex, eff, ctx.bodyWeightKg), ctx, 'down') : 0;
    out = {
      ...base,
      targetReps: slot.repMin,
      targetWeightKg: target,
      calibrate: false,
      change: 'from-e1rm',
      reason: loaded
        ? `New rep range, so the weight comes from your recent best sets. Aim for ${slot.repMin}–${slot.repMax} ${unitOfReps}.`
        : `New rep range: aim for ${slot.repMin}–${slot.repMax} ${unitOfReps}.`,
    };
  } else if (slot.progression === 'linear') {
    out = { ...base, ...linear(ex, slot, sameScheme, ctx), calibrate: false };
  } else {
    out = { ...base, ...double(ex, slot, sameScheme, ctx), calibrate: false };
  }

  // ---- Modifiers ----
  const last = sameScheme[sameScheme.length - 1] ?? real[real.length - 1];
  if (ctx.mode === 'deload' && !out.calibrate) {
    const baseKg = last ? topWeight(ex, last) : out.targetWeightKg;
    out.sets = 2;
    out.targetReps = slot.repMin;
    if (loaded && baseKg > 0) out.targetWeightKg = clampLoad(ex, scaleLoad(ex, baseKg, 0.6, ctx), ctx, 'down');
    out.change = 'deload';
    out.reason = `Deload: about 60% of your usual weight, 2 sets. Easy on purpose so your body can catch up.`;
  } else if (ctx.mode === 'reentry' && !out.calibrate) {
    const f = ctx.reentryFactor ?? 0.85;
    const baseKg = last ? topWeight(ex, last) : out.targetWeightKg;
    out.sets = 2;
    out.targetReps = slot.repMin;
    if (loaded && baseKg > 0) out.targetWeightKg = clampLoad(ex, scaleLoad(ex, baseKg, f, ctx), ctx, 'down');
    out.change = 'reentry';
    out.reason = `Easing back in: about ${Math.round(f * 100)}% of your last weight, 2 sets.`;
  } else if (ctx.legsLight && isLowerBody(ex) && !out.calibrate) {
    out.sets = Math.min(out.sets, 2);
    if (last && loaded) out.targetWeightKg = topWeight(ex, last);
    out.targetReps = slot.repMin;
    out.change = 'legs-light';
    out.reason = `Ride coming up, so legs stay at ${loaded ? w(out.targetWeightKg, ctx) : 'the same level'} for just 2 sets. Keep it Solid, not Max.`;
  }

  if (slot.role === 'main' && loaded && !out.calibrate && ctx.mode === 'normal') {
    out.warmups = warmupsFor(ex, out.targetWeightKg, ctx);
  }
  return out;
}

/** Scale "difficulty" — for assisted moves scaling difficulty down means more assistance. */
function scaleLoad(ex: Exercise, kg: number, factor: number, ctx: ProgressionContext) {
  if (ex.loadType === 'assisted' || ex.loadType === 'bodyweight') {
    const eff = effectiveLoadKg(ex, kg, ctx.bodyWeightKg) * factor;
    return fromEffective(ex, eff, ctx.bodyWeightKg);
  }
  return kg * factor;
}

export function calibrationReps(slot: Slot) {
  return Math.round((slot.repMin + slot.repMax) / 2);
}

type Partial_ = Pick<Prescription, 'targetReps' | 'targetWeightKg' | 'change' | 'reason'>;

function harder(ex: Exercise, kg: number, ctx: ProgressionContext, mult = 1) {
  const d = stepKg(ctx, mult);
  return lowerIsBetter(ex) ? Math.max(0, kg - d) : kg + d;
}
function easier(ex: Exercise, kg: number, ctx: ProgressionContext, mult = 1) {
  const d = stepKg(ctx, mult);
  return lowerIsBetter(ex) ? kg + d : Math.max(0, kg - d);
}

function double(ex: Exercise, slot: Slot, exps: Exposure[], ctx: ProgressionContext): Partial_ {
  const last = exps[exps.length - 1];
  const s = summarize(ex, last, slot.repMin, slot.repMax);
  const loaded = usesLoad(ex);
  const seconds = measureOf(ex) === 'seconds';
  const u = seconds ? 's' : 'reps';
  const stepWord = (kg: number) => `${fmtWeight(Math.abs(kg - s.top), ctx.unit)} ${ctx.unit}`;

  if (s.allTop && !s.anyMax) {
    if (!loaded) {
      const prog = ex.progressionId;
      return {
        targetReps: slot.repMax,
        targetWeightKg: 0,
        change: 'topped-out',
        reason: prog
          ? `You've topped out at ${slot.repMax} ${u}. Keep it up, or try the harder version when you're ready.`
          : `You've topped out at ${slot.repMax} ${u}. Slow each rep down to make it harder.`,
      };
    }
    const next = clampLoad(ex, harder(ex, s.top, ctx), ctx);
    if (ex.loadType === 'assisted') {
      return {
        targetReps: slot.repMin,
        targetWeightKg: next,
        change: 'up',
        reason:
          next <= 0.01
            ? `No assistance needed now! You hit ${slot.repMax} on every set last time. Try them strict.`
            : `${stepWord(next)} less help: you hit ${slot.repMax} on every set last time.`,
      };
    }
    return {
      targetReps: slot.repMin,
      targetWeightKg: next,
      change: 'up',
      reason: `Up ${stepWord(next)}: you hit ${slot.repMax} ${u} on every set last time${s.allEasy ? ' and it felt easy' : ''}.`,
    };
  }
  if (s.allTop && s.anyMax) {
    return {
      targetReps: slot.repMax,
      targetWeightKg: s.top,
      change: 'same',
      reason: `Same weight: you hit ${slot.repMax} ${u} but some sets were Max effort. Make them feel Solid, then we go up.`,
    };
  }
  if (s.allMin) {
    const inc = seconds ? 5 : 1;
    const target = Math.min(slot.repMax, s.minReps + inc);
    return {
      targetReps: target,
      targetWeightKg: s.top,
      change: 'more-reps',
      reason: loaded
        ? `Same ${w(s.top, ctx)}: aim for ${target} ${u} (a bit more than last time).`
        : `Aim for ${target} ${u}, a bit more than last time.`,
    };
  }
  const fails = trailingFailures(ex, exps, slot.repMin);
  if (fails >= 2 && loaded) {
    const next = clampLoad(ex, easier(ex, s.top, ctx), ctx, 'down');
    return {
      targetReps: slot.repMin,
      targetWeightKg: next,
      change: 'down',
      reason: `Down to ${w(next, ctx)}: two tough sessions in a row, so we step back a little and build up again.`,
    };
  }
  return {
    targetReps: slot.repMin,
    targetWeightKg: s.top,
    change: 'same',
    reason: loaded
      ? `Same ${w(s.top, ctx)}: last time was tough. Aim for ${slot.repMin} ${u} on every set.`
      : `Aim for ${slot.repMin} ${u} on every set.`,
  };
}

function linear(ex: Exercise, slot: Slot, exps: Exposure[], ctx: ProgressionContext): Partial_ {
  const last = exps[exps.length - 1];
  const s = summarize(ex, last, slot.repMin, slot.repMax);
  const lower = isLowerBody(ex);
  const allMaxFeel = last.sets.every((x) => (x.feel ?? 'solid') === 'max');
  if (s.allMin) {
    const mult = lower && !allMaxFeel ? 2 : 1;
    const jumpUnit = ctx.barbellStep * mult;
    const next = clampLoad(ex, s.top + toKg(jumpUnit, ctx.unit), ctx);
    return {
      targetReps: slot.repMin,
      targetWeightKg: next,
      change: 'up',
      reason:
        lower && allMaxFeel
          ? `Up ${fmtWeight(next - s.top, ctx.unit)} ${ctx.unit}: you got all your reps, but it felt like max effort, so a smaller jump.`
          : `Up ${fmtWeight(next - s.top, ctx.unit)} ${ctx.unit}: you got all ${slot.repMin}s last time.`,
    };
  }
  const fails = trailingFailures(ex, exps, slot.repMin);
  if (fails >= 2) {
    const next = clampLoad(ex, s.top * 0.9, ctx, 'down');
    return {
      targetReps: slot.repMin,
      targetWeightKg: next,
      change: 'reset',
      reason: `Reset to ${w(next, ctx)} (about 10% lighter): two misses in a row. You'll pass your old weight in a few sessions.`,
    };
  }
  return {
    targetReps: slot.repMin,
    targetWeightKg: s.top,
    change: 'same',
    reason: `Same ${w(s.top, ctx)}: you missed a few reps last time. Get all ${slot.repMin}s and it goes up.`,
  };
}

/** 1–3 warm-up sets for main lifts. Shown but never counted. */
export function warmupsFor(ex: Exercise, workKg: number, ctx: ProgressionContext): Warmup[] {
  if (workKg <= 0 || ex.loadType === 'assisted' || ex.loadType === 'bodyweight') return [];
  const out: Warmup[] = [];
  const minLoad = ex.loadType === 'barbell-total' ? barFor(ex, ctx.unit) : stepKg(ctx);
  const push = (kg: number, reps: number) => {
    const r = Math.max(minLoad, roundKg(kg, ctx.step, ctx.unit, 'down'));
    if (r < workKg - 0.01 && !out.some((x) => Math.abs(x.weightKg - r) < 0.01)) out.push({ weightKg: r, reps });
  };
  if (ex.loadType === 'barbell-total') {
    const bar = barFor(ex, ctx.unit);
    if (workKg > bar * 1.25) push(bar, 10);
    if (workKg * 0.5 > bar + 0.01) push(workKg * 0.5, 5);
    if (workKg * 0.75 > bar + 0.01) push(workKg * 0.75, 3);
    if (!out.length && workKg > bar) push(bar, 8);
  } else {
    push(workKg * 0.5, 8);
  }
  return out;
}

// ---------- "Find your weight" calibration ----------

export type CalibrationStep = { done: boolean; nextKg: number; message: string };

/**
 * Given the weight just tried and how it felt, suggest the next calibration set.
 * Easy → jump about 25% · Solid → found it · Max → drop about 15% (20% if reps were missed).
 */
export function nextCalibration(
  ex: Exercise,
  currentKg: number,
  feel: Feel,
  repsDone: number,
  targetReps: number,
  attempt: number,
  ctx: Pick<ProgressionContext, 'unit' | 'step' | 'bodyWeightKg'>,
): CalibrationStep {
  const full = { ...ctx, barbellStep: ctx.step, mode: 'normal' as const, scheme: '' };
  const fmt = (kg: number) => `${fmtWeight(kg, ctx.unit)} ${ctx.unit}`;
  const missed = repsDone < targetReps;
  if (feel === 'solid' && !missed) {
    return { done: true, nextKg: currentKg, message: `Found it: ${fmt(currentKg)} is your working weight.` };
  }
  const assisted = ex.loadType === 'assisted';
  const cur = fromKg(currentKg, ctx.unit);
  let next: number;
  if (feel === 'easy' && !missed) {
    const jump = Math.max(cur * 0.25, ctx.step * 2);
    next = assisted ? cur - jump : cur + jump;
  } else {
    const drop = Math.max(cur * (missed ? 0.2 : 0.15), ctx.step);
    next = assisted ? cur + drop : cur - drop;
  }
  let nextKg = clampLoad(ex, toKg(next, ctx.unit), full, feel === 'easy' ? 'down' : 'nearest');
  if (Math.abs(nextKg - currentKg) < 0.01) {
    nextKg = clampLoad(ex, feel === 'easy' ? harder(ex, currentKg, full) : easier(ex, currentKg, full), full);
  }
  if (attempt >= 4) {
    // Enough testing: settle between the last two tries.
    const settle = feel === 'easy' ? clampLoad(ex, harder(ex, currentKg, full), full) : nextKg;
    return { done: true, nextKg: settle, message: `Let's go with ${fmt(settle)} as your working weight.` };
  }
  return {
    done: false,
    nextKg,
    message:
      feel === 'easy'
        ? `Felt easy: try ${fmt(nextKg)} next.`
        : `That was a lot: try ${fmt(nextKg)} next.`,
  };
}
