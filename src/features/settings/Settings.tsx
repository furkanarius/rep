import { useEffect, useRef, useState } from 'react';
import { useData } from '../../app/data';
import * as repo from '../../db/repo';
import { exportAll, importBackup, setsCsv } from '../../db/backup';
import { syncNow } from '../../db/sync';
import { exerciseById, allTemplates } from '../../engine/program';
import { nextTwoWeeks } from '../../app/derive';
import { buildIcs } from '../../engine/ics';
import type { Increments, Settings as S } from '../../engine/types';
import { WEEKDAY_SHORT, timeAgo } from '../../lib/dates';
import { Confirm } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { lsSet } from '../../lib/storage';

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function Settings() {
  const d = useData();
  const s = d.settings;
  const toast = useToast();
  const save = (p: Partial<S>) => repo.saveSettings(p);
  const [persist, setPersist] = useState<string>('Checking…');
  const [token, setToken] = useState('');
  const [syncMsg, setSyncMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [resetText, setResetText] = useState('');
  const [importMode, setImportMode] = useState<{ data: unknown } | undefined>();
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      if (!navigator.storage?.persisted) return setPersist('Not supported by this browser');
      let p = await navigator.storage.persisted();
      if (!p && navigator.storage.persist) p = await navigator.storage.persist();
      setPersist(p ? 'On: the browser promised not to clear your data' : 'Not granted (adding Rep to your Home Screen usually helps)');
    })();
  }, []);

  const inc = s.loadUnit === 'lb' ? s.incrementsLb : s.incrementsKg;
  const setInc = (k: keyof Increments, v: number) =>
    save(s.loadUnit === 'lb' ? { incrementsLb: { ...s.incrementsLb, [k]: v } } : { incrementsKg: { ...s.incrementsKg, [k]: v } });

  const runSync = async () => {
    setBusy(true);
    const r = await syncNow();
    setBusy(false);
    setSyncMsg(r.ok ? 'Synced just now.' : r.message);
  };

  return (
    <div className="page">
      <h2>Units</h2>
      <Row label="Gym weights">
        <Seg value={s.loadUnit} options={['lb', 'kg']} onChange={(v) => save({ loadUnit: v })} />
      </Row>
      <Row label="Body weight">
        <Seg value={s.bodyUnit} options={['kg', 'lb']} onChange={(v) => save({ bodyUnit: v })} />
      </Row>
      <Row label="Measurements">
        <Seg value={s.lengthUnit} options={['cm', 'in']} onChange={(v) => save({ lengthUnit: v })} />
      </Row>

      <h2>Schedule</h2>
      <Row label="Sessions per week">
        <Seg value={String(s.targetPerWeek)} options={['2', '3', '4']} onChange={(v) => save({ targetPerWeek: Number(v) })} />
      </Row>
      <Row label="Training time">
        <Seg value={s.preferredTime} options={['morning', 'midday', 'evening']} onChange={(v) => save({ preferredTime: v })} />
      </Row>
      <div className="field">
        <span>Usual long-ride days</span>
        <div className="chips">
          {WEEKDAY_SHORT.map((w, i) => (
            <button
              key={w}
              className="chip"
              style={{ minWidth: 48, justifyContent: 'center', padding: 0 }}
              aria-pressed={s.longRideDays.includes(i + 1)}
              onClick={() => save({ longRideDays: s.longRideDays.includes(i + 1) ? s.longRideDays.filter((x) => x !== i + 1) : [...s.longRideDays, i + 1] })}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
      <button
        className="btn block"
        onClick={() => {
          const list = nextTwoWeeks(d);
          const names = Object.fromEntries(allTemplates(d.stage).map((w) => [w.id, w.name]));
          download('rep-next-2-weeks.ics', buildIcs(list, names, s.preferredTime, window.location.href.split('#')[0]), 'text/calendar');
          toast(`${list.length} suggested sessions exported`);
        }}
      >
        Add my next 2 weeks to Calendar (.ics)
      </button>

      <h2>Equipment steps ({s.loadUnit})</h2>
      <p className="small muted">How much the weight goes up by on each kind of equipment.</p>
      {(
        [
          ['machine', 'Machine stack'],
          ['cable', 'Cable stack'],
          ['dumbbell', 'Dumbbells (per hand)'],
          ['barbell', 'Barbell (total)'],
          ['bodyweight', 'Added weight (dip belt)'],
        ] as [keyof Increments, string][]
      ).map(([k, label]) => (
        <Row key={k} label={label}>
          <input
            className="input"
            style={{ width: 96 }}
            inputMode="decimal"
            aria-label={`${label} step in ${s.loadUnit}`}
            defaultValue={inc[k]}
            onBlur={(e) => {
              const v = parseFloat(e.target.value.replace(',', '.'));
              if (v > 0) setInc(k, v);
            }}
          />
        </Row>
      ))}

      <h2>App</h2>
      <Row label="Rest timer sound">
        <Seg value={s.sound ? 'on' : 'off'} options={['on', 'off']} onChange={(v) => save({ sound: v === 'on' })} />
      </Row>
      <Row label="Theme">
        <Seg value={s.theme} options={['system', 'light', 'dark']} onChange={(v) => save({ theme: v })} />
      </Row>
      <button
        className="btn ghost"
        onClick={() => {
          for (const k of Object.keys(localStorage)) if (k.startsWith('rep:tip')) lsSet(k, undefined);
          toast('Tips will show again.');
        }}
      >
        Show the beginner tips again
      </button>

      <h2 id="backup">Backup & sync</h2>
      <div className="card">
        <p className="small" style={{ margin: 0 }}>
          <strong>Storage protection:</strong> {persist}
        </p>
        <p className="small muted">
          Last backup: {s.lastBackupAt ? timeAgo(s.lastBackupAt) : 'never'}
        </p>
      </div>
      <div className="card">
        <strong>Private sync with a GitHub Gist</strong>
        <p className="small muted">
          Keeps a copy in a secret Gist after every workout, and syncs between phone and laptop. Paste a token with only the "gist" scope. It
          stays on this device and is never exported. See the README for the 5 steps.
        </p>
        {s.gistToken ? (
          <>
            <p className="small">
              Status:{' '}
              {s.syncPending ? 'waiting to sync (will retry when online)' : s.lastSyncAt ? `last synced ${timeAgo(s.lastSyncAt)}` : 'not synced yet'}
            </p>
            {syncMsg && <p className="small">{syncMsg}</p>}
            <div className="grid2">
              <button className="btn primary" onClick={runSync} disabled={busy}>
                {busy ? 'Syncing…' : 'Sync now'}
              </button>
              <button className="btn" onClick={() => save({ gistToken: undefined, gistId: undefined, lastSyncAt: undefined, syncPending: false })}>
                Turn off
              </button>
            </div>
          </>
        ) : (
          <>
            <input className="input" type="password" autoComplete="off" placeholder="ghp_… or github_pat_…" aria-label="GitHub token with gist scope" value={token} onChange={(e) => setToken(e.target.value)} />
            <button
              className="btn primary block"
              style={{ marginTop: 8 }}
              disabled={token.trim().length < 20}
              onClick={async () => {
                await save({ gistToken: token.trim() });
                setToken('');
                await runSync();
              }}
            >
              Save token & sync
            </button>
          </>
        )}
      </div>
      <div className="grid2">
        <button
          className="btn"
          onClick={async () => {
            const b = await exportAll();
            download(`rep-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 1), 'application/json');
            await save({ lastBackupAt: Date.now() });
          }}
        >
          Export JSON
        </button>
        <button
          className="btn"
          onClick={async () => download(`rep-sets-${new Date().toISOString().slice(0, 10)}.csv`, setsCsv(await exportAll(), (id) => exerciseById(id)?.name ?? id), 'text/csv')}
        >
          Export CSV (sets)
        </button>
      </div>
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => file.current?.click()}>
        Import a JSON backup
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            setImportMode({ data: JSON.parse(await f.text()) });
          } catch {
            toast("That file isn't valid JSON.");
          }
        }}
      />

      <h2>About</h2>
      <a className="btn block" href="#/about">
        About the plan
      </a>
      {import.meta.env.DEV && <DemoData />}

      <h2>Danger zone</h2>
      <button className="btn danger block" onClick={() => setReset(true)}>
        Reset app (erase everything)
      </button>

      {importMode && (
        <Confirm
          title="Import backup?"
          body="Records are merged: for each one, the newest version wins. Nothing is deleted."
          confirmLabel="Import"
          onCancel={() => setImportMode(undefined)}
          onConfirm={async () => {
            try {
              await importBackup(importMode.data, 'merge');
              toast('Backup imported.');
            } catch (err) {
              toast((err as Error).message);
            }
            setImportMode(undefined);
          }}
        />
      )}
      {reset && (
        <Confirm
          title="Erase everything?"
          body={
            <>
              <p>This deletes all workouts, rides and settings on this device. Export a backup first if you might want it.</p>
              <label className="field">
                <span>Type RESET to confirm</span>
                <input className="input" value={resetText} onChange={(e) => setResetText(e.target.value)} autoCapitalize="characters" />
              </label>
            </>
          }
          confirmLabel="Erase"
          danger
          onCancel={() => {
            setReset(false);
            setResetText('');
          }}
          onConfirm={async () => {
            if (resetText.trim().toUpperCase() !== 'RESET') {
              toast('Type RESET to confirm.');
              return;
            }
            await repo.resetAll();
            window.location.hash = '#/today';
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function DemoData() {
  const toast = useToast();
  return (
    <div className="card soft">
      <strong>Developer</strong>
      <p className="small muted">Only in development builds.</p>
      <button
        className="btn block"
        onClick={async () => {
          const { loadDemoData } = await import('../../dev/demo');
          await loadDemoData();
          toast('Demo data loaded.');
        }}
      >
        Load demo data
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row between" style={{ margin: '10px 0', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o} aria-pressed={value === o} onClick={() => onChange(o)}>
          {o[0].toUpperCase() + o.slice(1)}
        </button>
      ))}
    </div>
  );
}
