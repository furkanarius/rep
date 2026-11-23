import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../src/db/repo';
import { syncNow } from '../src/db/sync';

beforeEach(async () => {
  await repo.resetAll();
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('gist sync', () => {
  it('creates a secret gist and records sync time; token never uploaded', async () => {
    await repo.saveSettings({ gistToken: 'tok_123456789012345678901', onboardingDone: true });
    const bodies: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.body) bodies.push(String(init.body));
      if (url.includes('/gists?')) return new Response('[]', { status: 200 });
      if (init?.method === 'POST') return new Response(JSON.stringify({ id: 'g1' }), { status: 201 });
      return new Response('{}', { status: 200 });
    }));
    const r = await syncNow();
    expect(r.ok).toBe(true);
    expect(JSON.parse(bodies[0]).public).toBe(false);
    expect(bodies[0]).not.toContain('tok_123');
    const s = await repo.getSettings();
    expect(s.gistId).toBe('g1');
    expect(s.syncPending).toBe(false);
  });
  it('merges remote records (newest wins) before pushing', async () => {
    await repo.saveSettings({ gistToken: 'tok_123456789012345678901', gistId: 'g1' });
    const remote = { app: 'rep', format: 1, sessions: [], sets: [], rides: [{ id: 'r1', date: '2026-11-20', minutes: 30, type: 'commute', updatedAt: 5 }], bodyMetrics: [], events: [], preferences: [] };
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') return new Response(JSON.stringify({ files: { 'rep-backup.json': { content: JSON.stringify(remote) } } }), { status: 200 });
      return new Response('{}', { status: 200 });
    }));
    expect((await syncNow()).ok).toBe(true);
    expect((await repo.listRides()).map((r) => r.id)).toEqual(['r1']);
  });
  it('offline: queues and reports gracefully', async () => {
    await repo.saveSettings({ gistToken: 'tok_123456789012345678901' });
    vi.stubGlobal('navigator', { onLine: false });
    const r = await syncNow();
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.offline).toBe(true);
    expect((await repo.getSettings()).syncPending).toBe(true);
  });
  it('network failure mid-sync: queued for retry, nothing lost', async () => {
    await repo.saveSettings({ gistToken: 'tok_123456789012345678901', gistId: 'g1' });
    await repo.addRide('2026-11-21', 45, 'long');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const r = await syncNow();
    expect(r.ok).toBe(false);
    expect((await repo.getSettings()).syncPending).toBe(true);
    expect(await repo.listRides()).toHaveLength(1);
  });
  it('bad token: clear message', async () => {
    await repo.saveSettings({ gistToken: 'tok_123456789012345678901' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    const r = await syncNow();
    expect(r.ok === false && r.message).toMatch(/token/);
  });
});
