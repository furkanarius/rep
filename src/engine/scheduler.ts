// "When should I train?" — pure functions, explainable in one line.
import type { Focus, RideType } from './types';
import { addDays, diffDays, isoWeekday, weekDays, weekStart, relativeDayName, type Day } from '../lib/dates';

export type LiftLog = {
  day: Day;
  templateId: string;
  focus: Focus;
  lowerHeavy: boolean;
  isShort?: boolean;
  isReentry?: boolean;
  stageId?: string;
};
export type RideLog = { day: Day; minutes: number; type: RideType };
export type TemplateInfo = { id: string; name: string; focus: Focus; lowerHeavy: boolean; estMinutes: number };

export type SchedulerInput = {
  today: Day;
  lifts: LiftLog[];
  rides: RideLog[];
  targetPerWeek: number;
  longRideDays: number[];
  preferredTime: 'morning' | 'midday' | 'evening';
  stageId: string;
  split: 'full' | 'upper-lower';
  workouts: TemplateInfo[];
};

export type PlannedLift = { day: Day; templateId: string; short: boolean; legsLight: boolean };

export type Reentry = { factor: number; daysOff: number; message: string };

export type Recommendation = {
  kind: 'lift' | 'rest';
  templateId: string;
  short: boolean;
  legsLight: boolean;
  reason: string;
  nextLift?: PlannedLift;
  planned: PlannedLift[];
  weekLine: string;
  doneThisWeek: number;
  liftedToday: boolean;
  reentry?: Reentry;
};

const timeWord = (t: SchedulerInput['preferredTime']) =>
  t === 'morning' ? 'morning' : t === 'midday' ? 'at lunchtime' : 'evening';

/** Next template by rotation order (A → B → A …), never by weekday. */
export function nextTemplateId(lifts: LiftLog[], workouts: TemplateInfo[], stageId: string): string {
  const inStage = lifts.filter((l) => (l.stageId ?? stageId) === stageId && workouts.some((w) => w.id === l.templateId));
  if (!inStage.length) return workouts[0].id;
  const last = [...inStage].sort((a, b) => a.day.localeCompare(b.day))[inStage.length - 1];
  const i = workouts.findIndex((w) => w.id === last.templateId);
  return workouts[(i + 1) % workouts.length].id;
}

export function isLongRideDay(day: Day, input: Pick<SchedulerInput, 'rides' | 'longRideDays'>) {
  if (input.rides.some((r) => r.day === day && (r.type === 'long' || r.type === 'hard'))) return true;
  return input.longRideDays.includes(isoWeekday(day));
}

/** Logged long/hard ride on this exact day (the brief: "the day of a logged long or hard ride"). */
const hardRideOn = (day: Day, rides: RideLog[]) =>
  rides.some((r) => r.day === day && (r.type === 'long' || r.type === 'hard'));

type DayCheck = {
  ok: boolean; // fine with no compromise
  compromiseOk: boolean; // allowed only when the week needs it
  short: boolean;
  legsLight: boolean;
  templateId: string;
};

function checkDay(
  day: Day,
  liftDays: Map<Day, TemplateInfo>,
  templateId: string,
  input: SchedulerInput,
  isToday: boolean,
): DayCheck {
  const byId = (id: string) => input.workouts.find((w) => w.id === id)!;
  let tpl = byId(templateId);
  const y1 = liftDays.get(addDays(day, -1));
  const y2 = liftDays.get(addDays(day, -2));
  const t1 = liftDays.get(addDays(day, 1));
  const t2 = liftDays.get(addDays(day, 2));
  const res: DayCheck = { ok: true, compromiseOk: true, short: false, legsLight: false, templateId };
  if (liftDays.has(day)) return { ...res, ok: false, compromiseOk: false };
  // Never 3 in a row, looking both backward and forward (planned days count too).
  if ((y1 && y2) || (y1 && t1) || (t1 && t2)) return { ...res, ok: false, compromiseOk: false };

  const rideTomorrow = isLongRideDay(addDays(day, 1), input);
  // A planned long-ride day is a ride day; a logged hard/long ride today also counts.
  const rideToday = isToday ? hardRideOn(day, input.rides) || isLongRideDay(day, input) : isLongRideDay(day, input);
  const rideConstrained = rideTomorrow || rideToday;

  if (rideConstrained && tpl.lowerHeavy) {
    if (input.split === 'upper-lower') {
      // Put an upper-body day here instead.
      const order = input.workouts;
      const start = order.findIndex((w) => w.id === tpl.id);
      for (let k = 1; k < order.length; k++) {
        const cand = order[(start + k) % order.length];
        if (!cand.lowerHeavy) {
          tpl = cand;
          res.templateId = cand.id;
          break;
        }
      }
      if (tpl.lowerHeavy) {
        res.ok = false;
        res.legsLight = true;
      }
    } else {
      res.ok = false;
      res.legsLight = true;
    }
  }
  if (rideToday && !isToday && input.split === 'full') res.ok = false;

  const neighbour = y1 ?? t1;
  if (neighbour) {
    const sameMuscles = neighbour.focus === 'full' || tpl.focus === 'full' || neighbour.focus === tpl.focus;
    res.ok = false;
    if (sameMuscles) {
      if (input.split === 'full') res.short = true;
      else res.compromiseOk = false;
    }
  }
  return res;
}

/** Simulate the rest of the week: put remaining sessions on the earliest good days. */
export function planWeek(input: SchedulerInput, extraDone: Map<Day, TemplateInfo> = new Map()): PlannedLift[] {
  const { today } = input;
  const byId = new Map(input.workouts.map((w) => [w.id, w]));
  const liftDays = new Map<Day, TemplateInfo>();
  for (const l of input.lifts) liftDays.set(l.day, { id: l.templateId, name: '', focus: l.focus, lowerHeavy: l.lowerHeavy, estMinutes: 0 });
  for (const [d, t] of extraDone) liftDays.set(d, t);

  const days = weekDays(today).filter((d) => d >= today);
  const done = [...liftDays.keys()].filter((d) => weekStart(d) === weekStart(today)).length;
  let remaining = Math.max(0, input.targetPerWeek - done);
  if (!remaining) return [];

  const lifts: LiftLog[] = [...input.lifts];
  const planned: PlannedLift[] = [];

  // Pass 1: good days only. Pass 2: if the week still needs it, allow compromises.
  for (const allowCompromise of [false, true]) {
    if (!remaining) break;
    for (const day of days) {
      if (!remaining) break;
      if (planned.some((p) => p.day === day)) continue;
      // Days left after this one, to decide whether compromising is needed.
      const tplId = nextTemplateId(
        [...lifts, ...planned.map((p) => ({ day: p.day, templateId: p.templateId, focus: byId.get(p.templateId)!.focus, lowerHeavy: false, stageId: input.stageId }))],
        input.workouts,
        input.stageId,
      );
      const c = checkDay(day, liftDays, tplId, input, day === today);
      if (c.ok || (allowCompromise && c.compromiseOk)) {
        const tpl = byId.get(c.templateId)!;
        planned.push({ day, templateId: c.templateId, short: !c.ok && c.short, legsLight: !c.ok && c.legsLight });
        liftDays.set(day, tpl);
        remaining--;
      }
    }
  }
  planned.sort((a, b) => a.day.localeCompare(b.day));
  // Re-assign rotation in date order so templates read A, B, A… across the week.
  const seq: LiftLog[] = [...lifts];
  for (const p of planned) {
    const id = nextTemplateId(seq, input.workouts, input.stageId);
    const tpl = byId.get(id)!;
    // Keep a ride-day swap if the check chose a different template.
    const keep = byId.get(p.templateId)!;
    const use = keep.lowerHeavy === tpl.lowerHeavy ? tpl : keep;
    p.templateId = use.id;
    seq.push({ day: p.day, templateId: use.id, focus: use.focus, lowerHeavy: use.lowerHeavy, stageId: input.stageId });
  }
  return planned;
}

/** Days since the last finished lift, and the re-entry rule. */
export function computeReentry(lifts: LiftLog[], today: Day): Reentry | undefined {
  if (!lifts.length) return undefined;
  const sorted = [...lifts].sort((a, b) => a.day.localeCompare(b.day));
  const last = sorted[sorted.length - 1];
  const daysOff = diffDays(today, last.day);
  if (daysOff >= 21) {
    return {
      factor: 0.8,
      daysOff,
      message: `Welcome back! It's been ${Math.floor(daysOff / 7)} weeks, so we'll ease in: two lighter sessions, then normal progress.`,
    };
  }
  if (daysOff >= 7) {
    return {
      factor: 0.85,
      daysOff,
      message: "Missed a few days? No problem. Today's session is a little lighter to ease back in.",
    };
  }
  // Second easy-in session after a long break.
  if (last.isReentry && sorted.length >= 2) {
    const prev = sorted[sorted.length - 2];
    const gap = diffDays(last.day, prev.day);
    const reentriesSince = sorted.filter((l) => l.day >= last.day && l.isReentry).length;
    if (gap >= 21 && reentriesSince === 1) {
      return { factor: 0.9, daysOff, message: 'Second easy-in session: about 90% of your old weights. Back to normal next time.' };
    }
  }
  return undefined;
}

/** Weeks in a row (Mon–Sun) with ≥ minPerWeek lifts. The current week counts once it qualifies. */
export function weekStreak(liftDays: Day[], today: Day, minPerWeek = 2): number {
  const counts = new Map<Day, number>();
  for (const d of liftDays) counts.set(weekStart(d), (counts.get(weekStart(d)) ?? 0) + 1);
  let wk = weekStart(today);
  let streak = 0;
  if ((counts.get(wk) ?? 0) >= minPerWeek) streak++;
  wk = addDays(wk, -7);
  while ((counts.get(wk) ?? 0) >= minPerWeek) {
    streak++;
    wk = addDays(wk, -7);
  }
  return streak;
}

function joinDays(days: Day[], today: Day) {
  const names = days.map((d) => {
    const r = relativeDayName(d, today);
    return r === 'today' || r === 'tomorrow' ? r : r.slice(0, 3);
  });
  return names.join(' + ');
}

export function recommend(input: SchedulerInput): Recommendation {
  const { today } = input;
  const byId = new Map(input.workouts.map((w) => [w.id, w]));
  const thisWeek = input.lifts.filter((l) => weekStart(l.day) === weekStart(today));
  const doneThisWeek = thisWeek.length;
  const liftedToday = input.lifts.some((l) => l.day === today);
  const rotationNext = nextTemplateId(input.lifts, input.workouts, input.stageId);
  const reentry = computeReentry(input.lifts, today);
  const planned = planWeek(input);
  const todayPlan = planned.find((p) => p.day === today);
  const remaining = Math.max(0, input.targetPerWeek - doneThisWeek);

  // Next lift after today (this week, else first good day of the coming weeks).
  let nextLift = planned.find((p) => p.day > today);
  if (!nextLift) {
    let probe = addDays(weekStart(today), 7);
    for (let i = 0; i < 3 && !nextLift; i++) {
      const next = planWeek({ ...input, today: probe, lifts: [...input.lifts, ...planned.map((p) => toLog(p, byId, input.stageId))] });
      nextLift = next[0];
      probe = addDays(probe, 7);
    }
  }

  let weekLine: string;
  if (remaining === 0) weekLine = `Weekly target hit (${doneThisWeek} of ${input.targetPerWeek}). Anything extra is a bonus.`;
  else if (planned.length >= remaining)
    weekLine = `${remaining} more this week: ${joinDays(planned.map((p) => p.day), today)} works.`;
  else if (planned.length)
    weekLine = `${planned.length} more fits this week (${joinDays(planned.map((p) => p.day), today)}). That's fine, next week is a fresh start.`;
  else weekLine = 'No more good days this week. Rest up; next week is a fresh start.';

  const lastLift = [...input.lifts].sort((a, b) => a.day.localeCompare(b.day)).pop();
  const daysSince = lastLift ? diffDays(today, lastLift.day) : undefined;
  const tw = timeWord(input.preferredTime);
  const nextText = (p?: PlannedLift) => {
    if (!p) return '';
    const name = byId.get(p.templateId)?.name ?? '';
    const when = relativeDayName(p.day, today);
    return `Next lift: ${when}${when === 'tomorrow' ? ' ' + tw : ''} (${name}).`;
  };

  if (todayPlan && !liftedToday) {
    const tpl = byId.get(todayPlan.templateId)!;
    const bits: string[] = [];
    if (daysSince === undefined) bits.push("First session. We'll find your weights together");
    else if (reentry) {
      return {
        kind: 'lift',
        templateId: todayPlan.templateId,
        short: todayPlan.short,
        legsLight: todayPlan.legsLight,
        reason: reentry.message,
        nextLift,
        planned,
        weekLine,
        doneThisWeek,
        liftedToday,
        reentry,
      };
    } else if (daysSince === 1) bits.push('You lifted yesterday, but the week needs this one');
    else bits.push(`Last session was ${daysSince} days ago`);
    if (daysSince !== undefined && daysSince >= 2 && tpl.focus !== 'upper') bits.push('legs are recovered');
    const rideTomorrow = isLongRideDay(addDays(today, 1), input);
    if (todayPlan.legsLight) bits.push(rideTomorrow ? 'long ride tomorrow, so legs go light' : 'you rode hard today, so legs go light');
    else if (todayPlan.templateId !== rotationNext && input.split === 'upper-lower')
      bits.push(rideTomorrow ? 'long ride tomorrow, so upper body today' : 'ride day, so upper body today');
    else if (!rideTomorrow && tpl.lowerHeavy && daysSince !== undefined) bits.push('no long ride tomorrow');
    if (todayPlan.short) bits.push('short version, since you trained yesterday');
    const reason = bits.join('; ').replace(/^./, (c) => c.toUpperCase()) + '.';
    return {
      kind: 'lift',
      templateId: todayPlan.templateId,
      short: todayPlan.short,
      legsLight: todayPlan.legsLight,
      reason,
      nextLift,
      planned,
      weekLine,
      doneThisWeek,
      liftedToday,
      reentry,
    };
  }

  // Rest day: say why in one line.
  let why: string;
  const rideTomorrow = isLongRideDay(addDays(today, 1), input);
  const rideToday = hardRideOn(today, input.rides) || isLongRideDay(today, input);
  if (liftedToday) why = 'Nice work today.';
  else if (remaining === 0) why = 'Weekly target hit. Rest or ride.';
  else if (daysSince === 1 && rideTomorrow) why = 'Rest day. You lifted yesterday and have a long ride tomorrow.';
  else if (daysSince === 1) why = 'Rest or ride today. You lifted yesterday, and muscles grow on rest days.';
  else if (rideToday) why = 'Ride day. Enjoy it, and give your legs the day.';
  else if (rideTomorrow) why = 'Rest or ride today. Long ride tomorrow, so your legs stay fresh.';
  else why = 'Rest or ride today.';
  return {
    kind: 'rest',
    templateId: rotationNext,
    short: false,
    legsLight: false,
    reason: `${why} ${nextText(nextLift)}`.trim(),
    nextLift,
    planned,
    weekLine,
    doneThisWeek,
    liftedToday,
    reentry,
  };
}

function toLog(p: PlannedLift, byId: Map<string, TemplateInfo>, stageId: string): LiftLog {
  const t = byId.get(p.templateId)!;
  return { day: p.day, templateId: t.id, focus: t.focus, lowerHeavy: t.lowerHeavy, stageId };
}

/** Suggested sessions for the next N days, assuming each suggestion is followed. */
export function upcoming(input: SchedulerInput, days = 14): PlannedLift[] {
  const out: PlannedLift[] = [];
  const byId = new Map(input.workouts.map((w) => [w.id, w]));
  let lifts = [...input.lifts];
  let probe = input.today;
  const end = addDays(input.today, days - 1);
  while (probe <= end) {
    const plan = planWeek({ ...input, today: probe, lifts }).filter((p) => p.day <= end);
    out.push(...plan);
    lifts = [...lifts, ...plan.map((p) => toLog(p, byId, input.stageId))];
    probe = addDays(weekStart(probe), 7);
  }
  return out;
}
