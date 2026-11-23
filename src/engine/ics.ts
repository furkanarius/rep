// Calendar export: suggested sessions as an .ics file iOS Calendar can open.
import type { PlannedLift } from './scheduler';
import { parseDay } from '../lib/dates';

const SLOT = {
  morning: { h: 6, m: 45, dur: 45 },
  midday: { h: 12, m: 0, dur: 45 },
  evening: { h: 18, m: 30, dur: 45 },
};

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');

export function buildIcs(
  lifts: PlannedLift[],
  names: Record<string, string>,
  time: keyof typeof SLOT,
  appUrl: string,
  now = new Date(),
): string {
  const t = SLOT[time];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rep//Strength coach//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const l of lifts) {
    const start = parseDay(l.day);
    start.setHours(t.h, t.m, 0, 0);
    const end = new Date(start.getTime() + t.dur * 60_000);
    const name = names[l.templateId] ?? 'Workout';
    const extra = l.short ? ' (20-minute version)' : l.legsLight ? ' (legs light)' : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:rep-${l.day}-${l.templateId}@rep.app`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(`Lift: ${name}${extra}`)}`,
      `DESCRIPTION:${esc(`Suggested by Rep. Open the app: ${appUrl}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
