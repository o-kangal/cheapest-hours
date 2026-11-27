// Every /api/* path without its own function answers with a JSON 404, instead of Pages
// falling back to the HTML page with a 200.
export const onRequest: PagesFunction = () =>
  new Response(JSON.stringify({ error: 'Not found.' }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
