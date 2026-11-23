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
    // v2: "find your weight" trial sets now count as real working sets (flagged `trial`).
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('sets')
          .toCollection()
          .modify((s: { kind: string; isWarmup: boolean; trial?: boolean; updatedAt: number }) => {
            if (s.kind === 'calibration') {
              s.kind = 'work';
              s.isWarmup = false;
              s.trial = true;
              s.updatedAt = Date.now();
            }
          }),
      );
  }
}

export const SCHEMA_VERSION = 2;
export const db = new RepDB();
