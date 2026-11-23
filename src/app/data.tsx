// One live snapshot of everything in the database, plus derived values used across screens.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/db';
import type { BodyMetricRec, EventRec, PreferenceRec, RideRec, SessionRec, SetRec, Settings, Stage } from '../engine/types';
import { DEFAULT_SETTINGS, exerciseById, schemeOf, stageById, templateById, firstStage } from '../engine/program';
import { buildExposures, type Exposure } from '../engine/history';
import { bodyWeight7d } from '../engine/gates';
import { toDay, type Day } from '../lib/dates';
import type { LiftLog, RideLog } from '../engine/scheduler';

export type Raw = {
  settings: Settings;
  sessions: SessionRec[];
  sets: SetRec[];
  rides: RideRec[];
  body: BodyMetricRec[];
  events: EventRec[];
  prefs: PreferenceRec[];
};

export type AppData = Raw & {
  today: Day;
  stage: Stage;
  done: SessionRec[];
  active?: SessionRec;
  bodyWeightKg: number;
  exposures: Map<string, Exposure[]>;
  lifts: LiftLog[];
  rideLogs: RideLog[];
};

const alive = <T extends { deletedAt?: number }>(l: T[]) => l.filter((x) => !x.deletedAt);

async function loadRaw(): Promise<Raw> {
  const [settings, sessions, sets, rides, body, events, prefs] = await Promise.all([
    db.settings.get('main'),
    db.sessions.toArray(),
    db.sets.toArray(),
    db.rides.toArray(),
    db.bodyMetrics.toArray(),
    db.events.toArray(),
    db.preferences.toArray(),
  ]);
  return {
    settings: { ...DEFAULT_SETTINGS, updatedAt: 0, ...settings } as Settings,
    sessions: alive(sessions).sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    sets: alive(sets),
    rides: alive(rides).sort((a, b) => a.date.localeCompare(b.date)),
    body: alive(body).sort((a, b) => a.date.localeCompare(b.date)),
    events: alive(events),
    prefs: alive(prefs),
  };
}

export function derive(raw: Raw, now = new Date()): AppData {
  const today = toDay(now);
  const stage = stageById(raw.settings.currentStageId) ?? firstStage;
  const done = raw.sessions.filter((s) => s.status === 'done');
  const active = raw.sessions.filter((s) => s.status === 'in_progress').pop();
  const lifts: LiftLog[] = done.map((s) => {
    const t = templateById(s.workoutTemplateId)?.template;
    return {
      day: toDay(s.startedAt),
      templateId: s.workoutTemplateId,
      focus: t?.focus ?? 'full',
      lowerHeavy: t?.lowerHeavy ?? true,
      isShort: s.isShortVersion,
      isReentry: s.isReentry,
      stageId: s.stageId,
    };
  });
  return {
    ...raw,
    today,
    stage,
    done,
    active,
    bodyWeightKg: bodyWeight7d(raw.body, 75),
    exposures: buildExposures(raw.sessions, raw.sets, schemeOf),
    lifts,
    rideLogs: raw.rides.map((r) => ({ day: toDay(r.date), minutes: r.minutes, type: r.type })),
  };
}

const Ctx = createContext<AppData | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<Raw>();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = liveQuery(loadRaw).subscribe({ next: setRaw, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
  }, []);
  // Re-derive "today" when the app comes back to the foreground on a new day.
  useEffect(() => {
    const on = () => document.visibilityState === 'visible' && setTick((t) => t + 1);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => (raw ? derive(raw) : undefined), [raw, tick]);
  if (!data) return null;
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useData(): AppData {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData outside provider');
  return d;
}

export const exName = (id: string) => exerciseById(id)?.name ?? id;
