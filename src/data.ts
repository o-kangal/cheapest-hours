import { toHourly, type HourPrice } from './lib/prices';
import { addDays, berlinDate } from './lib/time';
import { parsePriceSeries } from './lib/upstream';

export type DayResult =
  | { readonly kind: 'ok'; readonly date: string; readonly isFallback: boolean; readonly hours: HourPrice[] }
  | { readonly kind: 'empty'; readonly date: string }
  | { readonly kind: 'error'; readonly message: string };

const TIMEOUT_MS = 10_000;

class LoadError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function fetchHours(date: string): Promise<HourPrice[]> {
  let response: Response;
  try {
    response = await fetch(`/api/prices?date=${encodeURIComponent(date)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new LoadError('The server could not be reached. Check your connection and try again.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = isRecord(body) && typeof body['error'] === 'string' ? ` ${body['error']}` : '';
    throw new LoadError(`Prices could not be loaded (${response.status}).${detail}`);
  }

  // Our own proxy, but still checked: a bad deploy should show an error, not a broken chart.
  const points = isRecord(body) ? parsePriceSeries(body['unixSeconds'], body['priceEurPerMwh']) : null;
  if (points === null) throw new LoadError('The server sent prices in an unexpected format.');
  return toHourly(points);
}

/**
 * Tomorrow's prices when they are published, otherwise today's (SPEC §4.1). `nowMs` decides
 * which Berlin day is "today", so callers and tests control the clock.
 */
export async function loadDay(nowMs: number): Promise<DayResult> {
  const today = berlinDate(nowMs);
  const tomorrow = addDays(today, 1);
  try {
    const tomorrowHours = await fetchHours(tomorrow);
    if (tomorrowHours.length > 0) {
      return { kind: 'ok', date: tomorrow, isFallback: false, hours: tomorrowHours };
    }
    const todayHours = await fetchHours(today);
    if (todayHours.length > 0) {
      return { kind: 'ok', date: today, isFallback: true, hours: todayHours };
    }
    return { kind: 'empty', date: today };
  } catch (error) {
    if (error instanceof LoadError) return { kind: 'error', message: error.message };
    throw error;
  }
}
