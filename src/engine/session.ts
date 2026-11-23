// Builds today's concrete workout: template + history + context → one prescription per exercise.
import type { Exercise, PreferenceRec, Settings, Slot, Stage, WorkoutTemplate } from './types';
import type { Exposure } from './history';
import { schemeKey } from './history';
import { prescribe, type Mode, type Prescription } from './progression';
import { exerciseById, stepFor } from './program';
import { diffDays, type Day } from '../lib/dates';

export type PlannedExercise = Prescription & {
  slotIndex: number;
  slot: Slot;
  exercise: Exercise;
  substitutedFrom?: string;
};

export type BuildContext = {
  stage: Stage;
  template: WorkoutTemplate;
  settings: Settings;
  preferences: PreferenceRec[];
  exposures: Map<string, Exposure[]>;
  bodyWeightKg: number;
  /** Sessions already done in this stage (for intro sets). */
  sessionsInStage: number;
  short: boolean;
  mode: Mode;
  reentryFactor?: number;
  legsLight: boolean;
  today: Day;
  /** Per-slot overrides chosen in this session (substitutions). */
  slotExercise?: Record<number, string>;
};

export const SHORT_EXERCISES = 4;
export const SHORT_SETS = 2;

export function activeSpecialization(stage: Stage, settings: Settings, today: Day) {
  const spec = settings.specialization;
  if (!spec) return undefined;
  const def = stage.specializations?.find((s) => s.id === spec.id);
  if (!def) return undefined;
  return diffDays(today, spec.startedAt.slice(0, 10)) < def.weeks * 7 ? def : undefined;
}

export function sessionSlots(ctx: Pick<BuildContext, 'stage' | 'template' | 'settings' | 'today' | 'short'>): Slot[] {
  let slots = [...ctx.template.slots];
  const spec = activeSpecialization(ctx.stage, ctx.settings, ctx.today);
  if (spec && ctx.stage.workouts.some((w) => w.id === ctx.template.id)) slots = [...slots, ...spec.extraSlots];
  if (ctx.short) slots = slots.slice(0, SHORT_EXERCISES);
  return slots;
}

export function buildSession(ctx: BuildContext): PlannedExercise[] {
  const prefs = new Map(ctx.preferences.map((p) => [p.id, p]));
  const intro =
    ctx.stage.introSessions && ctx.sessionsInStage < ctx.stage.introSessions ? ctx.stage.introSets : undefined;
  return sessionSlots(ctx).map((slot, slotIndex) => {
    const pref = prefs.get(slot.exerciseId);
    const chosen = ctx.slotExercise?.[slotIndex] ?? pref?.alwaysSubstituteWith ?? slot.exerciseId;
    const exercise = exerciseById(chosen) ?? exerciseById(slot.exerciseId)!;
    const exPref = prefs.get(exercise.id);
    let setsOverride: number | undefined;
    if (ctx.short) setsOverride = SHORT_SETS;
    else if (intro) setsOverride = Math.min(slot.sets, intro);
    const step = stepFor(exercise, ctx.settings, exPref?.incrementLb);
    const p = prescribe(exercise, slot, ctx.exposures.get(exercise.id) ?? [], {
      unit: ctx.settings.loadUnit,
      step,
      barbellStep: ctx.settings.loadUnit === 'lb' ? ctx.settings.incrementsLb.barbell : ctx.settings.incrementsKg.barbell,
      bodyWeightKg: ctx.bodyWeightKg,
      mode: ctx.mode,
      reentryFactor: ctx.reentryFactor,
      setsOverride,
      legsLight: ctx.legsLight,
      startingWeightKg: exPref?.startingWeightKg,
      scheme: schemeKey(slot.repMin, slot.repMax, slot.progression),
    });
    return {
      ...p,
      slotIndex,
      slot,
      exercise,
      substitutedFrom: exercise.id !== slot.exerciseId ? slot.exerciseId : undefined,
    };
  });
}

/** Substitutes for an exercise: its listed substitutes first, then others with the same pattern and level ≤ stage. */
export function substituteOptions(ex: Exercise, all: Exercise[], stageNumber: number): Exercise[] {
  const listed = ex.substitutes.map((id) => all.find((e) => e.id === id)).filter(Boolean) as Exercise[];
  const others = all.filter(
    (e) => e.id !== ex.id && e.pattern === ex.pattern && e.level <= stageNumber + 1 && !listed.includes(e),
  );
  return [...listed, ...others].slice(0, 6);
}
