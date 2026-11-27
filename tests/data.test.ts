import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDay } from '../src/data';

// 2026-11-27 14:00 in Berlin: today is the 27th, tomorrow the 28th.
const NOW = Date.parse('2026-11-27T13:00:00Z');
const TOMORROW_START = Date.parse('2026-11-27T23:00:00Z') / 1000;
const TODAY_START = Date.parse('2026-11-26T23:00:00Z') / 1000;

function day(date: string, start: number | null) {
  const unixSeconds = start === null ? [] : [0, 1, 2, 3].map((i) => start + i * 900);
  return { date, unixSeconds, priceEurPerMwh: unixSeconds.map(() => 100) };
}

/** Answers /api/prices from a date → response map and records the dates asked for. */
function stubApi(responses: Record<string, () => Response>): string[] {
  const asked: string[] = [];
  vi.stubGlobal('fetch', (input: string) => {
    const date = new URL(input, 'http://localhost').searchParams.get('date') ?? '';
    asked.push(date);
    const respond = responses[date];
    return Promise.resolve(
      respond ? respond() : Response.json({ error: 'unexpected' }, { status: 500 }),
    );
  });
  return asked;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadDay', () => {
  it('shows tomorrow when it is published, without asking for today', async () => {
    const asked = stubApi({ '2026-11-28': () => Response.json(day('2026-11-28', TOMORROW_START)) });
    const result = await loadDay(NOW);
    expect(result).toMatchObject({ kind: 'ok', date: '2026-11-28', isFallback: false });
    expect(result.kind === 'ok' && result.hours).toEqual([{ start: TOMORROW_START, ctPerKwh: 10 }]);
    expect(asked).toEqual(['2026-11-28']);
  });

  it('falls back to today when tomorrow has no prices yet', async () => {
    stubApi({
      '2026-11-28': () => Response.json(day('2026-11-28', null)),
      '2026-11-27': () => Response.json(day('2026-11-27', TODAY_START)),
    });
    expect(await loadDay(NOW)).toMatchObject({ kind: 'ok', date: '2026-11-27', isFallback: true });
  });

  it('is empty when neither day has prices', async () => {
    stubApi({
      '2026-11-28': () => Response.json(day('2026-11-28', null)),
      '2026-11-27': () => Response.json(day('2026-11-27', null)),
    });
    expect(await loadDay(NOW)).toEqual({ kind: 'empty', date: '2026-11-27' });
  });

  it('reports a server error with its message instead of falling back', async () => {
    const asked = stubApi({
      '2026-11-28': () =>
        Response.json({ error: 'The price source answered 429.' }, { status: 502 }),
    });
    expect(await loadDay(NOW)).toEqual({
      kind: 'error',
      message: 'Prices could not be loaded (502). The price source answered 429.',
    });
    expect(asked).toEqual(['2026-11-28']);
  });

  it('reports a network failure', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    expect(await loadDay(NOW)).toMatchObject({
      kind: 'error',
      message: expect.stringContaining('could not be reached'),
    });
  });

  it('reports a malformed response', async () => {
    stubApi({ '2026-11-28': () => Response.json({ unixSeconds: [1, 2], priceEurPerMwh: [3] }) });
    expect(await loadDay(NOW)).toMatchObject({
      kind: 'error',
      message: expect.stringContaining('unexpected format'),
    });
  });
});
