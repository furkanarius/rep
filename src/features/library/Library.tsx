import { useMemo, useState } from 'react';
import { useData } from '../../app/data';
import { exercises, stageExerciseIds } from '../../engine/program';
import type { Equipment, Muscle } from '../../engine/types';
import { MUSCLE_NAMES } from '../../components/BodyDiagram';
import { Thumb } from '../../components/ExerciseMedia';
import { IconNext } from '../../components/Icons';

const EQUIP: [Equipment, string][] = [
  ['machine', 'Machine'],
  ['cable', 'Cable'],
  ['dumbbell', 'Dumbbell'],
  ['barbell', 'Barbell'],
  ['bodyweight', 'Body weight'],
];

export function Library() {
  const d = useData();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | ''>('');
  const [equip, setEquip] = useState<Equipment | ''>('');
  const [inPlan, setInPlan] = useState(false);
  const planIds = useMemo(() => new Set(stageExerciseIds(d.stage)), [d.stage]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return exercises
      .filter((e) => !t || e.name.toLowerCase().includes(t) || e.aka?.some((a) => a.toLowerCase().includes(t)))
      .filter((e) => !muscle || e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle))
      .filter((e) => !equip || e.equipment.includes(equip))
      .filter((e) => !inPlan || planIds.has(e.id))
      .sort((a, b) => Number(planIds.has(b.id)) - Number(planIds.has(a.id)) || a.name.localeCompare(b.name));
  }, [q, muscle, equip, inPlan, planIds]);

  return (
    <div className="page">
      <input
        className="input"
        type="search"
        placeholder="Search exercises"
        aria-label="Search exercises"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="chips scroll" style={{ marginTop: 10 }}>
        <button className="chip" aria-pressed={inPlan} onClick={() => setInPlan(!inPlan)}>
          In my current plan
        </button>
        {EQUIP.map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={equip === k} onClick={() => setEquip(equip === k ? '' : k)}>
            {l}
          </button>
        ))}
      </div>
      <select className="input" style={{ marginTop: 10 }} value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle | '')} aria-label="Filter by muscle">
        <option value="">All muscles</option>
        {Object.entries(MUSCLE_NAMES).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <p className="small muted">
        {list.length} exercise{list.length === 1 ? '' : 's'}
      </p>
      <ul className="list">
        {list.map((e) => (
          <li key={e.id}>
            <a className="list-row" href={`#/library/${e.id}`}>
              <Thumb ex={e} />
              <span className="grow">
                <strong>{e.name}</strong>
                {planIds.has(e.id) && (
                  <span className="badge accent" style={{ marginLeft: 6 }}>
                    in plan
                  </span>
                )}
                <span className="small muted" style={{ display: 'block' }}>
                  {e.primaryMuscles.map((m) => MUSCLE_NAMES[m]).join(', ')}
                </span>
              </span>
              <IconNext />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
