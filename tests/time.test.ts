import { describe, expect, it } from 'vitest';
import { addDays, berlinDate, formatRange, formatTime } from '../src/lib/time';
import { DAY_START } from './helpers';

describe('berlinDate', () => {
  it('uses the Berlin date, not the UTC date (winter, UTC+1)', () => {
    expect(berlinDate(Date.parse('2026-11-27T22:59:00Z'))).toBe('2026-11-27');
    expect(berlinDate(Date.parse('2026-11-27T23:00:00Z'))).toBe('2026-11-28');
  });

  it('uses the Berlin date in summer (UTC+2)', () => {
    expect(berlinDate(Date.parse('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
  });
});

describe('addDays', () => {
  it('rolls over months and years', () => {
    expect(addDays('2026-11-28', 1)).toBe('2026-11-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('gives tomorrow across a DST change', () => {
    expect(addDays(berlinDate(Date.parse('2026-03-28T12:00:00Z')), 1)).toBe('2026-03-29');
  });
});

describe('formatTime', () => {
  it('shows Berlin wall-clock time with a 24-hour clock', () => {
    expect(formatTime(DAY_START)).toBe('00:00');
    expect(formatTime(DAY_START + 14 * 3600 + 900)).toBe('14:15');
  });
});

describe('formatRange', () => {
  it('formats a window within the day', () => {
    expect(formatRange(DAY_START + 2 * 3600, DAY_START + 5 * 3600)).toBe('02:00–05:00');
  });

  it('shows a window ending at midnight as ending at 24:00', () => {
    expect(formatRange(DAY_START + 21 * 3600, DAY_START + 24 * 3600)).toBe('21:00–24:00');
  });
});
