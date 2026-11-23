import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { RepDB } from '../src/db/db';
import { migrateBackup } from '../src/db/backup';

describe('migrations', () => {
  it('v1 → v2: old "calibration" sets become counted trial work sets', async () => {
    const old = new Dexie('migr');
    old.version(1).stores({ settings: 'id', sessions: 'id, startedAt, status, stageId, workoutTemplateId, updatedAt', sets: 'id, sessionId, exerciseId, completedAt, updatedAt', rides: 'id, date, updatedAt', bodyMetrics: 'id, date, updatedAt', events: 'id, type, date, exerciseId, updatedAt', preferences: 'id, updatedAt' });
    await old.table('sets').bulkPut([
      { id: 'a', sessionId: 's', exerciseId: 'leg-press', kind: 'calibration', isWarmup: true, weight: 40, reps: 10, updatedAt: 1 },
      { id: 'b', sessionId: 's', exerciseId: 'leg-press', kind: 'work', isWarmup: false, weight: 50, reps: 10, updatedAt: 1 },
    ]);
    old.close();
    const db = new RepDB('migr');
    const sets = await db.sets.toArray();
    expect(sets.find((s) => s.id === 'a')).toMatchObject({ kind: 'work', isWarmup: false, trial: true });
    expect(sets.find((s) => s.id === 'b')?.trial).toBeUndefined();
    db.close();
  });
  it('old backup files get the same upgrade on import', () => {
    const b = migrateBackup({ app: 'rep', format: 1, sets: [{ id: 'a', kind: 'calibration', isWarmup: true }] });
    expect(b.sets[0]).toMatchObject({ kind: 'work', isWarmup: false, trial: true });
  });
});
