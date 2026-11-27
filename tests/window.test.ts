import { describe, expect, it } from 'vitest';
import { findCheapestWindow } from '../src/lib/window';
import { DAY_START, hours } from './helpers';

describe('findCheapestWindow', () => {
  it('finds the run of hours with the lowest mean price', () => {
    const day = hours([9, 8, 3, 2, 4, 7, 10, 12]);
    expect(findCheapestWindow(day, 3)).toEqual({
      startIndex: 2,
      endIndex: 5,
      start: DAY_START + 2 * 3600,
      end: DAY_START + 5 * 3600,
      avgCtPerKwh: 3,
    });
  });

  it('returns null when the duration is longer than the data', () => {
    expect(findCheapestWindow(hours([5, 4, 3]), 4)).toBeNull();
  });

  it('returns the whole day when the duration equals the data', () => {
    const window = findCheapestWindow(hours([5, 4, 3]), 3);
    expect(window).toMatchObject({ startIndex: 0, endIndex: 3, avgCtPerKwh: 4 });
  });

  it('returns null for a day without prices', () => {
    expect(findCheapestWindow([], 1)).toBeNull();
  });

  it('handles negative prices as they are', () => {
    // Midday solar surplus: the negative hours are the cheapest, not the "smallest absolute".
    const day = hours([6, 2, -1, -4, -3, 1, 8]);
    expect(findCheapestWindow(day, 2)).toMatchObject({ startIndex: 3, avgCtPerKwh: -3.5 });
    expect(findCheapestWindow(day, 3)).toMatchObject({ startIndex: 2 });
    expect(findCheapestWindow(day, 3)?.avgCtPerKwh).toBeCloseTo(-8 / 3);
  });

  it('picks the earliest window on a tie', () => {
    expect(findCheapestWindow(hours([5, 5, 5, 5, 5]), 2)).toMatchObject({ startIndex: 0 });
    expect(findCheapestWindow(hours([9, 0.1, 0.2, 9, 0.2, 0.1, 9]), 2)).toMatchObject({
      startIndex: 1,
    });
  });

  it('never spans a gap in the data', () => {
    // 02:00 is missing: 01:00 and 03:00 are not consecutive.
    const day = [...hours([9, 1]), ...hours([1, 8, 8], DAY_START + 3 * 3600)];
    expect(findCheapestWindow(day, 2)).toMatchObject({ startIndex: 2, avgCtPerKwh: 4.5 });
    expect(findCheapestWindow(day, 4)).toBeNull();
  });

  it('rejects a duration that is not a positive integer', () => {
    expect(() => findCheapestWindow(hours([1, 2]), 0)).toThrow(RangeError);
    expect(() => findCheapestWindow(hours([1, 2]), 1.5)).toThrow(RangeError);
  });
});
