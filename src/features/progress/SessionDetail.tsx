// View or edit any past session: sets, date, delete.
import { useState } from 'react';
import { useData } from '../../app/data';
import { exerciseById, stepFor, templateById } from '../../engine/program';
import { measureOf } from '../../engine/progression';
import * as repo from '../../db/repo';
import { Confirm } from '../../components/Sheet';
import { EditSetSheet } from '../workout/Workout';
import { fmtWeight } from '../../lib/units';
import { fmtDate, toDay } from '../../lib/dates';
import { go } from '../../app/router';
import type { SetRec } from '../../engine/types';

export function SessionDetail({ id }: { id: string }) {
  const d = useData();
  const s = d.sessions.find((x) => x.id === id);
  const [edit, setEdit] = useState<SetRec>();
  const [del, setDel] = useState(false);
  if (!s) return <div className="page"><p>Session not found.</p></div>;
  const unit = d.settings.loadUnit;
  const sets = d.sets.filter((x) => x.sessionId === id).sort((a, b) => a.slotIndex - b.slotIndex || a.setIndex - b.setIndex);
  const groups = new Map<string, SetRec[]>();
  for (const x of sets) {
    const k = `${x.slotIndex}|${x.exerciseId}`;
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  const editEx = edit ? exerciseById(edit.exerciseId)! : undefined;
  return (
    <div className="page">
      <h2 style={{ marginTop: 4 }}>{templateById(s.workoutTemplateId)?.template.name}</h2>
      <p className="muted">{fmtDate(s.startedAt)} · {s.status === 'done' ? 'Finished' : s.status === 'discarded' ? 'Discarded' : 'In progress'}</p>
      <label className="field">
        <span>Date</span>
        <input
          className="input"
          type="date"
          value={toDay(s.startedAt)}
          onChange={async (e) => {
            if (!e.target.value) return;
            const t = new Date(s.startedAt);
            const [y, m, dd] = e.target.value.split('-').map(Number);
            t.setFullYear(y, m - 1, dd);
            const shift = t.getTime() - Date.parse(s.startedAt);
            await repo.updateSession(s.id, {
              startedAt: t.toISOString(),
              finishedAt: s.finishedAt ? new Date(Date.parse(s.finishedAt) + shift).toISOString() : undefined,
            });
          }}
        />
      </label>
      {s.status === 'discarded' && (
        <button className="btn block" onClick={() => repo.updateSession(s.id, { status: 'done' })}>
          Count this session after all
        </button>
      )}
      {[...groups.entries()].map(([k, list]) => {
        const ex = exerciseById(list[0].exerciseId)!;
        const sec = measureOf(ex) === 'seconds';
        return (
          <div className="card" key={k}>
            <strong>{ex.name}</strong>
            {s.exerciseNotes?.[ex.id] && <p className="small muted">📝 {s.exerciseNotes[ex.id]}</p>}
            <ul className="list">
              {list.map((x) => (
                <li key={x.id}>
                  <button className="list-row" onClick={() => setEdit(x)} aria-label={`Edit set ${x.setIndex + 1}`}>
                    <span className="badge" style={{ minWidth: 64, textAlign: 'center' }}>
                      {x.kind === 'warmup' ? 'warm-up' : x.kind === 'calibration' ? 'test' : `set ${list.filter((y) => y.kind === 'work').indexOf(x) + 1}`}
                    </span>
                    <span className="grow num" style={{ fontSize: 22 }}>
                      {x.weight > 0 ? `${fmtWeight(x.weight, unit)} ${unit} × ` : ''}
                      {x.reps}
                      {sec ? ' s' : ''}
                    </span>
                    <span className="small muted">{x.feel ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {sets.length === 0 && <p className="muted">No sets in this session.</p>}
      <button className="btn danger block" style={{ marginTop: 16 }} onClick={() => setDel(true)}>
        Delete this session
      </button>
      {edit && editEx && (
        <EditSetSheet
          set={edit}
          ex={editEx}
          unit={unit}
          step={stepFor(editEx, d.settings)}
          loadLabel={unit}
          seconds={measureOf(editEx) === 'seconds'}
          onClose={() => setEdit(undefined)}
        />
      )}
      {del && (
        <Confirm
          title="Delete this session?"
          body="Its sets will no longer count toward your progress or targets."
          confirmLabel="Delete"
          danger
          onCancel={() => setDel(false)}
          onConfirm={async () => {
            await repo.deleteSession(s.id);
            go('progress');
          }}
        />
      )}
    </div>
  );
}
