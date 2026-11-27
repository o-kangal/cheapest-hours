import { describe, expect, it } from 'vitest';
import { niceTicks } from '../src/lib/scale';

describe('niceTicks', () => {
  it('covers a positive range with round steps from zero', () => {
    expect(niceTicks(0, 23.2)).toEqual([0, 10, 20, 30]);
    expect(niceTicks(0, 18)).toEqual([0, 5, 10, 15, 20]);
  });

  it('covers negative prices below zero', () => {
    expect(niceTicks(-4.1, 12)).toEqual([-5, 0, 5, 10, 15]);
  });

  it('uses fractional steps for small ranges without float noise', () => {
    expect(niceTicks(0, 0.9)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(0, 0.3)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('widens an empty range', () => {
    expect(niceTicks(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('starts and ends on ticks that contain the range', () => {
    const ticks = niceTicks(-13.7, 31.4);
    expect(ticks[0]).toBeLessThanOrEqual(-13.7);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(31.4);
  });
});
