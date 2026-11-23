// Pure derivation of the set rows for one exercise, from the plan and what's been logged.
import type { SetRec } from '../../engine/types';
import type { PlannedExercise } from '../../engine/session';
import { nextCalibration, calibrationReps } from '../../engine/progression';
import { fmtWeight } from '../../lib/units';

export type Row = {
  key: string;
  /** Set number shown to the user (1, 2, 3…). Trials count as sets. */
  n: number;
  trial: boolean;
  setIndex: number;
  targetKg: number;
  targetReps: number;
  logged?: SetRec;
};

export type RowsResult = {
  rows: Row[];
  /** Index into rows of the next set to log (undefined when all done). */
  activeIndex?: number;
  /** Still looking for the working weight. */
  calibrating: boolean;
  calibrationMessage?: string;
  workDone: number;
  workTotal: number;
};

export function computeRows(
  pe: PlannedExercise,
  logged: SetRec[],
  ctx: { unit: 'lb' | 'kg'; step: number; bodyWeightKg: number },
  extraSets = 0,
): RowsResult {
  const mine = logged
    .filter((s) => s.slotIndex === pe.slotIndex && s.kind === 'work')
    .sort((a, b) => a.setIndex - b.setIndex);
  const trials = mine.filter((s) => s.trial);
  const settled = mine.filter((s) => !s.trial);
  const total = Math.max(pe.sets + extraSets, mine.length);
  const fmt = (kg: number) => `${fmtWeight(kg, ctx.unit)} ${ctx.unit}`;

  const rows: Row[] = mine.map((s, i) => ({
    key: `s${i}`,
    n: i + 1,
    trial: !!s.trial,
    setIndex: s.setIndex,
    targetKg: s.targetWeight,
    targetReps: s.targetReps,
    logged: s,
  }));

  let calibrating = false;
  let message: string | undefined;
  let nextKg = pe.targetWeightKg;
  let nextReps = pe.targetReps;
  let nextTrial = false;

  if (pe.calibrate && settled.length === 0) {
    const reps = calibrationReps(pe.slot);
    if (!trials.length) {
      calibrating = true;
      nextTrial = true;
      nextReps = reps;
      message = `Let's find your weight. Do ${reps} reps, then rate how it felt. Every try counts as a set.`;
    } else {
      const last = trials[trials.length - 1];
      const step = nextCalibration(pe.exercise, last.weight, last.feel ?? 'solid', last.reps, last.targetReps, trials.length, ctx);
      nextKg = step.nextKg;
      if (step.done) {
        nextReps = pe.slot.repMin;
        message = `${step.message} The rest of your sets use it.`;
      } else {
        calibrating = true;
        nextTrial = true;
        nextReps = reps;
        message = `${step.message} That set counted.`;
      }
    }
  } else if (pe.calibrate && settled.length) {
    nextKg = settled[0].weight;
    nextReps = pe.slot.repMin;
    message = `Found it: ${fmt(nextKg)} is your working weight. Wrong rating? Change it and I'll adjust.`;
  }

  // Unlogged sets: the next one carries the latest logged weight forward (if you changed it).
  for (let i = mine.length; i < total; i++) {
    const prev = mine[mine.length - 1];
    const kg = !prev || pe.calibrate ? nextKg : prev.weight;
    rows.push({
      key: `s${i}`,
      n: i + 1,
      trial: i === mine.length ? nextTrial : false,
      setIndex: (prev?.setIndex ?? -1) + 1 + (i - mine.length),
      targetKg: kg,
      targetReps: i === mine.length ? nextReps : pe.calibrate ? pe.slot.repMin : pe.targetReps,
    });
  }
  const activeIndex = rows.findIndex((r) => !r.logged);
  return {
    rows,
    activeIndex: activeIndex === -1 ? undefined : activeIndex,
    calibrating,
    calibrationMessage: pe.calibrate && (calibrating || settled.length <= 1 || trials.length > 0) ? message : undefined,
    workDone: mine.length,
    workTotal: total,
  };
}
