// Local-date helpers. A "day" is a local calendar date string YYYY-MM-DD.

export type Day = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDay(d: Date | string | number): Day {
  const date = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? parseDay(d) : new Date(d);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDay(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // noon avoids DST edge cases
}

export function addDays(day: Day, n: number): Day {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

export function diffDays(a: Day, b: Day): number {
  // a - b in whole days
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86_400_000);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(day: Day): number {
  const wd = parseDay(day).getDay();
  return wd === 0 ? 7 : wd;
}

/** Monday of the week containing `day`. */
export function weekStart(day: Day): Day {
  return addDays(day, 1 - isoWeekday(day));
}

export function weekDays(day: Day): Day[] {
  const start = weekStart(day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function weekdayName(day: Day, long = true) {
  const i = isoWeekday(day) - 1;
  return long ? WEEKDAY_LONG[i] : WEEKDAY_SHORT[i];
}

/** "today", "tomorrow", "Thursday", "next Tuesday", or "Mar 3". */
export function relativeDayName(day: Day, today: Day): string {
  const d = diffDays(day, today);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  if (d > 1 && d < 7) return weekdayName(day);
  if (d >= 7 && d < 14) return `next ${weekdayName(day)}`;
  return parseDay(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function timeAgo(ms: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
