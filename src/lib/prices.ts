/** One market time unit from the API: start as Unix seconds, price in EUR/MWh (null when missing). */
export interface PricePoint {
  readonly start: number;
  readonly eurPerMwh: number | null;
}

/** One clock hour: start as Unix seconds, price in ct/kWh. */
export interface HourPrice {
  readonly start: number;
  readonly ctPerKwh: number;
}

export const HOUR_SECONDS = 3600;

/** The only unit conversion in the app (AGENTS.md invariant 2): 1 EUR/MWh = 0.1 ct/kWh. */
export function eurPerMwhToCtPerKwh(eurPerMwh: number): number {
  return eurPerMwh / 10;
}

/**
 * Averages quarter-hour prices into clock hours (SPEC §4.2). Missing prices are skipped, never
 * counted as zero; an hour without any price is left out. Berlin is a whole number of hours
 * ahead of UTC, so UTC hour boundaries are Berlin hour boundaries too.
 */
export function toHourly(points: readonly PricePoint[]): HourPrice[] {
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const { start, eurPerMwh } of points) {
    if (eurPerMwh === null) continue;
    const hourStart = Math.floor(start / HOUR_SECONDS) * HOUR_SECONDS;
    const bucket = buckets.get(hourStart) ?? { sum: 0, count: 0 };
    bucket.sum += eurPerMwh;
    bucket.count += 1;
    buckets.set(hourStart, bucket);
  }
  return [...buckets]
    .sort(([a], [b]) => a - b)
    .map(([start, { sum, count }]) => ({ start, ctPerKwh: eurPerMwhToCtPerKwh(sum / count) }));
}

/** Mean of the hourly prices, or null for a day without prices. */
export function dailyAverage(hours: readonly HourPrice[]): number | null {
  if (hours.length === 0) return null;
  return hours.reduce((sum, hour) => sum + hour.ctPerKwh, 0) / hours.length;
}
