// Pure derivation of the set rows for one exercise, from the plan and what's been logged.
import type { SetRec } from '../../engine/types';
import type { PlannedExercise } from '../../engine/session';
import { nextCalibration, calibrationReps } from '../../engine/progression';
import { fmtWeight } from '../../lib/units';

export type Row = {
  key: string;
  kind: 'calibration' | 'work';
  setIndex: number;
  targetKg: number;
  targetReps: number;
  logged?: SetRec;
};

export type RowsResult = {
  rows: Row[];
  /** Index into rows of the next set to log (undefined when all done). */
  activeIndex?: number;
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
  const mine = logged.filter((s) => s.slotIndex === pe.slotIndex && (s.kind === 'work' || s.kind === 'calibration'));
  const work = mine.filter((s) => s.kind === 'work').sort((a, b) => a.setIndex - b.setIndex);
  const cal = mine.filter((s) => s.kind === 'calibration').sort((a, b) => a.setIndex - b.setIndex);
  const rows: Row[] = [];
  let message: string | undefined;
  let calibrating = false;
  let workKg = pe.targetWeightKg;
  const total = pe.sets + extraSets;

  if (pe.calibrate && work.length === 0) {
    const reps = calibrationReps(pe.slot);
    cal.forEach((s, i) => rows.push({ key: `c${i}`, kind: 'calibration', setIndex: s.setIndex, targetKg: s.targetWeight, targetReps: s.targetReps, logged: s }));
    if (!cal.length) {
      calibrating = true;
      rows.push({ key: 'c0', kind: 'calibration', setIndex: 0, targetKg: pe.targetWeightKg, targetReps: reps });
      message = `Let's find your weight. Try ${reps} reps and tell me how it felt.`;
    } else {
      const last = cal[cal.length - 1];
      const step = nextCalibration(pe.exercise, last.weight, last.feel ?? 'solid', last.reps, last.targetReps, cal.length, ctx);
      message = step.message;
      if (step.done) {
        workKg = step.nextKg;
      } else {
        calibrating = true;
        rows.push({ key: `c${cal.length}`, kind: 'calibration', setIndex: cal.length, targetKg: step.nextKg, targetReps: reps });
      }
    }
    if (calibrating) {
      return { rows, activeIndex: rows.length - 1, calibrating, calibrationMessage: message, workDone: 0, workTotal: total };
    }
  } else if (pe.calibrate && work.length) {
    workKg = work[0].weight;
    cal.forEach((s, i) => rows.push({ key: `c${i}`, kind: 'calibration', setIndex: s.setIndex, targetKg: s.targetWeight, targetReps: s.targetReps, logged: s }));
    message = `Found it: ${fmtWeight(workKg, ctx.unit)} ${ctx.unit} is your working weight. If that wasn't Solid, change the rating and I'll adjust.`;
  }

  const baseIndex = cal.length;
  const count = Math.max(total, work.length);
  for (let i = 0; i < count; i++) {
    const l = work[i];
    // Unlogged sets inherit the most recent logged weight, so a change carries forward.
    const prev = work.slice(0, i).pop();
    const kg = l ? l.targetWeight : prev ? prev.weight : workKg;
    const reps = pe.calibrate ? pe.slot.repMin : pe.targetReps;
    rows.push({ key: `w${i}`, kind: 'work', setIndex: baseIndex + i, targetKg: kg, targetReps: l ? l.targetReps : reps, logged: l });
  }
  const activeIndex = rows.findIndex((r) => !r.logged);
  return {
    rows,
    activeIndex: activeIndex === -1 ? undefined : activeIndex,
    calibrating: false,
    calibrationMessage: pe.calibrate && work.length <= 1 ? message : undefined,
    workDone: work.length,
    workTotal: total,
  };
}
