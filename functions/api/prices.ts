// GET /api/prices?date=YYYY-MM-DD → one Berlin day of DE-LU day-ahead prices (SPEC §4.7).
// Energy-Charts does not allow cross-origin requests from browsers, so the page asks this
// function instead. Responses are cached at the edge because the API rate-limits quickly.
import { isServedDate, parseDateParam, parseUpstream } from '../../src/lib/upstream';

const UPSTREAM = 'https://api.energy-charts.info/price';
const CACHE_SECONDS = 15 * 60;

function json(
  body: unknown,
  status: number,
  cacheSeconds = 0,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...extraHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-store',
      // public/_headers covers static files only; Function responses set their own.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function handleGet(context: EventContext<unknown, string, unknown>): Promise<Response> {
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
}

/**
 * One handler for every method: GET serves the prices, HEAD the same headers without a body,
 * and anything else is refused with 405. With only a GET handler, Pages answered HEAD with the
 * HTML page.
 */
export const onRequest: PagesFunction = async (context) => {
  const { method } = context.request;
  if (method === 'GET') return handleGet(context);
  if (method === 'HEAD') {
    const response = await handleGet(context);
    return new Response(null, response);
  }
  return json({ error: 'Only GET and HEAD are supported.' }, 405, 0, { Allow: 'GET, HEAD' });
};
