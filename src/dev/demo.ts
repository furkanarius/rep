// DEV ONLY: generates ~10 weeks of realistic history so charts can be tested.
// Never bundled into production (imported dynamically behind import.meta.env.DEV).
import { db } from '../db/db';
import { stageById, mustExercise } from '../engine/program';
import { buildExposures } from '../engine/history';
import { schemeOf } from '../engine/program';
import { buildSession } from '../engine/session';
import { getSettings, saveSettings } from '../db/repo';
import { addDays, toDay, weekStart, isoWeekday } from '../lib/dates';
import { uid } from '../lib/id';
import type { SessionRec, SetRec, Feel } from '../engine/types';
import { lbToKg } from '../lib/units';

export async function loadDemoData() {
  const settings = await getSettings();
  const s1 = stageById('s1')!;
  const today = toDay(new Date());
  let day = addDays(weekStart(today), -70);
  const sessions: SessionRec[] = [];
  const sets: SetRec[] = [];
  let k = 0;
  const startLb: Record<string, number> = { 'leg-press': 110, 'chest-press-machine': 60, 'lat-pulldown': 70, 'seated-leg-curl': 50, 'shoulder-press-machine': 40, 'goblet-squat': 30, 'seated-cable-row': 70, 'incline-dumbbell-press': 25, 'dumbbell-rdl': 25, 'dumbbell-curl': 15, 'triceps-pushdown': 35 };
  while (day < today) {
    const wd = isoWeekday(day);
    if ((wd === 1 || wd === 3 || wd === 5) && !(k % 7 === 6)) {
      const template = s1.workouts[k % 2];
      const exps = buildExposures(sessions, sets, schemeOf);
      const plan = buildSession({ stage: s1, template, settings, preferences: [], exposures: exps, bodyWeightKg: 75, sessionsInStage: k, short: false, mode: 'normal', legsLight: false, today: day });
      const sess: SessionRec = { id: uid(), workoutTemplateId: template.id, stageId: 's1', startedAt: `${day}T06:50:00.000Z`, finishedAt: `${day}T07:35:00.000Z`, status: 'done', isShortVersion: false, isDeload: false, isReentry: false, updatedAt: Date.now() };
      sessions.push(sess);
      for (const p of plan) {
        const w = p.calibrate ? lbToKg(startLb[p.exercise.id] ?? 20) : p.targetWeightKg;
        for (let i = 0; i < p.sets; i++) {
          const reps = Math.max(p.repMin, Math.min(p.repMax, p.targetReps + (Math.random() < 0.6 ? 1 : 0) - (i === p.sets - 1 && Math.random() < 0.3 ? 1 : 0)));
          const feel: Feel = Math.random() < 0.2 ? 'easy' : Math.random() < 0.85 ? 'solid' : 'max';
          sets.push({ id: uid(), sessionId: sess.id, exerciseId: p.exercise.id, slotIndex: p.slotIndex, setIndex: i, isWarmup: false, kind: 'work', targetWeight: w, targetReps: p.targetReps, weight: p.exercise.loadType === 'time' || p.exercise.loadType === 'bodyweight' ? 0 : w, reps, feel, completedAt: `${day}T07:${String(10 + i).padStart(2, '0')}:00.000Z`, updatedAt: Date.now() });
        }
      }
      k++;
    }
    if (wd === 2 || wd === 4) await db.rides.put({ id: uid(), date: day, minutes: 30, type: 'commute', updatedAt: Date.now() });
    if (wd === 6) await db.rides.put({ id: uid(), date: day, minutes: 120, type: 'long', updatedAt: Date.now() });
    if (wd === 1) await db.bodyMetrics.put({ id: uid(), date: day, weightKg: 75 - k * 0.04 + Math.random() * 0.6, waistNavelCm: 97.5 - k * 0.05, updatedAt: Date.now() });
    day = addDays(day, 1);
  }
  await db.sessions.bulkPut(sessions);
  await db.sets.bulkPut(sets);
  await saveSettings({ onboardingDone: true });
  void mustExercise;
}
