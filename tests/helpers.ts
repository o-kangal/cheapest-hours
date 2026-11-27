import type { HourPrice } from '../src/lib/prices';

/** 2026-11-28 00:00 in Berlin (CET, UTC+1). */
export const DAY_START = Date.parse('2026-11-27T23:00:00Z') / 1000;

/** Consecutive hours from `start`, one per price in ct/kWh. */
export function hours(prices: readonly number[], start = DAY_START): HourPrice[] {
  return prices.map((ctPerKwh, i) => ({ start: start + i * 3600, ctPerKwh }));
}
