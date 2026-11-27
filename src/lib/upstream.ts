import type { PricePoint } from './prices';
import { addDays, berlinDate } from './time';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as `YYYY-MM-DD` (rejects 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * The proxy's only accepted input (SPEC §4.7): exactly one query parameter, `date`, holding a real
 * calendar date. Anything else yields null, so no other input can reach the upstream URL.
 */
export function parseDateParam(params: URLSearchParams): string | null {
  const keys = [...params.keys()];
  if (keys.length !== 1 || keys[0] !== 'date') return null;
  const date = params.get('date');
  return date !== null && isCalendarDate(date) ? date : null;
}

/**
 * The app only ever asks for today and tomorrow. The proxy serves yesterday to the day after
 * tomorrow (Berlin dates), one day of slack on each side for clocks around midnight, so nobody
 * can walk through dates to bypass the cache and spend the upstream rate limit.
 */
export function isServedDate(date: string, nowMs: number): boolean {
  const today = berlinDate(nowMs);
  // `YYYY-MM-DD` strings sort like the dates they name.
  return date >= addDays(today, -1) && date <= addDays(today, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates two parallel arrays (start times in Unix seconds, prices in EUR/MWh or null) and
 * zips them into points. Returns null when the shape is wrong; data is never trusted as is.
 */
export function parsePriceSeries(unixSeconds: unknown, prices: unknown): PricePoint[] | null {
  if (!Array.isArray(unixSeconds) || !Array.isArray(prices)) return null;
  if (unixSeconds.length !== prices.length) return null;

  const points: PricePoint[] = [];
  for (const [i, start] of unixSeconds.entries()) {
    const price: unknown = prices[i];
    if (typeof start !== 'number' || !Number.isInteger(start)) return null;
    if (price !== null && (typeof price !== 'number' || !Number.isFinite(price))) return null;
    points.push({ start, eurPerMwh: price });
  }
  return points;
}

/** Validates an Energy-Charts `/price` response body. */
export function parseUpstream(body: unknown): PricePoint[] | null {
  if (!isRecord(body)) return null;
  return parsePriceSeries(body['unix_seconds'], body['price']);
}
