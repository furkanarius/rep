// User actions that touch several parts of the app.
import type { AppData } from './data';
import { startSession } from '../db/repo';
import { computeReentry } from '../engine/scheduler';
import { isDeloadWeek } from './derive';
import { templateById } from '../engine/program';
import { go } from './router';

export async function startWorkout(d: AppData, opts: { templateId: string; short?: boolean; legsLight?: boolean }) {
  if (d.active) {
    go(`workout/${d.active.id}`);
    return;
  }
  const found = templateById(opts.templateId);
  if (!found) return;
  const reentry = computeReentry(d.lifts, d.today);
  const deload = isDeloadWeek(d);
  const s = await startSession({
    workoutTemplateId: opts.templateId,
    stageId: found.stage.id,
    isShortVersion: !!opts.short,
    isDeload: deload,
    isReentry: !deload && !!reentry,
    reentryFactor: !deload && reentry ? reentry.factor : undefined,
    legsLight: !!opts.legsLight,
  });
  go(`workout/${s.id}`);
}
