// Reusable TMDB API fetcher utility
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const SERVER_REVALIDATE_SECONDS = 604800;

export const IMG = {
  original: (path) => (path ? `https://image.tmdb.org/t/p/original${path}` : null),
  backdrop: (path) => (path ? `https://image.tmdb.org/t/p/w1280${path}` : null),
  poster: (path) => (path ? `https://image.tmdb.org/t/p/w500${path}` : null),
  profile: (path) => (path ? `https://image.tmdb.org/t/p/w185${path}` : null),
};

const clientCache = new Map();
const MAX_CACHE_SIZE = 200;

function setCache(key, value) {
  if (clientCache.size >= MAX_CACHE_SIZE) {
    const firstKey = clientCache.keys().next().value;
    clientCache.delete(firstKey);
  }
  clientCache.set(key, value);
}

async function fetchRaw(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', API_KEY);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const urlStr = url.toString();

  // Client-side cache check
  if (typeof window !== 'undefined') {
    if (clientCache.has(urlStr)) {
      return clientCache.get(urlStr);
    }
  }

  try {
    const fetchOptions = typeof window === 'undefined'
      ? { next: { revalidate: SERVER_REVALIDATE_SECONDS } }
      : undefined;
    const res = await fetch(urlStr, fetchOptions);
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    const data = await res.json();

    if (typeof window !== 'undefined') {
      setCache(urlStr, data);
    }
    return data;
  } catch (err) {
    console.error('TMDB fetch error:', endpoint, err);
    return null;
  }
}

async function tmdbFetch(endpoint, params = {}) {
  // If language is explicitly set, respect it
  if (params.language) {
    return fetchRaw(endpoint, params);
  }

  // Fetch Burmese and English versions in parallel
  const [burmeseData, englishData] = await Promise.all([
    fetchRaw(endpoint, { ...params, language: 'my-MM' }),
    fetchRaw(endpoint, { ...params, language: 'en-US' })
  ]);

  if (!englishData) return burmeseData;
  if (!burmeseData) return englishData;

  // Deep clone the English dataset as the primary structure to keep all metadata (titles, names) in English
  const merged = JSON.parse(JSON.stringify(englishData));

  // Inject Burmese overview into lists (e.g., search, trending, popular, discover)
  if (merged && Array.isArray(merged.results) && burmeseData && Array.isArray(burmeseData.results)) {
    const burmeseMap = new Map(burmeseData.results.map(item => [item.id, item]));
    merged.results = merged.results.map(item => {
      const burmeseItem = burmeseMap.get(item.id);
      
      // Override overview with Burmese if present and not empty
      if (burmeseItem && burmeseItem.overview && burmeseItem.overview.trim() !== '') {
        item.overview = burmeseItem.overview;
      }
      
      // Fallback message if both are missing
      if (!item.overview || item.overview.trim() === '') {
        item.overview = 'အကြောင်းအရာ မရရှိနိုင်သေးပါ။ (Overview not available.)';
      }
      return item;
    });
  }

  // Inject Burmese overview into single details (e.g., movie details, TV details)
  if (merged && !merged.results) {
    if (burmeseData.overview && burmeseData.overview.trim() !== '') {
      merged.overview = burmeseData.overview;
    }
    
    if (!merged.overview || merged.overview.trim() === '') {
      merged.overview = 'အကြောင်းအရာ မရရှိနိုင်သေးပါ။ (Overview not available.)';
    }

    // Merge episodes overview in season details if applicable
    if (Array.isArray(merged.episodes) && Array.isArray(burmeseData.episodes)) {
      const burmeseEpMap = new Map(burmeseData.episodes.map(ep => [ep.id, ep]));
      merged.episodes = merged.episodes.map(ep => {
        const burmeseEp = burmeseEpMap.get(ep.id);
        
        if (burmeseEp && burmeseEp.overview && burmeseEp.overview.trim() !== '') {
          ep.overview = burmeseEp.overview;
        }
        
        if (!ep.overview || ep.overview.trim() === '') {
          ep.overview = 'အကြောင်းအရာ မရရှိနိုင်သေးပါ။ (Overview not available.)';
        }
        return ep;
      });
    }
  }

  return merged;
}

// Movies
export const getTrending = (mediaType = 'all', timeWindow = 'week') =>
  tmdbFetch(`/trending/${mediaType}/${timeWindow}`);

export const getPopularMovies = (page = 1) => tmdbFetch('/movie/popular', { page });
export const getTopRatedMovies = (page = 1) => tmdbFetch('/movie/top_rated', { page });
export const getUpcomingMovies = (page = 1) => tmdbFetch('/movie/upcoming', { page });
export const getNowPlayingMovies = (page = 1) => tmdbFetch('/movie/now_playing', { page });

// TV
export const getPopularTV = (page = 1) => tmdbFetch('/tv/popular', { page });
export const getTopRatedTV = (page = 1) => tmdbFetch('/tv/top_rated', { page });
export const getAiringTodayTV = (page = 1) => tmdbFetch('/tv/airing_today', { page });
export const getOnTheAirTV = (page = 1) => tmdbFetch('/tv/on_the_air', { page });

// Details
export const getMovieDetails = (id) =>
  tmdbFetch(`/movie/${id}`, { append_to_response: 'credits,videos,similar' });

export const getTVDetails = (id) =>
  tmdbFetch(`/tv/${id}`, { append_to_response: 'credits,videos,similar' });

export const getTVSeasonDetails = (tvId, seasonNumber) =>
  tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`);

// Recommendations
export const getMovieRecommendations = (id, page = 1) =>
  tmdbFetch(`/movie/${id}/recommendations`, { page });

export const getTVRecommendations = (id, page = 1) =>
  tmdbFetch(`/tv/${id}/recommendations`, { page });

export const fetchRecommendations = async (id, mediaType = 'movie') => {
  let data = await tmdbFetch(`/${mediaType}/${id}/recommendations`, { page: 1 });
  
  if (!data?.results || data.results.length === 0) {
    data = await tmdbFetch(`/${mediaType}/${id}/similar`, { page: 1 });
  }

  if (data?.results) {
    return data.results.filter(item => item.poster_path);
  }
  return [];
};

// Discover by genre
export const discoverByGenre = (mediaType, genreId, page = 1) =>
  tmdbFetch(`/discover/${mediaType}`, { with_genres: genreId, page });

export const getGenres = (mediaType) => tmdbFetch(`/genre/${mediaType}/list`);

// Generic discover helper for custom admin categories
export const discoverMedia = (mediaType = 'movie', params = {}) =>
  tmdbFetch(`/discover/${mediaType}`, params);


// Person / Cast
export const getPersonDetails = (id) => tmdbFetch(`/person/${id}`);
export const getPersonCredits = (id) => tmdbFetch(`/person/${id}/combined_credits`);

// Search
export const searchMovies = (query, page = 1) =>
  tmdbFetch('/search/movie', { query, page, include_adult: false });

export const searchMulti = (query, page = 1) =>
  tmdbFetch('/search/multi', { query, page, include_adult: false });

// Stream URL builder (vidsrc)
export const streamUrl = (mediaType, id, season, episode) => {
  if (mediaType === 'tv') {
    const s = season || 1;
    const e = episode || 1;
    return `https://vidsrc.to/embed/tv/${id}/${s}/${e}`;
  }
  return `https://vidsrc.to/embed/movie/${id}`;
};
