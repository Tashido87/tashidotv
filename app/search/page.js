'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search as SearchIcon, X, Trash2, TrendingUp, Sparkles, Film, Tv, HelpCircle, Loader2 } from 'lucide-react';
import MediaCard from '@/components/MediaCard';
import { searchMulti, discoverByGenre } from '@/lib/tmdb';

const GENRES = [
  { id: 'action', name: 'Action', movieGenreId: 28, tvGenreId: 10759 },
  { id: 'comedy', name: 'Comedy', movieGenreId: 35, tvGenreId: 35 },
  { id: 'drama', name: 'Drama', movieGenreId: 18, tvGenreId: 18 },
  { id: 'scifi', name: 'Sci-Fi', movieGenreId: 878, tvGenreId: 10765 },
  { id: 'horror', name: 'Horror', movieGenreId: 27, tvGenreId: 9648 }, // Horror & Thriller/Mystery
  { id: 'animation', name: 'Animation', movieGenreId: 16, tvGenreId: 16 },
];

const TRENDING_SUGGESTIONS = [
  'Avengers',
  'Stranger Things',
  'Interstellar',
  'Breaking Bad',
  'Anime',
  'Wednesday'
];

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // URL States
  const urlQuery = searchParams.get('q') || '';
  const urlType = searchParams.get('type') || 'all'; // 'all', 'movie', 'tv'
  const urlGenre = searchParams.get('genre') || '';

  // Local States
  const [query, setQuery] = useState(urlQuery);
  const [mediaType, setMediaType] = useState(urlType);
  const [activeGenre, setActiveGenre] = useState(urlGenre);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  // Refs for debouncing
  const debounceTimeout = useRef(null);

  // Initialize recent searches from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tashidotv_recent_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Update URL search parameters smoothly
  const syncURL = (q, type, genre) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type && type !== 'all') params.set('type', type);
    if (genre) params.set('genre', genre);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Perform search / genre discovery
  const executeSearch = async (currentQuery, currentType, currentGenre, currentPage = 1, append = false) => {
    if (currentPage === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let items = [];
      let totalPages = 1;

      if (currentQuery.trim()) {
        // Run Multi Search
        const data = await searchMulti(currentQuery, currentPage);
        if (data) {
          items = data.results || [];
          totalPages = data.total_pages || 1;
        }

        // Add to recent searches if search is new and successful
        if (currentPage === 1 && items.length > 0) {
          saveRecentSearch(currentQuery.trim());
        }
      } else if (currentGenre) {
        // Discover by Genre (parallel fetch for movie and tv)
        const genreObj = GENRES.find((g) => g.id === currentGenre);
        if (genreObj) {
          const [movieRes, tvRes] = await Promise.all([
            currentType !== 'tv' ? discoverByGenre('movie', genreObj.movieGenreId, currentPage) : Promise.resolve(null),
            currentType !== 'movie' ? discoverByGenre('tv', genreObj.tvGenreId, currentPage) : Promise.resolve(null),
          ]);

          const movieItems = (movieRes?.results || []).map((m) => ({ ...m, media_type: 'movie' }));
          const tvItems = (tvRes?.results || []).map((t) => ({ ...t, media_type: 'tv' }));

          items = [...movieItems, ...tvItems];
          // Sort merged items by popularity
          items.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
          
          const maxPages = Math.max(movieRes?.total_pages || 1, tvRes?.total_pages || 1);
          totalPages = maxPages;
        }
      } else {
        // Clean state
        setResults([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // Filter results to remove persons and titles without covers
      let filtered = items.filter(
        (item) => item.media_type !== 'person' && (item.poster_path || item.backdrop_path)
      );

      // Filter by Media Type (Movie / TV) if tab is active
      if (currentType === 'movie') {
        filtered = filtered.filter((r) => r.media_type === 'movie');
      } else if (currentType === 'tv') {
        filtered = filtered.filter((r) => r.media_type === 'tv');
      }

      if (append) {
        // De-duplicate appended items
        setResults((prev) => {
          const existingIds = new Set(prev.map((x) => `${x.id}-${x.media_type}`));
          const newUnique = filtered.filter((x) => !existingIds.has(`${x.id}-${x.media_type}`));
          return [...prev, ...newUnique];
        });
      } else {
        setResults(filtered);
      }

      setHasMore(currentPage < totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Debounced search trigger when query or activeGenre or mediaType changes
  useEffect(() => {
    setPage(1);
    syncURL(query, mediaType, activeGenre);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      executeSearch(query, mediaType, activeGenre, 1, false);
    }, 350);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [query, mediaType, activeGenre]);

  // Load next page of results
  const loadMoreResults = () => {
    if (loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    executeSearch(query, mediaType, activeGenre, nextPage, true);
  };

  // Helper to save recent query search to LocalStorage
  const saveRecentSearch = (q) => {
    if (!q) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== q.toLowerCase());
      const updated = [q, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('tashidotv_recent_searches', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Helper to clear all recent searches
  const clearRecentSearches = (e) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem('tashidotv_recent_searches');
    } catch (e) {
      console.error(e);
    }
  };

  // Reset all filters and search input
  const resetAll = () => {
    setQuery('');
    setMediaType('all');
    setActiveGenre('');
    setResults([]);
    setPage(1);
    setHasMore(false);
  };

  return (
    <div className="pt-24 md:pt-28 pb-24 md:pb-16 max-w-[1600px] mx-auto px-6 lg:px-10 min-h-screen">
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-platinum mb-6">Search</h1>

      {/* Modern Search input container */}
      <div className="relative mb-6 max-w-2xl group">
        <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-white/80 transition duration-300" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value) {
              setActiveGenre(''); // Clear genre discovery when typing
            }
          }}
          placeholder="Movies, shows, genres..."
          className="w-full h-14 pl-14 pr-12 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-white/10 transition shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Recent Searches chips */}
      {!query && recentSearches.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-3 animate-fade-in">
          <span className="text-xs font-semibold text-white/40 flex items-center gap-1.5 mr-1">
            Recent Searches:
          </span>
          {recentSearches.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setQuery(item)}
              className="text-xs px-4 py-1.5 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 text-white/80 hover:text-platinum transition duration-200"
            >
              {item}
            </button>
          ))}
          <button
            onClick={clearRecentSearches}
            className="text-xs text-white/40 hover:text-red-400 font-semibold flex items-center gap-1 ml-2 transition"
            title="Clear all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Discovery Genre & Media Type Filters */}
      <div className="space-y-4 mb-10">
        {/* Media type tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-4">
          {[
            { id: 'all', label: 'All', icon: Sparkles },
            { id: 'movie', label: 'Movies', icon: Film },
            { id: 'tv', label: 'TV Shows', icon: Tv },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMediaType(id)}
              className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition border ${
                mediaType === id
                  ? 'bg-white text-black border-white shadow-[0_4px_12px_rgba(255,255,255,0.25)]'
                  : 'bg-white/5 text-white/70 border-white/5 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Scrolling Genre discovery chips */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 mask-fade-r">
          <span className="text-xs font-bold text-white/30 uppercase tracking-wider shrink-0 mr-2">
            Explore Genres:
          </span>
          {GENRES.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                if (activeGenre === g.id) {
                  setActiveGenre('');
                } else {
                  setQuery(''); // Clear query when choosing genre explore
                  setActiveGenre(g.id);
                }
              }}
              className={`shrink-0 text-xs px-4 py-2 rounded-full border transition duration-300 ${
                activeGenre === g.id
                  ? 'bg-gradient-to-r from-white to-white/90 text-black border-white font-bold shadow-lg'
                  : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton Grid */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-2xl bg-white/5 border border-white/5 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* No Query & No Genre explore default state */}
      {!loading && !query && !activeGenre && (
        <div className="max-w-xl py-12 flex flex-col gap-6 animate-fade-in">
          <div className="flex items-center gap-2.5 text-white/80">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-bold tracking-tight text-platinum">Popular Searches</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TRENDING_SUGGESTIONS.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setQuery(item)}
                className="flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/15 hover:bg-white/10 transition duration-300 text-left text-sm font-semibold text-white/80 hover:text-platinum group"
              >
                <span>{item}</span>
                <span className="text-xs text-white/30 group-hover:text-white/60 transition">↗</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search results loaded */}
      {!loading && (query || activeGenre) && results.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {results.map((item) => (
              <MediaCard
                key={`${item.id}-${item.media_type}`}
                item={item}
                mediaType={item.media_type}
              />
            ))}
          </div>

          {/* Load More Pagination */}
          {hasMore && (
            <div className="flex justify-center mt-12">
              <button
                onClick={loadMoreResults}
                disabled={loadingMore}
                className="inline-flex items-center gap-2.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm px-8 py-3.5 rounded-full transition duration-300 active:scale-95 disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Loading More...
                  </>
                ) : (
                  'Load More Results'
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Better Empty State */}
      {!loading && (query || activeGenre) && results.length === 0 && (
        <div className="py-24 text-center max-w-md mx-auto flex flex-col items-center gap-5 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-2">
            <HelpCircle className="w-8 h-8 text-white/40" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2">No Titles Found</h3>
            <p className="text-xs md:text-sm text-white/50 leading-relaxed">
              We couldn't find any results matching "{query || activeGenre}". Check the spelling, try a different filter, or clear your search to discover popular content.
            </p>
          </div>
          <button
            onClick={resetAll}
            className="mt-2 text-xs font-semibold text-black bg-white px-5 py-2.5 rounded-full hover:bg-white/95 transition shadow-lg"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="pt-28 pb-16 text-center max-w-[1600px] mx-auto px-6">
        <Loader2 className="w-8 h-8 animate-spin text-white/40 mx-auto mb-4" />
        <p className="text-white/40 text-sm">Loading Search...</p>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
