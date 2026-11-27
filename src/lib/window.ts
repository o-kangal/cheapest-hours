import { HOUR_SECONDS, type HourPrice } from './prices';

export interface CheapestWindow {
  /** Index of the first hour in the input. */
  readonly startIndex: number;
  /** Index after the last hour in the input (exclusive). */
  readonly endIndex: number;
  /** Unix seconds; `end` is exclusive. */
  readonly start: number;
  readonly end: number;
  readonly avgCtPerKwh: number;
}

/**
 * Finds the run of `durationHours` consecutive hours with the lowest mean price (SPEC §4.3–§4.4).
 * Hours are consecutive only when they are exactly one hour apart, so a window never spans a gap.
 * On a tie the earliest window wins. Returns null when no such run exists.
 *
 * Each window is summed directly rather than with a sliding sum: with at most 25 hours this costs
 * nothing, and equal windows get bit-identical sums, so ties are decided by position alone.
 */
export function findCheapestWindow(
  hours: readonly HourPrice[],
  durationHours: number,
): CheapestWindow | null {
  if (!Number.isInteger(durationHours) || durationHours < 1) {
    throw new RangeError(`durationHours must be a positive integer, got ${durationHours}`);
  }

  let best: CheapestWindow | null = null;
  let runStart = 0;

  for (const [i, hour] of hours.entries()) {
    const previous = hours[i - 1];
    if (previous && hour.start - previous.start !== HOUR_SECONDS) runStart = i;

    const startIndex = i - durationHours + 1;
    if (startIndex < runStart) continue;

    const window = hours.slice(startIndex, i + 1);
    const avg = window.reduce((sum, h) => sum + h.ctPerKwh, 0) / durationHours;
    if (best === null || avg < best.avgCtPerKwh) {
      best = {
        startIndex,
        endIndex: i + 1,
        start: (window[0] ?? hour).start,
        end: hour.start + HOUR_SECONDS,
        avgCtPerKwh: avg,
      };
    }
  }

  return best;
}
