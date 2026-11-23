// Loads the program and exercise library (data, not code) and offers typed lookups.
import programJson from '../data/program.json';
import exercisesJson from '../data/exercises.json';
import type { Exercise, Increments, Program, Settings, Slot, Stage, WorkoutTemplate } from './types';
import { schemeKey } from './history';

export const program = programJson as unknown as Program;
export const exercises = exercisesJson as unknown as Exercise[];

const exMap = new Map(exercises.map((e) => [e.id, e]));
export const exerciseById = (id: string) => exMap.get(id);
export const mustExercise = (id: string) => {
  const e = exMap.get(id);
  if (!e) throw new Error(`Unknown exercise ${id}`);
  return e;
};

export const stages = program.stages;
export const stageById = (id: string) => stages.find((s) => s.id === id);
export const firstStage = stages[0];
export const nextStage = (id: string) => stages[stages.findIndex((s) => s.id === id) + 1];

export function allTemplates(stage: Stage): WorkoutTemplate[] {
  return [...stage.workouts, ...(stage.optionalWorkouts ?? [])];
}

export function templateById(id: string): { stage: Stage; template: WorkoutTemplate } | undefined {
  for (const stage of stages) {
    const t = allTemplates(stage).find((w) => w.id === id);
    if (t) return { stage, template: t };
  }
  return undefined;
}

export function slotOf(templateId: string, slotIndex: number): Slot | undefined {
  const found = templateById(templateId);
  if (!found) {
    // Specialization slots are appended after the template's own slots.
    return undefined;
  }
  const { stage, template } = found;
  if (slotIndex < template.slots.length) return template.slots[slotIndex];
  const extra = (stage.specializations ?? []).flatMap((s) => s.extraSlots);
  return extra[slotIndex - template.slots.length];
}

export const schemeOf = (templateId: string, slotIndex: number) => {
  const slot = slotOf(templateId, slotIndex);
  return slot ? schemeKey(slot.repMin, slot.repMax, slot.progression) : undefined;
};

/** Which increment setting applies to an exercise. */
export function incrementClass(ex: Exercise): keyof Increments {
  if (ex.loadType === 'barbell-total') return 'barbell';
  if (ex.loadType === 'dumbbell-per-hand') return 'dumbbell';
  if (ex.loadType === 'bodyweight') return 'bodyweight';
  if (ex.equipment.includes('cable')) return 'cable';
  return 'machine';
}

export function stepFor(ex: Exercise, settings: Pick<Settings, 'loadUnit' | 'incrementsLb' | 'incrementsKg'>, customLb?: number) {
  if (customLb) return settings.loadUnit === 'lb' ? customLb : Math.max(0.5, Math.round(customLb * 0.4536 * 2) / 2);
  const table = settings.loadUnit === 'lb' ? settings.incrementsLb : settings.incrementsKg;
  return table[incrementClass(ex)];
}

/** Exercises appearing in a stage, in order of first appearance. */
export function stageExerciseIds(stage: Stage): string[] {
  const ids: string[] = [];
  for (const w of allTemplates(stage)) for (const s of w.slots) if (!ids.includes(s.exerciseId)) ids.push(s.exerciseId);
  return ids;
}

/** Main lifts (role 'main') of a stage. */
export function mainLiftIds(stage: Stage): string[] {
  const ids: string[] = [];
  for (const w of stage.workouts) for (const s of w.slots) if (s.role === 'main' && !ids.includes(s.exerciseId)) ids.push(s.exerciseId);
  return ids;
}

export const MAIN_LIFTS_ALL = [
  'leg-press',
  'chest-press-machine',
  'lat-pulldown',
  'goblet-squat',
  'barbell-back-squat',
  'dumbbell-bench-press',
  'barbell-rdl',
  'bench-press',
  'deadlift',
  'overhead-press',
  'barbell-row',
];

export const DEFAULT_SETTINGS: Omit<Settings, 'updatedAt'> = {
  id: 'main',
  loadUnit: 'lb',
  bodyUnit: 'kg',
  lengthUnit: 'cm',
  incrementsLb: { machine: 10, cable: 5, dumbbell: 5, barbell: 5, bodyweight: 5 },
  incrementsKg: { machine: 5, cable: 2.5, dumbbell: 2, barbell: 2.5, bodyweight: 2.5 },
  targetPerWeek: 3,
  preferredTime: 'morning',
  longRideDays: [6],
  sound: true,
  theme: 'system',
  onboardingDone: false,
  currentStageId: 's1',
  priorStage1Sessions: 0,
  heightCm: 176,
  year: 1,
};
