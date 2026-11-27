// GET /api/prices?date=YYYY-MM-DD → one Berlin day of DE-LU day-ahead prices (SPEC §4.7).
// Energy-Charts does not allow cross-origin requests from browsers, so the page asks this
// function instead. Responses are cached at the edge because the API rate-limits quickly.
import { isServedDate, parseDateParam, parseUpstream } from '../../src/lib/upstream';

const UPSTREAM = 'https://api.energy-charts.info/price';
const CACHE_SECONDS = 15 * 60;

function json(body: unknown, status: number, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  });
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const date = parseDateParam(url.searchParams);
  if (date === null) {
    return json({ error: 'Expected exactly one query parameter: date=YYYY-MM-DD.' }, 400);
  }
  if (!isServedDate(date, Date.now())) {
    return json({ error: 'Only dates from yesterday to the day after tomorrow are served.' }, 400);
  }

  // The key is rebuilt from the validated date, so equivalent requests share one cache entry.
  const cacheKey = new Request(`${url.origin}/api/prices?date=${date}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  // Only the validated date goes into the upstream URL; the bidding zone is fixed.
  const query = new URLSearchParams({ bzn: 'DE-LU', start: date, end: date });
  const upstreamUrl = `${UPSTREAM}?${query.toString()}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { headers: { Accept: 'application/json' } });
  } catch {
    return json({ error: 'The price source is unreachable.' }, 502);
  }

  let body: unknown;
  if (upstream.status === 404) {
    // Energy-Charts answers 404 "no content available" for a day that is not published yet.
    body = { unix_seconds: [], price: [] };
  } else if (upstream.ok) {
    body = await upstream.json().catch(() => null);
  } else {
    return json({ error: `The price source answered ${upstream.status}.` }, 502);
  }

  const points = parseUpstream(body);
  if (points === null) {
    return json({ error: 'The price source sent an unexpected response.' }, 502);
  }

  const response = json(
    {
      date,
      unixSeconds: points.map((p) => p.start),
      priceEurPerMwh: points.map((p) => p.eurPerMwh),
    },
    200,
    CACHE_SECONDS,
  );
  context.waitUntil(caches.default.put(cacheKey, response.clone()));
  return response;
};
