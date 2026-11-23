// IndexedDB schema (Dexie). Bump the version and add an upgrade() for every schema change.
import Dexie, { type Table } from 'dexie';
import type { BodyMetricRec, EventRec, PreferenceRec, RideRec, SessionRec, SetRec, Settings } from '../engine/types';

export class RepDB extends Dexie {
  settings!: Table<Settings, string>;
  sessions!: Table<SessionRec, string>;
  sets!: Table<SetRec, string>;
  rides!: Table<RideRec, string>;
  bodyMetrics!: Table<BodyMetricRec, string>;
  events!: Table<EventRec, string>;
  preferences!: Table<PreferenceRec, string>;

  constructor(name = 'rep') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      sessions: 'id, startedAt, status, stageId, workoutTemplateId, updatedAt',
      sets: 'id, sessionId, exerciseId, completedAt, updatedAt',
      rides: 'id, date, updatedAt',
      bodyMetrics: 'id, date, updatedAt',
      events: 'id, type, date, exerciseId, updatedAt',
      preferences: 'id, updatedAt',
    });
    // Migration path example for the future:
    // this.version(2).stores({ sets: 'id, sessionId, exerciseId, completedAt, updatedAt, [sessionId+exerciseId]' })
    //   .upgrade((tx) => tx.table('sets').toCollection().modify((s) => { s.kind ??= s.isWarmup ? 'warmup' : 'work'; }));
  }
}

export const SCHEMA_VERSION = 1;
export const db = new RepDB();
