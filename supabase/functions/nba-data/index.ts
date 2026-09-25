const sourceUrl = 'https://boxscorelab.com/downloads/2025-26-player-season-totals.csv';
const allowedOrigins = new Set([
  'https://yanyipeng1224.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

function headers(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'apikey, authorization, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'Vary': 'Origin',
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return new Response('ok', { headers: headers(origin) });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: headers(origin) });
  if (!origin || !allowedOrigins.has(origin)) return new Response('Origin not allowed', { status: 403, headers: headers(origin) });

  try {
    const upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(12_000) });
    if (!upstream.ok) throw new Error(`upstream returned ${upstream.status}`);
    const csv = await upstream.text();
    if (!csv.includes('\n') || csv.length > 400_000) throw new Error('unexpected CSV response');
    return new Response(csv, { headers: { ...headers(origin), 'Content-Type': 'text/csv; charset=utf-8' } });
  } catch (error) {
    console.error('NBA data fetch failed:', error instanceof Error ? error.name : 'unknown');
    return new Response('NBA player data is temporarily unavailable.', { status: 502, headers: { ...headers(origin), 'Content-Type': 'text/plain; charset=utf-8' } });
  }
});
