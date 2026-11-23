import type { Feel, SessionRec, SetRec } from '../src/engine/types';
import { lbToKg } from '../src/lib/units';

let n = 0;
export const id = () => `id${++n}`;

export type SetSpec = { ex: string; lb: number; reps: number[]; feel?: Feel | Feel[]; slot?: number; kg?: boolean };

export function session(
  day: string,
  templateId: string,
  specs: SetSpec[],
  extra: Partial<SessionRec> = {},
): { session: SessionRec; sets: SetRec[] } {
  const s: SessionRec = {
    id: id(),
    workoutTemplateId: templateId,
    stageId: templateId.split('-')[0],
    startedAt: `${day}T07:00:00.000`,
    finishedAt: `${day}T07:45:00.000`,
    status: 'done',
    isShortVersion: false,
    isDeload: false,
    isReentry: false,
    updatedAt: 1,
    ...extra,
  };
  const sets: SetRec[] = [];
  specs.forEach((sp, i) => {
    sp.reps.forEach((r, k) => {
      const feel = Array.isArray(sp.feel) ? sp.feel[k] : sp.feel;
      const w = sp.kg ? sp.lb : lbToKg(sp.lb);
      sets.push({
        id: id(),
        sessionId: s.id,
        exerciseId: sp.ex,
        slotIndex: sp.slot ?? i,
        setIndex: k,
        isWarmup: false,
        kind: 'work',
        targetWeight: w,
        targetReps: r,
        weight: w,
        reps: r,
        feel: feel ?? 'solid',
        completedAt: `${day}T07:${String(10 + k).padStart(2, '0')}:00.000`,
        updatedAt: 1,
      });
    });
  });
  return { session: s, sets };
}

export function collect(list: { session: SessionRec; sets: SetRec[] }[]) {
  return { sessions: list.map((l) => l.session), sets: list.flatMap((l) => l.sets) };
}
