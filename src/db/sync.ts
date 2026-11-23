// Optional private sync through a secret GitHub Gist. No accounts: you paste a token
// (gist scope only); it stays on this device and is never exported.
import { exportAll, importBackup, migrateBackup, mergeBackups, type Backup } from './backup';
import { getSettings, saveSettings } from './repo';

const API = 'https://api.github.com';
const FILE = 'rep-backup.json';
const DESCRIPTION = 'Rep backup (private, created by the Rep app)';

export type SyncResult = { ok: true; at: number } | { ok: false; offline?: boolean; message: string };

async function gh(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) throw new Error('GitHub rejected the token. Check it has the "gist" scope and has not expired.');
  if (res.status === 403) throw new Error('GitHub refused the request (rate limit or missing gist permission).');
  if (!res.ok) throw new Error(`GitHub error ${res.status}.`);
  return res;
}

async function findGist(token: string): Promise<string | undefined> {
  for (let page = 1; page <= 5; page++) {
    const res = await gh(token, `/gists?per_page=100&page=${page}`);
    const list = (await res.json()) as { id: string; description: string; files: Record<string, unknown> }[];
    const hit = list.find((g) => g.files && FILE in g.files);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return undefined;
}

async function readGist(token: string, id: string): Promise<Backup | undefined> {
  const res = await gh(token, `/gists/${id}`);
  const g = (await res.json()) as { files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }> };
  const f = g.files[FILE];
  if (!f) return undefined;
  let content = f.content ?? '';
  if (f.truncated && f.raw_url) content = await (await fetch(f.raw_url)).text();
  return migrateBackup(JSON.parse(content));
}

/** Pull remote, merge (newest record wins, nothing silently deleted), write locally, push merged. */
export async function syncNow(): Promise<SyncResult> {
  const s = await getSettings();
  if (!s.gistToken) return { ok: false, message: 'No token set.' };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await saveSettings({ syncPending: true });
    return { ok: false, offline: true, message: "You're offline. I'll sync when you're back online." };
  }
  try {
    let gistId = s.gistId ?? (await findGist(s.gistToken));
    let merged = await exportAll();
    if (gistId) {
      const remote = await readGist(s.gistToken, gistId).catch(() => undefined);
      if (remote) {
        merged = mergeBackups(merged, remote);
        await importBackup(merged, 'merge');
        merged = await exportAll();
      }
    }
    const body = JSON.stringify({ description: DESCRIPTION, files: { [FILE]: { content: JSON.stringify(merged) } } });
    if (gistId) {
      await gh(s.gistToken, `/gists/${gistId}`, { method: 'PATCH', body });
    } else {
      const res = await gh(s.gistToken, '/gists', { method: 'POST', body: JSON.stringify({ ...JSON.parse(body), public: false }) });
      gistId = ((await res.json()) as { id: string }).id;
    }
    const at = Date.now();
    await saveSettings({ gistId, lastSyncAt: at, lastBackupAt: at, syncPending: false });
    return { ok: true, at };
  } catch (e) {
    await saveSettings({ syncPending: true });
    const offline = e instanceof TypeError; // fetch network failure
    return {
      ok: false,
      offline,
      message: offline ? "Couldn't reach GitHub. I'll retry automatically." : (e as Error).message,
    };
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Debounced background sync (after finishing a workout, or when coming back online). */
export function scheduleSync(delayMs = 4000) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const s = await getSettings();
    if (s.gistToken) await syncNow();
  }, delayMs);
}

export function installSyncTriggers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => scheduleSync(1000));
  // Retry anything queued from last time.
  getSettings().then((s) => {
    if (s.gistToken && s.syncPending) scheduleSync(2000);
  });
}
