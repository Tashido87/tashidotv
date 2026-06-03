'use client';

import { useEffect, useState, useRef } from 'react';
import { Tv, ChevronLeft, ChevronRight, ChevronDown, Filter, Loader2, ChevronsLeft, ChevronsRight } from 'lucide-react';
import MediaCard from '@/components/MediaCard';
import Hero from '@/components/Hero';
import { discoverMedia } from '@/lib/tmdb';

const TV_GENRES = [
  { name: 'All', id: 'All' },
  { name: 'Action & Adventure', id: '10759' },
  { name: 'Animation', id: '16' },
  { name: 'Comedy', id: '35' },
  { name: 'Crime', id: '80' },
  { name: 'Documentary', id: '99' },
  { name: 'Drama', id: '18' },
  { name: 'Family', id: '10751' },
  { name: 'Kids', id: '10762' },
  { name: 'Mystery', id: '9648' },
  { name: 'News', id: '10763' },
  { name: 'Reality', id: '10764' },
  { name: 'Sci-Fi & Fantasy', id: '10765' },
  { name: 'Soap', id: '10766' },
  { name: 'Talk', id: '10767' },
  { name: 'War & Politics', id: '10768' },
  { name: 'Western', id: '37' }
];

export default function TVPage() {
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [heroItems, setHeroItems] = useState([]);

  // Fetch Hero TV Shows at mount
  useEffect(() => {
    async function loadHeroTV() {
      try {
        const res = await discoverMedia('tv', {
          sort_by: 'popularity.desc',
          page: 1
        });
        if (res && res.results) {
          const filtered = res.results
            .filter(item => item.backdrop_path && item.poster_path)
            .map(item => ({ ...item, media_type: 'tv' }));
          setHeroItems(filtered.slice(0, 10));
        }
      } catch (err) {
        console.error("Error loading TV Hero items:", err);
      }
    }
    loadHeroTV();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch TV shows whenever page or genre changes
  useEffect(() => {
    async function loadTV() {
      setLoading(true);
      try {
        const params = {
          sort_by: 'popularity.desc',
        };
        if (selectedGenre !== 'All') {
          params.with_genres = selectedGenre;
        }

        const ITEMS_PER_PAGE = 24;
        const startIdx = (page - 1) * ITEMS_PER_PAGE;
        
        // Determine TMDB pages to fetch (TMDB returns 20 items per page)
        const tmdbPageStart = Math.floor(startIdx / 20) + 1;
        const tmdbPageEnd = tmdbPageStart + 1;
        
        // Fetch both pages in parallel
        const [res1, res2] = await Promise.all([
          discoverMedia('tv', { ...params, page: tmdbPageStart }),
          discoverMedia('tv', { ...params, page: tmdbPageEnd })
        ]);
        
        const results1 = res1?.results || [];
        const results2 = res2?.results || [];
        const mergedResults = [...results1, ...results2];
        
        // Slice the exact 24 items
        const offset = startIdx % 20;
        const pageItems = mergedResults.slice(offset, offset + ITEMS_PER_PAGE);
        setItems(pageItems);

        // Calculate custom total pages (TMDB discover limit caps at 500 pages * 20 items = 10,000 items / 24 = 416 custom pages)
        const totalResults = res1?.total_results || 0;
        const computedTotalPages = Math.min(416, Math.ceil(totalResults / ITEMS_PER_PAGE) || 1);
        setTotalPages(computedTotalPages);
      } catch (err) {
        console.error("Error loading TV shows:", err);
        setItems([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    }

    loadTV();
  }, [selectedGenre, page]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    const el = document.getElementById('tv-collection');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Generate 5 page buttons with the current page at the middle
  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const selectedGenreName = TV_GENRES.find(g => g.id === selectedGenre)?.name || 'All';
  const isGenreActive = selectedGenre !== 'All';
  const skeletonCount = Array.from({ length: 24 });

  return (
    <div className="min-h-screen bg-transparent text-zinc-900 dark:text-white select-none transition-colors duration-300">
      {/* Dynamic TV Hero Carousel */}
      {heroItems.length > 0 && <Hero items={heroItems} />}

      <div id="tv-collection" className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-16 pb-16">
        {/* Title & Header */}
      <div className="relative z-40 mb-10 animate-fade-in flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-white/50 text-[11px] font-bold tracking-widest uppercase mb-1.5">
            <Tv className="w-4 h-4 text-zinc-500 dark:text-white/60 animate-pulse" />
            <span>Browse TV Series</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-[1.05]">
            TV Shows
          </h1>
          <p className="mt-3 text-zinc-500 dark:text-white/40 max-w-xl text-[14px] leading-relaxed">
            Dive into binge-worthy shows, high-budget series, and popular global dramas sorted by popularity.
          </p>
        </div>

        {/* Premium Genre Floating Dropdown Trigger & List */}
        <div className="relative z-30" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 transform active:scale-95 border ${
              isGenreActive
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white shadow-lg shadow-black/5 dark:shadow-white/10 scale-105'
                : 'bg-black/5 text-zinc-800 border-black/5 hover:bg-black/10 dark:bg-white/10 dark:text-white dark:border-white/5 dark:hover:bg-white/20'
            }`}
          >
            <Filter className={`w-3.5 h-3.5 ${isGenreActive ? 'text-white dark:text-black' : 'text-zinc-500 dark:text-white/60'}`} />
            <span>Genre: {selectedGenreName}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-300 ${
                dropdownOpen ? 'rotate-180' : 'rotate-0'
              } ${isGenreActive ? 'text-white dark:text-black' : 'text-zinc-500 dark:text-white/60'}`}
            />
          </button>

          {/* Animated Dropdown Menu Overlay */}
          <div
            className={`absolute right-0 mt-3 w-64 origin-top-right backdrop-blur-xl bg-white/95 dark:bg-zinc-900/95 rounded-2xl p-2 border border-zinc-200 dark:border-white/10 shadow-2xl shadow-zinc-950/20 dark:shadow-black/70 z-50 max-h-[360px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-white/10 transition-all duration-150 ease-out ${
              dropdownOpen
                ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
            }`}
          >
            <div className="grid grid-cols-1 gap-0.5">
              {TV_GENRES.map((genre) => {
                const isActive = selectedGenre === genre.id;
                return (
                  <button
                    key={genre.id}
                    onClick={() => {
                      setSelectedGenre(genre.id);
                      setPage(1);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                        : 'text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/5'
                    }`}
                  >
                    {genre.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Grid container with smooth transition */}
      <div className="transition-all duration-500">
        {loading ? (
          /* Loading skeleton */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {skeletonCount.map((_, i) => (
              <div key={i} className="space-y-3 animate-pulse">
                <div className="aspect-[2/3] w-full rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5" />
                <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-black/5 dark:bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          /* Real Data Grid */
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {items.map((show, index) => (
                <div
                  key={`${show.id}-${index}`}
                  className="animate-fade-in"
                  style={{ animationDelay: `${(index % 12) * 40}ms` }}
                >
                  <MediaCard item={show} mediaType="tv" isGrid={true} />
                </div>
              ))}
            </div>

            {/* Apple-style Pagination Navigator */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-16 animate-fade-in select-none">
                {/* First Page Button */}
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={page === 1}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 disabled:opacity-20 disabled:pointer-events-none transition-all duration-300 hover:scale-105 active:scale-95 shadow-inner text-zinc-850 dark:text-white"
                  aria-label="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 disabled:opacity-20 disabled:pointer-events-none transition-all duration-300 hover:scale-105 active:scale-95 shadow-inner text-zinc-850 dark:text-white"
                  aria-label="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* 5 Page Number Buttons */}
                {getPageNumbers().map((p) => {
                  const isActive = p === page;
                  return (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 hover:scale-105 active:scale-95 border ${
                        isActive
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white shadow-lg shadow-black/5 dark:shadow-white/10 scale-110'
                          : 'bg-black/5 text-zinc-800 border-black/5 hover:bg-black/10 dark:bg-white/5 dark:text-white dark:border-white/5 dark:hover:bg-white/10'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 disabled:opacity-20 disabled:pointer-events-none transition-all duration-300 hover:scale-105 active:scale-95 shadow-inner text-zinc-850 dark:text-white"
                  aria-label="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Last Page Button */}
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={page === totalPages}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 disabled:opacity-20 disabled:pointer-events-none transition-all duration-300 hover:scale-105 active:scale-95 shadow-inner text-zinc-850 dark:text-white"
                  aria-label="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 bg-zinc-900/10 dark:bg-zinc-900/10 border border-black/5 dark:border-white/5 rounded-3xl backdrop-blur-md px-6">
            <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center border border-black/10 dark:border-white/10 shadow-inner">
              <Tv className="w-6 h-6 text-zinc-400 dark:text-white/20" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900 dark:text-white">No TV Shows Found</p>
              <p className="text-[12px] text-zinc-500 dark:text-white/40 mt-1 max-w-xs mx-auto">
                No active releases matched this genre filter. Select another filter from the dropdown.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
