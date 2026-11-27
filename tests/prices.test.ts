import { describe, expect, it } from 'vitest';
import { dailyAverage, eurPerMwhToCtPerKwh, toHourly, type PricePoint } from '../src/lib/prices';
import { findCheapestWindow } from '../src/lib/window';
import { formatTime } from '../src/lib/time';
import { DAY_START } from './helpers';

/** Quarter-hour points from `start` (Unix seconds), one per price in EUR/MWh. */
function quarters(prices: readonly (number | null)[], start = DAY_START): PricePoint[] {
  return prices.map((eurPerMwh, i) => ({ start: start + i * 900, eurPerMwh }));
}

/** A whole Berlin day of quarter-hours between two UTC instants, all at one price. */
function berlinDay(fromIso: string, toIso: string, eurPerMwh = 100): PricePoint[] {
  const from = Date.parse(fromIso) / 1000;
  const count = (Date.parse(toIso) / 1000 - from) / 900;
  return quarters(Array.from({ length: count }, () => eurPerMwh), from);
}

describe('eurPerMwhToCtPerKwh', () => {
  it('converts EUR/MWh to ct/kWh', () => {
    expect(eurPerMwhToCtPerKwh(100)).toBe(10);
    expect(eurPerMwhToCtPerKwh(-12.5)).toBe(-1.25);
  });
});

describe('toHourly', () => {
  it('averages four quarter-hours into one hour, in ct/kWh', () => {
    expect(toHourly(quarters([80, 90, 100, 110, 50, 50, 50, 50]))).toEqual([
      { start: DAY_START, ctPerKwh: 9.5 },
      { start: DAY_START + 3600, ctPerKwh: 5 },
    ]);
  });

  it('skips missing quarter-hours instead of counting them as zero', () => {
    expect(toHourly(quarters([100, null, 50, null]))).toEqual([
      { start: DAY_START, ctPerKwh: 7.5 },
    ]);
  });

  it('leaves out an hour without any price', () => {
    const result = toHourly(quarters([10, 10, 10, 10, null, null, null, null, 20, 20, 20, 20]));
    expect(result.map((h) => h.start)).toEqual([DAY_START, DAY_START + 7200]);
  });

  it('returns no hours for no points', () => {
    expect(toHourly([])).toEqual([]);
  });

  it('gives 23 hours on the spring DST day, without a gap', () => {
    // 2026-03-29: clocks jump from 02:00 to 03:00 in Berlin.
    const day = toHourly(berlinDay('2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z'));
    expect(day).toHaveLength(23);
    expect(day.slice(1, 3).map((h) => formatTime(h.start))).toEqual(['01:00', '03:00']);
    // 01:00 and 03:00 are one real hour apart, so a window may span the jump.
    expect(findCheapestWindow(day, 23)).not.toBeNull();
  });

  it('gives 25 hours on the autumn DST day', () => {
    // 2026-10-25: 02:00–03:00 happens twice in Berlin.
    const day = toHourly(berlinDay('2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z'));
    expect(day).toHaveLength(25);
    expect(day.slice(2, 4).map((h) => formatTime(h.start))).toEqual(['02:00', '02:00']);
  });
});

describe('dailyAverage', () => {
  it('is the mean of the hourly prices', () => {
    expect(
      dailyAverage([
        { start: 0, ctPerKwh: 4 },
        { start: 3600, ctPerKwh: -2 },
        { start: 7200, ctPerKwh: 7 },
      ]),
    ).toBe(3);
  });

  it('is null for a day without prices', () => {
    expect(dailyAverage([])).toBeNull();
  });
});
