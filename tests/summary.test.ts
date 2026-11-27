import { describe, expect, it } from 'vitest';
import { formatCt, summarize } from '../src/lib/summary';
import type { CheapestWindow } from '../src/lib/window';
import { DAY_START } from './helpers';

function window(fromHour: number, toHour: number, avgCtPerKwh: number): CheapestWindow {
  return {
    startIndex: fromHour,
    endIndex: toHour,
    start: DAY_START + fromHour * 3600,
    end: DAY_START + toHour * 3600,
    avgCtPerKwh,
  };
}

describe('summarize', () => {
  it('matches the line of SPEC §4.5', () => {
    expect(summarize(window(2, 5, 6.1), 9.84, 3)).toBe(
      'Cheapest 3-hour window: 02:00–05:00, avg 6.1 ct/kWh, 38% below the daily average.',
    );
  });

  it('says so when no window fits', () => {
    expect(summarize(null, 8, 6)).toBe('No 6-hour window fits into the hours with prices.');
  });

  it('states the difference in ct/kWh when the daily average is not positive', () => {
    expect(summarize(window(11, 14, -3.25), -0.5, 3)).toBe(
      'Cheapest 3-hour window: 11:00–14:00, avg -3.3 ct/kWh, 2.8 ct/kWh below the daily average.',
    );
    expect(summarize(window(0, 1, -1), 0, 1)).toContain('1.0 ct/kWh below the daily average');
  });

  it('states the difference in ct/kWh when the window itself is negative', () => {
    // As a percentage this would read "112% below the daily average".
    expect(summarize(window(12, 15, -0.8), 6.5, 3)).toBe(
      'Cheapest 3-hour window: 12:00–15:00, avg -0.8 ct/kWh, 7.3 ct/kWh below the daily average.',
    );
    // A window at exactly zero is still "100% below", which reads fine.
    expect(summarize(window(12, 13, 0), 6.5, 1)).toContain('100% below the daily average');
  });

  it('handles a window that is not cheaper than the average', () => {
    // [0, 10, 0] with 2 hours: every window averages 5, the day averages 3.3.
    expect(summarize(window(0, 2, 5), 10 / 3, 2)).toContain('50% above the daily average');
    expect(summarize(window(0, 2, 5), 5, 2)).toContain('at the daily average');
  });

  it('ends a window at midnight with 24:00', () => {
    expect(summarize(window(21, 24, 4), 8, 3)).toContain('21:00–24:00');
  });
});

describe('formatCt', () => {
  it('rounds to one decimal and never shows -0.0', () => {
    expect(formatCt(6.149)).toBe('6.1');
    expect(formatCt(-0.04)).toBe('0.0');
    expect(formatCt(-12.36)).toBe('-12.4');
  });
});
