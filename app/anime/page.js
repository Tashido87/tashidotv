'use client';

import { useEffect, useState, useRef } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Play, Plus, Check, Info, ChevronsLeft, ChevronsRight } from 'lucide-react';
import MediaCard from '@/components/MediaCard';
import Hero from '@/components/Hero';
import { discoverMedia, IMG } from '@/lib/tmdb';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const FALLBACK_HERO_ANIME = [
  {
    id: 129,
    title: 'Spirited Away',
    name: 'Spirited Away',
    overview: 'A young girl, Chihiro, becomes trapped in a strange new world of spirits. When her parents undergo a mysterious transformation, she must call upon the courage she never knew she had to free her family.',
    backdrop_path: '/Ab8Gjg1wQ522UrqchwpHjycwII1.jpg',
    poster_path: '/39wmItIWsg5sclgU4yHDvBr7qcl.jpg',
    vote_average: 8.54,
    release_date: '2001-07-20',
    first_air_date: '2001-07-20',
    media_type: 'movie'
  },
  {
    id: 85937,
    title: 'Demon Slayer: Kimetsu no Yaiba',
    name: 'Demon Slayer: Kimetsu no Yaiba',
    overview: 'It is the Taisho Period in Japan. Tanjiro, a kindhearted boy who sells charcoal for a living, finds his family slaughtered by a demon. To make matters worse, Nezuko, the sole survivor, has been transformed into a demon. Tanjiro resolves to become a demon slayer to turn his sister back into a human and avenge his family.',
    backdrop_path: '/nTvM5mhwZ2V2XABIC2dKyvnccvE.jpg',
    poster_path: '/h8Rb9gBr4eG9f611Rj7t6EHj27B.jpg',
    vote_average: 8.68,
    release_date: '2019-04-06',
    first_air_date: '2019-04-06',
    media_type: 'tv'
  },
  {
    id: 372058,
    title: 'Your Name.',
    name: 'Your Name.',
    overview: 'High schoolers Mitsuha and Taki are complete strangers living separate lives. But one night, they suddenly switch places. Mitsuha wakes up in Taki’s body, and he in hers. This bizarre occurrence continues to happen randomly, and the two must adjust their lives around each other.',
    backdrop_path: '/k1saZVAL6ue3srIEzIEjTfURt1z.jpg',
    poster_path: '/q719jXXEz5gt18kgqLE8szvhQqZ.jpg',
    vote_average: 8.49,
    release_date: '2016-08-26',
    first_air_date: '2016-08-26',
    media_type: 'movie'
  },
  {
    id: 60625,
    title: 'Attack on Titan',
    name: 'Attack on Titan',
    overview: 'Several hundred years ago, humans were nearly exterminated by Titans. Titans are typically several stories tall, seem to have no intelligence, devour human beings and, worst of all, seem to do it for the pleasure rather than as a food source. A small percentage of humanity survived by walling themselves in a city protected by extremely high walls, even taller than the biggest Titans.',
    backdrop_path: '/hpe4l7RuLM74P46fvquLIeaKV6Y.jpg',
    poster_path: '/8Cg43jgbJv85t9cEq9tC1K8qW2G.jpg',
    vote_average: 8.66,
    release_date: '2013-04-07',
    first_air_date: '2013-04-07',
    media_type: 'tv'
  }
];

export default function AnimePage() {
  const { user } = useAuth();

  // Hero carousel state
  const [heroItems, setHeroItems] = useState([]);

  // Catalog grid state
  const [selectedTab, setSelectedTab] = useState('All'); // 'All', 'Movies', 'TV Shows'
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Fetch Hero Anime pool with robust error fallback
  useEffect(() => {
    async function loadHeroItems() {
      try {
        const [moviesRes, tvRes] = await Promise.all([
          discoverMedia('movie', {
            with_genres: 16,
            with_original_language: 'ja',
            sort_by: 'popularity.desc',
            page: 1
          }).catch(err => {
            console.error("TMDB anime movie discovery error:", err);
            return null;
          }),
          discoverMedia('tv', {
            with_genres: 16,
            with_original_language: 'ja',
            sort_by: 'popularity.desc',
            page: 1
          }).catch(err => {
            console.error("TMDB anime tv discovery error:", err);
            return null;
          })
        ]);

        const movieItems = (moviesRes && Array.isArray(moviesRes.results))
          ? moviesRes.results.slice(0, 6).map(m => ({ ...m, media_type: 'movie' }))
          : [];
        const tvItems = (tvRes && Array.isArray(tvRes.results))
          ? tvRes.results.slice(0, 6).map(t => ({ ...t, media_type: 'tv' }))
          : [];

        let combined = [...movieItems, ...tvItems]
          .filter(item => item && item.backdrop_path)
          .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

        if (combined.length < 2) {
          console.warn("Fewer than 2 valid anime hero items found from TMDB. Using static high-rated fallback payload.");
          combined = FALLBACK_HERO_ANIME;
        }

        setHeroItems(combined.slice(0, 10));
      } catch (err) {
        console.error("Critical error loading Anime Hero pool, falling back to static payload:", err);
        setHeroItems(FALLBACK_HERO_ANIME.slice(0, 10));
      }
    }
    loadHeroItems();
  }, []);



  // Fetch catalog collection with robust page bounds and error checks
  useEffect(() => {
    async function loadCollection() {
      setLoading(true);
      try {
        const ITEMS_PER_PAGE = 24;
        const startIdx = Math.max(0, (page - 1) * ITEMS_PER_PAGE);
        
        // Ensure page start and end are strictly within 1 and 500
        const computedStart = Math.floor(startIdx / 20) + 1;
        const tmdbPageStart = Math.min(500, Math.max(1, computedStart));
        const tmdbPageEnd = Math.min(500, tmdbPageStart + 1);

        let results = [];
        let totalCount = 0;

        if (selectedTab === 'Movies') {
          const [res1, res2] = await Promise.all([
            discoverMedia('movie', {
              with_genres: 16,
              with_original_language: 'ja',
              sort_by: 'popularity.desc',
              page: tmdbPageStart
            }).catch(e => { console.error("Movie res1 error:", e); return null; }),
            discoverMedia('movie', {
              with_genres: 16,
              with_original_language: 'ja',
              sort_by: 'popularity.desc',
              page: tmdbPageEnd
            }).catch(e => { console.error("Movie res2 error:", e); return null; })
          ]);
          
          const results1 = (res1 && Array.isArray(res1.results)) ? res1.results.map(m => ({ ...m, media_type: 'movie' })) : [];
          const results2 = (res2 && Array.isArray(res2.results)) ? res2.results.map(m => ({ ...m, media_type: 'movie' })) : [];
          results = [...results1, ...results2];
          totalCount = (res1 && typeof res1.total_results === 'number') ? res1.total_results : 0;
        } else if (selectedTab === 'TV Shows') {
          const [res1, res2] = await Promise.all([
            discoverMedia('tv', {
              with_genres: 16,
              with_original_language: 'ja',
              sort_by: 'popularity.desc',
              page: tmdbPageStart
            }).catch(e => { console.error("TV res1 error:", e); return null; }),
            discoverMedia('tv', {
              with_genres: 16,
              with_original_language: 'ja',
              sort_by: 'popularity.desc',
              page: tmdbPageEnd
            }).catch(e => { console.error("TV res2 error:", e); return null; })
          ]);
          
          const results1 = (res1 && Array.isArray(res1.results)) ? res1.results.map(t => ({ ...t, media_type: 'tv' })) : [];
          const results2 = (res2 && Array.isArray(res2.results)) ? res2.results.map(t => ({ ...t, media_type: 'tv' })) : [];
          results = [...results1, ...results2];
          totalCount = (res1 && typeof res1.total_results === 'number') ? res1.total_results : 0;
        } else {
          // Tab === 'All'
          const [mRes1, mRes2, tRes1, tRes2] = await Promise.all([
            discoverMedia('movie', {
              with_genres: 16,
              with_original_language: 'ja',
              sort_by: 'popularity.desc',
              page: tmdbPageStart
            }).catch(e => { console.error("All movie res1 error:", e); return null; }),
            discoverMedia('movie', {
              with_genres: 16,
              with_original_language: 'ja',
              sort_by: 'popularity.desc',
              page: tmdbPageEnd
            }).catch(e => { console.error("All movie res2 error:", e); return null; }),
            discoverMedia('tv', {
              with_genres: 16,
              with_original_language: 'ja',
              sort_by: 'popularity.desc',
              page: tmdbPageStart
            }).catch(e => { console.error("All TV res1 error:", e); return null; }),
            discoverMedia('tv', {
              with_genres: 16,
              with_original_language: 'ja',
              sort_by: 'popularity.desc',
              page: tmdbPageEnd
            }).catch(e => { console.error("All TV res2 error:", e); return null; })
          ]);

          const movies = [
            ...((mRes1 && Array.isArray(mRes1.results)) ? mRes1.results.map(m => ({ ...m, media_type: 'movie' })) : []),
            ...((mRes2 && Array.isArray(mRes2.results)) ? mRes2.results.map(m => ({ ...m, media_type: 'movie' })) : []),
          ];
          const tvs = [
            ...((tRes1 && Array.isArray(tRes1.results)) ? tRes1.results.map(t => ({ ...t, media_type: 'tv' })) : []),
            ...((tRes2 && Array.isArray(tRes2.results)) ? tRes2.results.map(t => ({ ...t, media_type: 'tv' })) : []),
          ];

          const merged = [...movies, ...tvs].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
          results = merged;
          
          const mTotal = (mRes1 && typeof mRes1.total_results === 'number') ? mRes1.total_results : 0;
          const tTotal = (tRes1 && typeof tRes1.total_results === 'number') ? tRes1.total_results : 0;
          totalCount = mTotal + tTotal;
        }

        const offset = startIdx % 20;
        const pageItems = results.slice(offset, offset + ITEMS_PER_PAGE);
        setItems(pageItems);

        const computedTotalPages = Math.min(416, Math.ceil(totalCount / ITEMS_PER_PAGE) || 1);
        setTotalPages(computedTotalPages);
      } catch (err) {
        console.error("Error loading Anime catalogue:", err);
        setItems([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    }
    loadCollection();
  }, [selectedTab, page]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    // Scroll smoothly to catalog top (past the Hero section)
    const el = document.getElementById('anime-collection');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

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

  const skeletonCount = Array.from({ length: 24 });

  return (
    <div className="min-h-screen bg-transparent text-zinc-900 dark:text-white transition-colors duration-300">
      
      {/* Dynamic Cinematic Hero Carousel */}
      {heroItems.length > 0 && <Hero items={heroItems} />}

      {/* Main Catalog View */}
      <div id="anime-collection" className="max-w-[1600px] mx-auto px-6 lg:px-10 py-16 transition-colors duration-300 select-none">
        
        {/* Header Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 text-zinc-500 dark:text-white/50 text-[11px] font-bold tracking-widest uppercase mb-2">
              <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
              <span>Japanese Animation catalogue</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-[1.05]">
              Anime Catalog
            </h2>
            <p className="mt-3 text-zinc-500 dark:text-white/40 max-w-xl text-[14px] leading-relaxed">
              Explore your favorite Japanese animations, top popular anime movies, and binge-worthy TV series with premium quality.
            </p>
          </div>

          {/* Premium Sub-Navigation Pill Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {['All', 'Movies', 'TV Shows'].map((tab) => {
              const isActive = selectedTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setSelectedTab(tab);
                    setPage(1);
                  }}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 transform active:scale-95 border ${
                    isActive
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white shadow-lg'
                      : 'bg-black/5 text-zinc-800 border-black/5 hover:bg-black/10 dark:bg-white/10 dark:text-white dark:border-white/5 dark:hover:bg-white/20'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Collection Display Grid */}
        <div className="transition-all duration-500">
          {loading ? (
            /* Catalog Loading Skeleton */
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
            /* Loaded Catalog Items */
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {items.map((anime, index) => {
                  const type = anime.media_type || (selectedTab === 'Movies' ? 'movie' : 'tv');
                  return (
                    <div
                      key={`${anime.id}-${index}`}
                      className="animate-fade-in"
                      style={{ animationDelay: `${(index % 12) * 40}ms` }}
                    >
                      <MediaCard item={anime} mediaType={type} isGrid={true} />
                    </div>
                  );
                })}
              </div>

              {/* Navigation Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-16 select-none animate-fade-in">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={page === 1}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 disabled:opacity-20 disabled:pointer-events-none transition-all duration-305 hover:scale-105 active:scale-95 text-zinc-800 dark:text-white shadow-inner"
                    aria-label="First Page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 disabled:opacity-20 disabled:pointer-events-none transition-all duration-305 hover:scale-105 active:scale-95 text-zinc-800 dark:text-white shadow-inner"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {getPageNumbers().map((p) => {
                    const isActive = p === page;
                    return (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 hover:scale-105 active:scale-95 border ${
                          isActive
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white shadow-lg scale-110'
                            : 'bg-black/5 text-zinc-800 border-black/5 hover:bg-black/10 dark:bg-white/5 dark:text-white dark:border-white/5 dark:hover:bg-white/10'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 disabled:opacity-20 disabled:pointer-events-none transition-all duration-305 hover:scale-105 active:scale-95 text-zinc-800 dark:text-white shadow-inner"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={page === totalPages}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 disabled:opacity-20 disabled:pointer-events-none transition-all duration-305 hover:scale-105 active:scale-95 text-zinc-800 dark:text-white shadow-inner"
                    aria-label="Last Page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Empty Grid State */
            <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 bg-zinc-900/10 dark:bg-zinc-900/10 border border-black/5 dark:border-white/5 rounded-3xl backdrop-blur-md px-6 transition-colors duration-300">
              <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center border border-black/10 dark:border-white/10 shadow-inner">
                <Sparkles className="w-6 h-6 text-zinc-400 dark:text-white/20" />
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-900 dark:text-white">No Anime Collection Found</p>
                <p className="text-[12px] text-zinc-500 dark:text-white/40 mt-1 max-w-xs mx-auto">
                  No active releases matched this Japanese Anime type filter.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
