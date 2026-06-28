// YouTube trailer search utility via Piped API (no API key needed)
// Falls back across multiple instances for reliability

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.r4fo.com',
];

const trailerCache = new Map();

export async function searchYouTubeTrailer(title, year) {
  if (!title) return null;

  const cacheKey = `${title}_${year || ''}`;
  if (trailerCache.has(cacheKey)) {
    return trailerCache.get(cacheKey);
  }

  const query = `${title} ${year || ''} official trailer`;

  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = await res.json();
      const items = data.items || [];

      // Prioritize results that look like official trailers
      const trailerItem =
        items.find((item) => {
          const t = (item.title || '').toLowerCase();
          return t.includes('official trailer');
        }) ||
        items.find((item) => {
          const t = (item.title || '').toLowerCase();
          return t.includes('trailer');
        }) ||
        items[0];

      if (trailerItem?.url) {
        // Piped returns URLs like "/watch?v=VIDEO_ID"
        const videoId = trailerItem.url.replace('/watch?v=', '');
        trailerCache.set(cacheKey, videoId);
        return videoId;
      }
    } catch (e) {
      // Instance unavailable, try next
      continue;
    }
  }

  trailerCache.set(cacheKey, null);
  return null;
}
