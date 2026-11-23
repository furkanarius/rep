import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportAll, importBackup, mergeRecords, migrateBackup, setsCsv } from '../src/db/backup';
import * as repo from '../src/db/repo';

beforeEach(async () => {
  await repo.resetAll();
});

describe('backup', () => {
  it('export → reset → import round-trips every record losslessly', async () => {
    await repo.saveSettings({ loadUnit: 'kg', onboardingDone: true, gistToken: 'secret-token' });
    const s = await repo.startSession({ workoutTemplateId: 's1-a', stageId: 's1', isShortVersion: false, isDeload: false, isReentry: false });
    await repo.logSet({ sessionId: s.id, exerciseId: 'leg-press', slotIndex: 0, setIndex: 0, isWarmup: false, kind: 'work', targetWeight: 40, targetReps: 10, weight: 40.82, reps: 10, feel: 'easy' });
    await repo.finishSession(s.id);
    await repo.addRide('2026-11-20', 35, 'commute');
    await repo.addBody({ date: '2026-11-20', weightKg: 75.2, waistNavelCm: 97.5 });
    await repo.addEvent('pain', { exerciseId: 'leg-press', data: { note: 'knee' } });
    await repo.setPreference('leg-press', { alwaysSubstituteWith: 'hack-squat' });

    const before = await exportAll();
    expect(JSON.stringify(before)).not.toContain('secret-token');
    const file = JSON.parse(JSON.stringify(before));
    await repo.resetAll();
    await importBackup(file, 'replace');
    const after = await exportAll();
    const strip = (b: typeof before) => ({ ...b, exportedAt: '' });
    expect(strip(after)).toEqual(strip(before));
  });

  it('merge keeps the newest version of each record and never drops records', () => {
    const local = [{ id: 'a', updatedAt: 5, v: 1 }, { id: 'b', updatedAt: 1, v: 1 }];
    const remote = [{ id: 'a', updatedAt: 3, v: 2 }, { id: 'b', updatedAt: 9, v: 2 }, { id: 'c', updatedAt: 1, v: 2 }];
    const m = mergeRecords(local, remote);
    expect(m.find((x) => x.id === 'a')?.v).toBe(1);
    expect(m.find((x) => x.id === 'b')?.v).toBe(2);
    expect(m).toHaveLength(3);
  });

  it('deletions travel as tombstones', async () => {
    const s = await repo.startSession({ workoutTemplateId: 's1-a', stageId: 's1', isShortVersion: false, isDeload: false, isReentry: false });
    await repo.deleteSession(s.id);
    expect(await repo.listSessions()).toHaveLength(0);
    const b = await exportAll();
    expect(b.sessions[0].deletedAt).toBeTruthy();
  });

  it('rejects files that are not Rep backups or are from the future', () => {
    expect(() => migrateBackup({ foo: 1 })).toThrow();
    expect(() => migrateBackup({ app: 'rep', format: 99 })).toThrow(/newer version/);
  });

  it('exports a CSV of sets', async () => {
    const s = await repo.startSession({ workoutTemplateId: 's1-a', stageId: 's1', isShortVersion: false, isDeload: false, isReentry: false });
    await repo.logSet({ sessionId: s.id, exerciseId: 'leg-press', slotIndex: 0, setIndex: 0, isWarmup: false, kind: 'work', targetWeight: 40, targetReps: 10, weight: 40.82, reps: 10 });
    const csv = setsCsv(await exportAll(), (id) => (id === 'leg-press' ? 'Leg press' : id));
    expect(csv.split('\n')[0]).toMatch(/^date,workout,exercise/);
    expect(csv).toContain('Leg press,1,no,40.82,90.0,10');
  });
});
