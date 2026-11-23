// Export / import / merge. The backup format is versioned so old files can be migrated.
import { db } from './db';
import type { BodyMetricRec, EventRec, PreferenceRec, RideRec, SessionRec, SetRec, Settings, Syncable } from '../engine/types';

export const BACKUP_FORMAT = 1;

export type Backup = {
  app: 'rep';
  format: number;
  exportedAt: string;
  settings?: Omit<Settings, 'gistToken'>;
  sessions: SessionRec[];
  sets: SetRec[];
  rides: RideRec[];
  bodyMetrics: BodyMetricRec[];
  events: EventRec[];
  preferences: PreferenceRec[];
};

const LOCAL_ONLY: (keyof Settings)[] = ['gistToken', 'gistId', 'lastSyncAt', 'syncPending', 'lastBackupAt'];

export async function exportAll(): Promise<Backup> {
  const [settings, sessions, sets, rides, bodyMetrics, events, preferences] = await Promise.all([
    db.settings.get('main'),
    db.sessions.toArray(),
    db.sets.toArray(),
    db.rides.toArray(),
    db.bodyMetrics.toArray(),
    db.events.toArray(),
    db.preferences.toArray(),
  ]);
  let cleanSettings: Backup['settings'];
  if (settings) {
    const copy: Partial<Settings> = { ...settings };
    for (const k of LOCAL_ONLY) delete copy[k];
    cleanSettings = copy as Backup['settings'];
  }
  return {
    app: 'rep',
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    settings: cleanSettings,
    sessions,
    sets,
    rides,
    bodyMetrics,
    events: events.filter((e) => e.type !== 'tip-seen'),
    preferences,
  };
}

/** Upgrade older backup files to the current format. */
export function migrateBackup(raw: unknown): Backup {
  const b = raw as Partial<Backup> & { format?: number };
  if (!b || b.app !== 'rep') throw new Error("This doesn't look like a Rep backup file.");
  const format = b.format ?? 1;
  if (format > BACKUP_FORMAT) throw new Error('This backup was made by a newer version of Rep. Update the app first.');
  // format 1 is current. Future: if (format === 1) { …transform… }
  return {
    app: 'rep',
    format: BACKUP_FORMAT,
    exportedAt: b.exportedAt ?? new Date().toISOString(),
    settings: b.settings,
    sessions: b.sessions ?? [],
    sets: b.sets ?? [],
    rides: b.rides ?? [],
    bodyMetrics: b.bodyMetrics ?? [],
    events: b.events ?? [],
    preferences: b.preferences ?? [],
  };
}

/** Per-record merge: newest updatedAt wins. Records are never dropped (deletes are tombstones). */
export function mergeRecords<T extends Syncable>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of local) map.set(r.id, r);
  for (const r of remote) {
    const cur = map.get(r.id);
    if (!cur || (r.updatedAt ?? 0) > (cur.updatedAt ?? 0)) map.set(r.id, r);
  }
  return [...map.values()];
}

export function mergeBackups(local: Backup, remote: Backup): Backup {
  const settings =
    !local.settings || (remote.settings && (remote.settings.updatedAt ?? 0) > (local.settings.updatedAt ?? 0))
      ? remote.settings
      : local.settings;
  return {
    ...local,
    exportedAt: new Date().toISOString(),
    settings,
    sessions: mergeRecords(local.sessions, remote.sessions),
    sets: mergeRecords(local.sets, remote.sets),
    rides: mergeRecords(local.rides, remote.rides),
    bodyMetrics: mergeRecords(local.bodyMetrics, remote.bodyMetrics),
    events: mergeRecords(local.events, remote.events),
    preferences: mergeRecords(local.preferences, remote.preferences),
  };
}

/** Write a backup into the database. mode 'merge' keeps newer local records; 'replace' wipes first. */
export async function importBackup(raw: unknown, mode: 'merge' | 'replace' = 'merge') {
  const incoming = migrateBackup(raw);
  const data = mode === 'merge' ? mergeBackups(await exportAll(), incoming) : incoming;
  const localSettings = await db.settings.get('main');
  await db.transaction('rw', [db.settings, db.sessions, db.sets, db.rides, db.bodyMetrics, db.events, db.preferences], async () => {
    if (mode === 'replace') {
      await Promise.all([db.sessions.clear(), db.sets.clear(), db.rides.clear(), db.bodyMetrics.clear(), db.events.clear(), db.preferences.clear()]);
    }
    if (data.settings) {
      const keep: Partial<Settings> = {};
      for (const k of LOCAL_ONLY) if (localSettings && localSettings[k] !== undefined) (keep as Record<string, unknown>)[k] = localSettings[k];
      await db.settings.put({ ...(data.settings as Settings), ...keep, id: 'main' });
    }
    await db.sessions.bulkPut(data.sessions);
    await db.sets.bulkPut(data.sets);
    await db.rides.bulkPut(data.rides);
    await db.bodyMetrics.bulkPut(data.bodyMetrics);
    await db.events.bulkPut(data.events);
    await db.preferences.bulkPut(data.preferences);
  });
  return data;
}

/** CSV of every set, one row per set, for spreadsheets. */
export function setsCsv(b: Backup, exerciseName: (id: string) => string): string {
  const sessions = new Map(b.sessions.map((s) => [s.id, s]));
  const head = ['date', 'workout', 'exercise', 'set', 'warmup', 'weight_kg', 'weight_lb', 'reps_or_seconds', 'feel', 'session_status'];
  const rows = b.sets
    .filter((s) => !s.deletedAt)
    .sort((a, x) => a.completedAt.localeCompare(x.completedAt))
    .map((s) => {
      const ses = sessions.get(s.sessionId);
      return [
        s.completedAt,
        ses?.workoutTemplateId ?? '',
        exerciseName(s.exerciseId),
        s.setIndex + 1,
        s.isWarmup ? 'yes' : 'no',
        s.weight.toFixed(2),
        (s.weight / 0.45359237).toFixed(1),
        s.reps,
        s.feel ?? '',
        ses?.status ?? '',
      ];
    });
  const esc = (v: unknown) => {
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n') + '\n';
}
