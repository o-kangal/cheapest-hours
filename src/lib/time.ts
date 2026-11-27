/** Every date and time the app shows is Berlin time (AGENTS.md invariant 3). */
export const TIME_ZONE = 'Europe/Berlin';

const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const value = parts.find((p) => p.type === type)?.value;
  if (value === undefined) throw new Error(`Missing ${type} in formatted date`);
  return value;
}

/** The Berlin calendar date (`YYYY-MM-DD`) at the given instant (Unix milliseconds). */
export function berlinDate(instantMs: number): string {
  const parts = dateParts.formatToParts(instantMs);
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

/** Adds whole calendar days to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`Invalid date: ${date}`);
  }
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Berlin wall-clock time `HH:MM` of a Unix timestamp in seconds. */
export function formatTime(unixSeconds: number): string {
  const parts = timeParts.formatToParts(unixSeconds * 1000);
  return `${part(parts, 'hour')}:${part(parts, 'minute')}`;
}

/**
 * `HH:MM–HH:MM` for a window within one day; a window ending at midnight ends at `24:00`
 * (SPEC §4.5), since `00:00` would read as the start of the same day.
 */
export function formatRange(start: number, end: number): string {
  const endLabel = formatTime(end);
  return `${formatTime(start)}–${endLabel === '00:00' ? '24:00' : endLabel}`;
}
