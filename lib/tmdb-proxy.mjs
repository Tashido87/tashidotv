// Imported only by server route handlers; never import into client components.
const ENDPOINT = /^(?:trending\/(?:all|movie|tv)\/(?:day|week)|movie\/(?:popular|top_rated|upcoming|now_playing)|tv\/(?:popular|top_rated|airing_today|on_the_air)|(?:movie|tv)\/\d+(?:\/(?:recommendations|similar))?|tv\/\d+\/season\/\d+|discover\/(?:movie|tv)|genre\/(?:movie|tv)\/list|person\/\d+(?:\/combined_credits)?|search\/(?:movie|multi))$/;
const QUERY_KEYS = new Set([
  'language', 'page', 'query', 'include_adult', 'append_to_response',
  'sort_by', 'with_genres', 'with_original_language', 'vote_count.gte',
  'vote_average.gte', 'primary_release_year', 'first_air_date_year', 'year',
  'primary_release_date.gte', 'primary_release_date.lte',
  'first_air_date.gte', 'first_air_date.lte', 'region',
]);

function failure(message, status) {
  return Response.json({ error: message }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
}

function upstreamFailure(status) {
  return failure('Media service temporarily unavailable', status === 404 ? 404 : status === 429 ? 429 : 502);
}

export async function catalogResponse(request, segments) {
  const endpoint = segments?.join('/') || '';
  if (!ENDPOINT.test(endpoint)) return failure('Unsupported catalog endpoint', 400);
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of incoming) {
    if (!QUERY_KEYS.has(key) || value.length > 500 || query.has(key)) {
      return failure('Invalid catalog query', 400);
    }
    if (key === 'page' && !/^(?:[1-9]\d?|[1-4]\d{2}|500)$/.test(value)) {
      return failure('Invalid page', 400);
    }
    if (key === 'append_to_response' && value.split(',').some(part => !['credits', 'videos', 'similar'].includes(part))) {
      return failure('Invalid catalog expansion', 400);
    }
    query.set(key, value);
  }
  const apiKey = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!apiKey) return failure('Catalog is not configured', 503);
  query.sort();
  query.set('api_key', apiKey);
  try {
    const response = await fetch(`https://api.themoviedb.org/3/${endpoint}?${query}`, {
      redirect: 'error', signal: AbortSignal.timeout(12000),
      next: { revalidate: 3600 },
    });
    if (!response.ok) return upstreamFailure(response.status);
    const data = await response.json();
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch {
    // Do not log credential-bearing upstream URLs or return upstream errors.
    return failure('Catalog connection failed. Please try again.', 502);
  }
}

export async function imageResponse(request, segments) {
  const path = segments?.join('/') || '';
  if (!/^(?:original|w1280|w500|w185)\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(path)
      || new URL(request.url).search) {
    return failure('Invalid image path', 400);
  }
  try {
    const response = await fetch(`https://image.tmdb.org/t/p/${path}`, {
      redirect: 'error', signal: AbortSignal.timeout(12000),
      next: { revalidate: 604800 },
    });
    if (!response.ok) return upstreamFailure(response.status);
    const contentType = response.headers.get('content-type')?.split(';')[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
      return failure('Invalid image response', 502);
    }
    // Complete the fetch before responding so timeouts become retryable errors.
    const body = await response.arrayBuffer();
    return new Response(body, { headers: {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    } });
  } catch {
    return failure('Image connection failed. Please try again.', 502);
  }
}
