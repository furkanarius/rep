// Home: answers "what do I do now?" in two seconds.
import { useMemo, useState } from 'react';
import { useData, type AppData } from '../../app/data';
import {
  deloadAdvice,
  isDeloadWeek,
  nextTwoWeeks,
  optionalUnlocked,
  stageStatus,
  streak,
  todayRecommendation,
} from '../../app/derive';
import { startWorkout } from '../../app/actions';
import { templateById, allTemplates } from '../../engine/program';
import { weekDays, toDay, WEEKDAY_SHORT, fmtDate, addDays, timeAgo } from '../../lib/dates';
import { buildIcs } from '../../engine/ics';
import * as repo from '../../db/repo';
import { Sheet, Confirm } from '../../components/Sheet';
import { Term } from '../../components/Term';
import { useToast } from '../../components/Toast';
import { IconBike, IconCal, IconScale } from '../../components/Icons';
import { fmtWeight, toKg, fromKg, lengthToCm, cmToLength } from '../../lib/units';
import type { RideType } from '../../engine/types';
import { go } from '../../app/router';
import { lsGet, lsSet } from '../../lib/storage';

export function Today() {
  const d = useData();
  const rec = useMemo(() => todayRecommendation(d), [d]);
  const status = useMemo(() => stageStatus(d), [d]);
  const deload = useMemo(() => deloadAdvice(d), [d]);
  const deloadOn = isDeloadWeek(d);
  const bonus = optionalUnlocked(d);
  const [sheet, setSheet] = useState<'ride' | 'body' | undefined>();
  const toast = useToast();
  const tpl = templateById(rec.templateId)?.template;
  const streakN = streak(d);
  const sessGate = status.gates.find((g) => g.gate.type === 'sessions');

  const active = d.active;
  const stale = active && Date.now() - Date.parse(active.startedAt) > 12 * 3600_000;

  const exportCalendar = () => {
    const list = nextTwoWeeks(d);
    const names = Object.fromEntries(allTemplates(d.stage).map((w) => [w.id, w.name]));
    const ics = buildIcs(list, names, d.settings.preferredTime, window.location.href.split('#')[0]);
    const blob = new Blob([ics], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rep-next-2-weeks.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(`${list.length} suggested sessions exported`);
  };

  const backupDue =
    !d.settings.gistToken &&
    d.done.length >= 3 &&
    (!d.settings.lastBackupAt || Date.now() - d.settings.lastBackupAt > 14 * 86400_000) &&
    lsGet('rep:backup-snooze', 0) < Date.now();

  return (
    <div className="page">
      <p className="small" style={{ margin: '0 0 8px', fontWeight: 600 }}>
        Week streak: {streakN} · This week {rec.doneThisWeek} of {d.settings.targetPerWeek} lifting sessions
      </p>

      {stale && active && <StaleCard d={d} id={active.id} startedAt={active.startedAt} />}

      {deloadOn && (
        <div className="card soft small">
          <strong>Deload week.</strong> Same exercises, about 60% weight, 2 sets. <Term k="deload">What's this?</Term>
        </div>
      )}
      {!deloadOn && deload.suggest && <DeloadCard reason={deload.reason} />}

      {status.allMet && (
        <a className="card accent card-link" href="#/plan">
          <strong>🎉 You're ready for the next stage.</strong>
          <p className="small" style={{ margin: '4px 0 0' }}>
            Every target in Stage {d.stage.number} is done. Tap to see what's new.
          </p>
        </a>
      )}

      <a className="card card-link" href="#/plan" aria-label="Stage progress. Open the plan.">
        <div className="row between">
          <span className="eyebrow">
            Stage {d.stage.number} · {d.stage.name}
          </span>
          <span className="small muted">Plan ›</span>
        </div>
        <p className="small" style={{ margin: '6px 0' }}>
          {sessGate ? `${sessGate.detail.replace('/', ' of ')} sessions · ` : ''}
          {status.metCount} of {status.total} targets hit
        </p>
        <div className="bar">
          <span style={{ width: `${(status.metCount / status.total) * 100}%` }} />
        </div>
      </a>

      <WeekStrip d={d} planned={rec.planned.map((p) => p.day)} />
      <div className="row between" style={{ margin: '2px 0 4px' }}>
        <p className="small muted" style={{ margin: 0 }}>
          {rec.weekLine}
        </p>
        <button className="icon-btn" onClick={exportCalendar} aria-label="Add the next 2 weeks of suggested sessions to Calendar">
          <IconCal />
        </button>
      </div>

      {active && !stale ? (
        <div className="card accent">
          <div className="eyebrow">In progress</div>
          <div className="rec-title">{templateById(active.workoutTemplateId)?.template.name}</div>
          <p className="muted small">Started {timeAgo(Date.parse(active.startedAt))}. Everything is saved.</p>
          <a className="btn primary big block" href={`#/workout/${active.id}`}>
            Resume
          </a>
        </div>
      ) : !active ? (
        <div className={`card ${rec.kind === 'lift' ? 'accent' : ''}`}>
          <div className="eyebrow">{rec.kind === 'lift' ? 'Lift today' : rec.liftedToday ? 'Done for today' : 'Rest or ride today'}</div>
          {rec.kind === 'lift' ? (
            <>
              <div className="rec-title">
                {tpl?.name} · ~{rec.short ? 20 : tpl?.estMinutes} min
              </div>
              <p style={{ margin: '6px 0 14px' }}>{rec.reason}</p>
              <button
                className="btn primary big block"
                onClick={() => startWorkout(d, { templateId: rec.templateId, short: rec.short, legsLight: rec.legsLight })}
              >
                Start
              </button>
              {!rec.short && (
                <button className="btn block" style={{ marginTop: 10 }} onClick={() => startWorkout(d, { templateId: rec.templateId, short: true })}>
                  Short on time? 20-minute version
                </button>
              )}
            </>
          ) : (
            <>
              <p style={{ margin: '6px 0 14px', fontSize: 18 }}>{rec.reason}</p>
              <div className="grid2">
                <button className="btn" onClick={() => startWorkout(d, { templateId: rec.templateId })}>
                  Lift anyway
                </button>
                <button className="btn" onClick={() => startWorkout(d, { templateId: rec.templateId, short: true })}>
                  20-minute version
                </button>
              </div>
              <p className="tiny muted" style={{ marginTop: 8 }}>
                Next up: {tpl?.name}. {rec.liftedToday ? 'A second session today is fine, just keep it light.' : 'Training today is fine too.'}
              </p>
            </>
          )}
          {bonus && rec.doneThisWeek >= 3 && (
            <button className="btn ghost block" onClick={() => startWorkout(d, { templateId: bonus.id })}>
              Bonus: {bonus.name} (optional 4th day)
            </button>
          )}
        </div>
      ) : null}

      <div className="grid2">
        <button className="btn" onClick={() => setSheet('ride')}>
          <IconBike /> + Ride
        </button>
        <button className="btn" onClick={() => setSheet('body')}>
          <IconScale /> + Body check-in
        </button>
      </div>

      {d.rides.length === 0 && (
        <p className="small muted" style={{ marginTop: 10 }}>
          No rides yet. Tap + Ride after your commute so I can plan around it.
        </p>
      )}

      {backupDue && (
        <div className="card soft small">
          <strong>Back up your data?</strong> It lives only on this phone, and iOS can clear website data. Turn on Gist sync or export a
          file in Settings.
          <div className="row" style={{ marginTop: 8 }}>
            <a className="btn" href="#/settings">
              Open Settings
            </a>
            <button
              className="btn ghost"
              onClick={() => {
                lsSet('rep:backup-snooze', Date.now() + 7 * 86400_000);
                go('today');
              }}
            >
              Later
            </button>
          </div>
        </div>
      )}

      {sheet === 'ride' && <RideSheet onClose={() => setSheet(undefined)} onSaved={(m) => toast(m)} />}
      {sheet === 'body' && <BodySheet d={d} onClose={() => setSheet(undefined)} onSaved={(m) => toast(m)} />}
    </div>
  );
}

function WeekStrip({ d, planned }: { d: AppData; planned: string[] }) {
  const days = weekDays(d.today);
  const liftDays = new Set(d.lifts.map((l) => l.day));
  const rideDays = new Map(d.rideLogs.map((r) => [r.day, r.type]));
  return (
    <div className="week-strip" role="list" aria-label="This week">
      {days.map((day, i) => {
        const lift = liftDays.has(day);
        const ride = rideDays.get(day);
        const sug = !lift && planned.includes(day);
        const plannedRide = !ride && d.settings.longRideDays.includes(i + 1) && day >= d.today;
        const desc = [lift && 'lifted', ride && `${ride} ride`, sug && 'suggested lift', plannedRide && 'usual long ride'].filter(Boolean).join(', ');
        return (
          <div key={day} role="listitem" className={`d ${day === d.today ? 'today' : ''}`} aria-label={`${WEEKDAY_SHORT[i]}${desc ? ': ' + desc : ''}`}>
            <span>{WEEKDAY_SHORT[i][0]}</span>
            <span className={`dot ${lift ? 'lift' : sug ? 'suggest' : ''}`}>{lift ? '✓' : ''}</span>
            <span className={`dot ${ride ? 'ride' : ''}`} style={{ opacity: plannedRide ? 0.45 : 1, width: 18, height: 18 }}>
              {ride || plannedRide ? <IconBike width={14} height={14} /> : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StaleCard({ d, id, startedAt }: { d: AppData; id: string; startedAt: string }) {
  const [confirm, setConfirm] = useState(false);
  const logged = d.sets.filter((s) => s.sessionId === id && s.kind === 'work').length;
  return (
    <div className="card accent">
      <strong>Unfinished workout from {fmtDate(startedAt)}</strong>
      <p className="small muted">
        {logged} set{logged === 1 ? '' : 's'} logged.
      </p>
      <div className="grid2">
        <button className="btn primary" onClick={() => repo.finishSession(id)} disabled={!logged}>
          Finish it with what you logged
        </button>
        <button className="btn" onClick={() => setConfirm(true)}>
          Discard
        </button>
      </div>
      <a className="btn ghost block" href={`#/workout/${id}`}>
        Or keep going
      </a>
      {confirm && (
        <Confirm
          title="Discard this workout?"
          body="The sets you logged in it will not count."
          confirmLabel="Discard"
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            setConfirm(false);
            await repo.discardSession(id);
          }}
        />
      )}
    </div>
  );
}

function DeloadCard({ reason }: { reason: string }) {
  return (
    <div className="card soft">
      <strong>Time for a lighter week?</strong>
      <p className="small" style={{ margin: '4px 0' }}>
        {reason} <Term k="deload">What's a deload?</Term>
      </p>
      <div className="grid2" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={() => repo.addEvent('deload-accepted')}>
          Yes, deload this week
        </button>
        <button className="btn" onClick={() => repo.addEvent('deload-dismissed')}>
          Not now
        </button>
      </div>
    </div>
  );
}

const DURATIONS = [20, 30, 45, 60, 90, 120];

function RideSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) {
  const [type, setType] = useState<RideType>('commute');
  const [minutes, setMinutes] = useState(30);
  const [when, setWhen] = useState<'today' | 'yesterday'>('today');
  const today = toDay(new Date());
  return (
    <Sheet title="Log a ride" onClose={onClose}>
      <p className="eyebrow">Type</p>
      <div className="chips">
        {(
          [
            ['commute', 'Commute'],
            ['long', 'Long ride'],
            ['hard', 'Hard / intervals'],
          ] as const
        ).map(([t, l]) => (
          <button
            key={t}
            className="chip"
            aria-pressed={type === t}
            onClick={() => {
              setType(t);
              if (t === 'long' && minutes < 90) setMinutes(120);
              if (t === 'commute' && minutes > 60) setMinutes(30);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="eyebrow" style={{ marginTop: 14 }}>
        Minutes
      </p>
      <div className="chips">
        {DURATIONS.map((m) => (
          <button key={m} className="chip" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
            {m === 120 ? '2 h+' : m}
          </button>
        ))}
      </div>
      <p className="eyebrow" style={{ marginTop: 14 }}>
        When
      </p>
      <div className="seg">
        <button aria-pressed={when === 'today'} onClick={() => setWhen('today')}>
          Today
        </button>
        <button aria-pressed={when === 'yesterday'} onClick={() => setWhen('yesterday')}>
          Yesterday
        </button>
      </div>
      <button
        className="btn primary big block"
        style={{ marginTop: 18 }}
        onClick={async () => {
          await repo.addRide(when === 'today' ? today : addDays(today, -1), minutes, type);
          onSaved(type === 'commute' ? 'Ride saved. Nice commute.' : 'Ride saved. I’ll go easy on your legs.');
          onClose();
        }}
      >
        Save ride
      </button>
    </Sheet>
  );
}

function BodySheet({ d, onClose, onSaved }: { d: AppData; onClose: () => void; onSaved: (m: string) => void }) {
  const last = [...d.body].reverse();
  const lastW = last.find((m) => m.weightKg)?.weightKg ?? 75;
  const lastNavel = last.find((m) => m.waistNavelCm)?.waistNavelCm;
  const lastNarrow = last.find((m) => m.waistNarrowCm)?.waistNarrowCm;
  const bu = d.settings.bodyUnit;
  const lu = d.settings.lengthUnit;
  const [w, setW] = useState(Number(fmtWeight(lastW, bu)));
  const [navel, setNavel] = useState(lastNavel ? Math.round(cmToLength(lastNavel, lu) * 10) / 10 : undefined);
  const [narrow, setNarrow] = useState(lastNarrow ? Math.round(cmToLength(lastNarrow, lu) * 10) / 10 : undefined);
  const [more, setMore] = useState(false);
  const stepW = bu === 'kg' ? 0.1 : 0.2;
  return (
    <Sheet title="Body check-in" onClose={onClose}>
      <p className="small muted">Weigh yourself in the morning, after the bathroom, for the most consistent numbers.</p>
      <label className="field">
        <span>Body weight ({bu})</span>
        <div className="row">
          <button className="btn quiet" aria-label="Less" onClick={() => setW(Math.round((w - stepW) * 10) / 10)}>
            −
          </button>
          <input className="input num" style={{ fontSize: 28, textAlign: 'center' }} inputMode="decimal" value={w} onChange={(e) => setW(Number(e.target.value.replace(',', '.')) || 0)} />
          <button className="btn quiet" aria-label="More" onClick={() => setW(Math.round((w + stepW) * 10) / 10)}>
            +
          </button>
        </div>
      </label>
      {!more ? (
        <button className="btn ghost" onClick={() => setMore(true)}>
          + Add waist measurements
        </button>
      ) : (
        <div className="grid2">
          <label className="field">
            <span>Waist at navel ({lu})</span>
            <input className="input" inputMode="decimal" value={navel ?? ''} onChange={(e) => setNavel(Number(e.target.value.replace(',', '.')) || undefined)} />
          </label>
          <label className="field">
            <span>Narrowest ({lu})</span>
            <input className="input" inputMode="decimal" value={narrow ?? ''} onChange={(e) => setNarrow(Number(e.target.value.replace(',', '.')) || undefined)} />
          </label>
        </div>
      )}
      <button
        className="btn primary big block"
        style={{ marginTop: 14 }}
        onClick={async () => {
          await repo.addBody({
            date: toDay(new Date()),
            weightKg: w > 0 ? toKg(w, bu) : undefined,
            waistNavelCm: more && navel ? lengthToCm(navel, lu) : undefined,
            waistNarrowCm: more && narrow ? lengthToCm(narrow, lu) : undefined,
          });
          const diff = w - fromKg(lastW, bu);
          onSaved(Math.abs(diff) < 0.05 || d.body.length === 0 ? 'Saved.' : `Saved (${diff > 0 ? '+' : ''}${diff.toFixed(1)} ${bu} vs last time). Trends matter, not single days.`);
          onClose();
        }}
      >
        Save
      </button>
    </Sheet>
  );
}

