// Typed data-access layer. UI code talks to these functions, never to Dexie directly,
// so storage can be swapped later.
import { db } from './db';
import type {
  BodyMetricRec,
  EventRec,
  EventType,
  Feel,
  PreferenceRec,
  RideRec,
  RideType,
  SessionRec,
  SetRec,
  Settings,
} from '../engine/types';
import { DEFAULT_SETTINGS } from '../engine/program';
import { uid } from '../lib/id';

const now = () => Date.now();
const alive = <T extends { deletedAt?: number }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

/** Called after any write so sync can be scheduled. */
let onChange: (() => void) | undefined;
export const setChangeListener = (fn: () => void) => (onChange = fn);
const changed = () => onChange?.();

// ---------- settings ----------
export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('main');
  if (s) return { ...DEFAULT_SETTINGS, ...s };
  const fresh = { ...DEFAULT_SETTINGS, updatedAt: now() } as Settings;
  await db.settings.put(fresh);
  return fresh;
}
export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings();
  const next = { ...cur, ...patch, id: 'main' as const, updatedAt: now() };
  await db.settings.put(next);
  // Local-only fields (token, sync status) shouldn't trigger a sync push.
  const localOnly = Object.keys(patch).every((k) => ['gistToken', 'gistId', 'lastSyncAt', 'syncPending', 'lastBackupAt'].includes(k));
  if (!localOnly) changed();
  return next;
}

// ---------- sessions & sets ----------
export const listSessions = async () => alive(await db.sessions.orderBy('startedAt').toArray());
export const listSets = async () => alive(await db.sets.toArray());
export const getSession = (id: string) => db.sessions.get(id);
export const setsForSession = async (sessionId: string) =>
  alive(await db.sets.where('sessionId').equals(sessionId).toArray()).sort(
    (a, b) => a.slotIndex - b.slotIndex || a.setIndex - b.setIndex,
  );
export async function activeSession(): Promise<SessionRec | undefined> {
  const list = alive(await db.sessions.where('status').equals('in_progress').toArray());
  return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

export async function startSession(input: Omit<SessionRec, 'id' | 'updatedAt' | 'status' | 'startedAt'> & { startedAt?: string }) {
  const s: SessionRec = { ...input, id: uid(), startedAt: input.startedAt ?? new Date().toISOString(), status: 'in_progress', updatedAt: now() };
  await db.sessions.put(s);
  changed();
  return s;
}
export async function updateSession(id: string, patch: Partial<SessionRec>) {
  await db.sessions.update(id, { ...patch, updatedAt: now() });
  changed();
}
export async function finishSession(id: string) {
  await updateSession(id, { status: 'done', finishedAt: new Date().toISOString() });
}
export async function discardSession(id: string) {
  await updateSession(id, { status: 'discarded', finishedAt: new Date().toISOString() });
}
/** Soft delete (tombstone) so sync never resurrects or silently loses it. */
export async function deleteSession(id: string) {
  const t = now();
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.update(id, { deletedAt: t, updatedAt: t });
    await db.sets.where('sessionId').equals(id).modify({ deletedAt: t, updatedAt: t });
  });
  changed();
}

export async function logSet(s: Omit<SetRec, 'id' | 'updatedAt' | 'completedAt'> & { completedAt?: string }) {
  const rec: SetRec = { ...s, id: uid(), completedAt: s.completedAt ?? new Date().toISOString(), updatedAt: now() };
  await db.sets.put(rec);
  changed();
  return rec;
}
export async function updateSet(id: string, patch: Partial<SetRec>) {
  await db.sets.update(id, { ...patch, updatedAt: now() });
  changed();
}
export async function setFeel(id: string, feel: Feel) {
  await updateSet(id, { feel });
}
export async function deleteSet(id: string) {
  const t = now();
  await db.sets.update(id, { deletedAt: t, updatedAt: t });
  changed();
}

// ---------- rides, body, events, preferences ----------
export const listRides = async () => alive(await db.rides.orderBy('date').toArray());
export async function addRide(date: string, minutes: number, type: RideType) {
  const r: RideRec = { id: uid(), date, minutes, type, updatedAt: now() };
  await db.rides.put(r);
  changed();
  return r;
}
export async function deleteRide(id: string) {
  await db.rides.update(id, { deletedAt: now(), updatedAt: now() });
  changed();
}

export const listBody = async () => alive(await db.bodyMetrics.orderBy('date').toArray());
export async function addBody(m: Omit<BodyMetricRec, 'id' | 'updatedAt'>) {
  const r: BodyMetricRec = { ...m, id: uid(), updatedAt: now() };
  await db.bodyMetrics.put(r);
  changed();
  return r;
}
export async function deleteBody(id: string) {
  await db.bodyMetrics.update(id, { deletedAt: now(), updatedAt: now() });
  changed();
}

export const listEvents = async () => alive(await db.events.orderBy('date').toArray());
export async function addEvent(type: EventType, extra: Partial<EventRec> = {}) {
  const e: EventRec = { id: uid(), type, date: new Date().toISOString(), ...extra, updatedAt: now() };
  await db.events.put(e);
  if (type !== 'tip-seen') changed();
  return e;
}

export const listPreferences = async () => alive(await db.preferences.toArray());
export async function setPreference(exerciseId: string, patch: Partial<PreferenceRec>) {
  const cur = (await db.preferences.get(exerciseId)) ?? { id: exerciseId, updatedAt: now() };
  const next = { ...cur, ...patch, id: exerciseId, updatedAt: now() };
  await db.preferences.put(next);
  changed();
  return next;
}

/** Erase everything (behind a typed confirmation in Settings). */
export async function resetAll() {
  await db.transaction('rw', [db.settings, db.sessions, db.sets, db.rides, db.bodyMetrics, db.events, db.preferences], async () => {
    await Promise.all([db.settings.clear(), db.sessions.clear(), db.sets.clear(), db.rides.clear(), db.bodyMetrics.clear(), db.events.clear(), db.preferences.clear()]);
  });
}
