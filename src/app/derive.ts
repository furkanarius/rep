// Screen-level derivations that combine several engine modules.
import type { AppData } from './data';
import { recommend, upcoming, weekStreak, type SchedulerInput } from '../engine/scheduler';
import { evaluateDeload, deloadActive } from '../engine/deload';
import { evaluateStage, moveUpAnyway, consistencyWeeks, type GateContext } from '../engine/gates';
import { exerciseById, mainLiftIds, mustExercise } from '../engine/program';
import { toDay, addDays } from '../lib/dates';
import type { Stage } from '../engine/types';

export function schedulerInput(d: AppData, stage: Stage = d.stage): SchedulerInput {
  return {
    today: d.today,
    lifts: d.lifts,
    rides: d.rideLogs,
    targetPerWeek: d.settings.targetPerWeek,
    longRideDays: d.settings.longRideDays,
    preferredTime: d.settings.preferredTime,
    stageId: stage.id,
    split: stage.split,
    workouts: stage.workouts.map((w) => ({ id: w.id, name: w.name, focus: w.focus, lowerHeavy: w.lowerHeavy, estMinutes: w.estMinutes })),
  };
}

export const todayRecommendation = (d: AppData) => recommend(schedulerInput(d));
export const nextTwoWeeks = (d: AppData) => upcoming(schedulerInput(d), 14);
export const streak = (d: AppData) => weekStreak(d.lifts.map((l) => l.day), d.today);

export function gateContext(d: AppData, stage: Stage = d.stage, sessions = d.sessions): GateContext {
  return {
    today: d.today,
    stage,
    sessions,
    sets: d.sets,
    events: d.events,
    bodyWeightKg: d.bodyWeightKg,
    unit: d.settings.loadUnit,
    exercise: exerciseById,
    priorSessions: d.settings.priorStage1Sessions,
    year: d.settings.year,
  };
}

export const stageStatus = (d: AppData, stage: Stage = d.stage) => evaluateStage(gateContext(d, stage));
export const moveUpOffer = (d: AppData) => moveUpAnyway(gateContext(d));

export function deloadAdvice(d: AppData) {
  const mains = mainLiftIds(d.stage).map((id) => ({ ex: mustExercise(id), exposures: d.exposures.get(id) ?? [] }));
  const sessionDay = new Map(d.sessions.map((s) => [s.id, toDay(s.startedAt)]));
  const recentSets = d.sets
    .filter((s) => sessionDay.has(s.sessionId) && d.done.some((x) => x.id === s.sessionId))
    .map((s) => ({ ...s, day: sessionDay.get(s.sessionId)! }))
    .filter((s) => s.day >= addDays(d.today, -7));
  return evaluateDeload({
    today: d.today,
    mainExposures: mains,
    recentSets,
    events: d.events,
    liftDays: d.lifts.map((l) => l.day),
    everyWeeks: d.stage.deloadEveryWeeks,
  });
}
export const isDeloadWeek = (d: AppData) => deloadActive(d.events, d.today);

/** Stage 3's optional "Upper pump" unlocks after 4 straight weeks of 3+ sessions. */
export function optionalUnlocked(d: AppData) {
  const opt = d.stage.optionalWorkouts?.[0];
  if (!opt) return undefined;
  const n = consistencyWeeks(d.lifts.map((l) => l.day), d.today, opt.unlock.minPerWeek, opt.unlock.weeks);
  const lastWeekFull = consistencyWeeks(d.lifts.map((l) => l.day), addDays(d.today, -7), opt.unlock.minPerWeek, opt.unlock.weeks);
  return n >= opt.unlock.weeks || lastWeekFull >= opt.unlock.weeks ? opt : undefined;
}

export const sessionsInStage = (d: AppData, stageId = d.stage.id) =>
  d.done.filter((s) => s.stageId === stageId).length + (stageId === 's1' ? d.settings.priorStage1Sessions : 0);
