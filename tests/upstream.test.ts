import { describe, expect, it } from 'vitest';
import { isCalendarDate, parseDateParam, parsePriceSeries, parseUpstream } from '../src/lib/upstream';

describe('parseUpstream', () => {
  it('turns a valid Energy-Charts body into points', () => {
    const body = {
      license_info: 'CC BY 4.0',
      unix_seconds: [1795820400, 1795821300, 1795822200],
      price: [92.5, null, -3.1],
      unit: 'EUR / MWh',
      deprecated: false,
    };
    expect(parseUpstream(body)).toEqual([
      { start: 1795820400, eurPerMwh: 92.5 },
      { start: 1795821300, eurPerMwh: null },
      { start: 1795822200, eurPerMwh: -3.1 },
    ]);
  });

  it('accepts empty arrays as a day without prices', () => {
    expect(parseUpstream({ unix_seconds: [], price: [] })).toEqual([]);
  });

  it('rejects arrays of different length', () => {
    expect(parseUpstream({ unix_seconds: [1, 2], price: [10] })).toBeNull();
  });

  it('rejects non-numeric prices and times', () => {
    expect(parseUpstream({ unix_seconds: [1], price: ['10'] })).toBeNull();
    expect(parseUpstream({ unix_seconds: ['1'], price: [10] })).toBeNull();
    expect(parseUpstream({ unix_seconds: [1.5], price: [10] })).toBeNull();
  });

  it('rejects missing fields and non-object bodies', () => {
    expect(parseUpstream({ unix_seconds: [1] })).toBeNull();
    expect(parseUpstream({ price: [1] })).toBeNull();
    expect(parseUpstream(null)).toBeNull();
    expect(parseUpstream([1, 2])).toBeNull();
    expect(parseUpstream('no content available')).toBeNull();
  });
});

describe('parsePriceSeries', () => {
  it('rejects non-finite prices', () => {
    expect(parsePriceSeries([1], [Number.POSITIVE_INFINITY])).toBeNull();
    expect(parsePriceSeries([1], [Number.NaN])).toBeNull();
  });
});

describe('isCalendarDate', () => {
  it('accepts real dates only', () => {
    expect(isCalendarDate('2026-11-28')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2026-11-28T00:00')).toBe(false);
    expect(isCalendarDate('28.11.2026')).toBe(false);
  });
});

describe('parseDateParam', () => {
  const parse = (query: string) => parseDateParam(new URLSearchParams(query));

  it('accepts exactly one valid date parameter', () => {
    expect(parse('date=2026-11-28')).toBe('2026-11-28');
  });

  it('rejects any other or additional input', () => {
    expect(parse('')).toBeNull();
    expect(parse('date=2026-13-40')).toBeNull();
    expect(parse('date=2026-11-28&bzn=FR')).toBeNull();
    expect(parse('date=2026-11-28&date=2026-11-29')).toBeNull();
    expect(parse('start=2026-11-28')).toBeNull();
    expect(parse('date=2026-11-28%26bzn%3DFR')).toBeNull();
  });
});
