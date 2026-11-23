import type { SessionRec, SetRec } from './types';
import { toDay, type Day } from '../lib/dates';

/** One appearance of an exercise in one finished session (working sets only). */
export type Exposure = {
  sessionId: string;
  day: Day;
  at: string;
  templateId: string;
  stageId: string;
  exerciseId: string;
  /** Rep scheme key of the slot it was done in, e.g. "8-12-double". */
  scheme?: string;
  isDeload: boolean;
  isReentry: boolean;
  isShort: boolean;
  legsLight: boolean;
  sets: SetRec[];
};

export type SchemeResolver = (templateId: string, slotIndex: number) => string | undefined;

export const schemeKey = (repMin: number, repMax: number, progression: string) =>
  `${repMin}-${repMax}-${progression}`;

/** Group finished sessions' working sets into per-exercise exposures, oldest first. */
export function buildExposures(
  sessions: SessionRec[],
  sets: SetRec[],
  schemeOf: SchemeResolver = () => undefined,
): Map<string, Exposure[]> {
  const done = new Map(sessions.filter((s) => s.status === 'done' && !s.deletedAt).map((s) => [s.id, s]));
  const byKey = new Map<string, Exposure>();
  for (const set of sets) {
    if (set.deletedAt || set.isWarmup || set.kind !== 'work') continue;
    const s = done.get(set.sessionId);
    if (!s) continue;
    const key = `${s.id}|${set.exerciseId}`;
    let exp = byKey.get(key);
    if (!exp) {
      exp = {
        sessionId: s.id,
        day: toDay(s.startedAt),
        at: s.startedAt,
        templateId: s.workoutTemplateId,
        stageId: s.stageId,
        exerciseId: set.exerciseId,
        scheme: schemeOf(s.workoutTemplateId, set.slotIndex),
        isDeload: s.isDeload,
        isReentry: s.isReentry,
        isShort: s.isShortVersion,
        legsLight: !!s.legsLight,
        sets: [],
      };
      byKey.set(key, exp);
    }
    exp.sets.push(set);
  }
  const out = new Map<string, Exposure[]>();
  for (const exp of byKey.values()) {
    exp.sets.sort((a, b) => a.setIndex - b.setIndex);
    const list = out.get(exp.exerciseId) ?? [];
    list.push(exp);
    out.set(exp.exerciseId, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.at.localeCompare(b.at));
  return out;
}
