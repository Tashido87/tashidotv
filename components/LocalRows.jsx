'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play, MoreVertical, Trash2 } from 'lucide-react';
import { IMG } from '@/lib/tmdb';
import { useAuth } from '@/components/AuthProvider';
import { deleteWatchProgress, subscribeWatchHistory } from '@/lib/db';

export default function LocalRows() {
  const { user } = useAuth();
  const [continueWatching, setContinueWatching] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [isMounted, setIsMounted] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const continueScroller = useRef(null);
  const watchlistScroller = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    
    let unsubscribe = () => {};

    try {
      unsubscribe = subscribeWatchHistory(user?.uid || null, (mergedItems) => {
        // Data is already merged & deduplicated by subscribeWatchHistory
        setContinueWatching(mergedItems);
      });
    } catch (err) {
      console.error('Failed to initialize watch history subscription:', err);
    }

    // 2. Load watchlist (My List) — still localStorage only for now
    const loadWatchlist = () => {
      try {
        const listData = localStorage.getItem('tashidotv_watchlist');
        if (listData) {
          const list = JSON.parse(listData);
          const sortedList = list.sort((a, b) => b.addedAt - a.addedAt);
          setWatchlist(sortedList);
        }
      } catch (e) {}
    };

    loadWatchlist();

    // Listen to changes in case the user opens/closes details within the same tab session
    window.addEventListener('storage', loadWatchlist);
    window.addEventListener('tashidotv_update', loadWatchlist);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', loadWatchlist);
      window.removeEventListener('tashidotv_update', loadWatchlist);
    };
  }, [user]);

  // Global click handler to close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveDropdown(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleScroll = (scrollerRef, dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.85), behavior: 'smooth' });
  };

  const handleRemoveWatching = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    const itemId = String(item.id);
    const mediaType = item.mediaType || 'movie';
    const season = item.season || 0;
    const episode = item.episode || 0;

    // Remove from both Firestore + localStorage via unified utility
    await deleteWatchProgress(user?.uid || null, mediaType, itemId, season, episode);

    // Update local state immediately
    setContinueWatching(prev => prev.filter(p => !(String(p.id) === itemId && (p.mediaType || 'movie') === mediaType)));
    
    // Dispatch sync event
    window.dispatchEvent(new CustomEvent('tashidotv_update', { detail: { action: 'delete', mediaType, id: itemId } }));
    setActiveDropdown(null);
  };

  if (!isMounted) return null;
  if (continueWatching.length === 0 && watchlist.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Continue Watching Section */}
      {continueWatching.length > 0 && (
        <section className="relative group/row py-4">
          <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Continue Watching</h2>
              <div className="hidden md:flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition">
                <button
                  onClick={() => handleScroll(continueScroller, -1)}
                  className="p-2 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/15 dark:border-white/5 text-zinc-900 dark:text-white transition"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleScroll(continueScroller, 1)}
                  className="p-2 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/15 dark:border-white/5 text-zinc-900 dark:text-white transition"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={continueScroller}
            className="scrollbar-hide overflow-x-auto overflow-y-hidden py-4 scroll-smooth w-full transform-gpu will-change-scroll overscroll-x-contain touch-pan-x"
          >
            <div className="flex gap-4 px-6 lg:px-10 max-w-[1600px] mx-auto">
              {continueWatching.map((item) => {
                const img = IMG.backdrop(item.backdropPath || item.posterPath);
                // Calculate watch percentage
                const percent = item.duration > 0 ? (item.progress / item.duration) * 100 : 0;
                const formattedPercent = Math.min(100, Math.max(0, percent));
                const uniqueId = `${item.mediaType || 'movie'}_${item.id}`;
                const isDropdownOpen = activeDropdown === uniqueId;
                
                return (
                  <div
                    key={`continue-${item.mediaType}-${item.id}`}
                    className="relative group/card flex-shrink-0 w-[240px] md:w-[300px] transition-all duration-300 hover:scale-[1.03]"
                  >
                    {/* Poster Area */}
                    <div className="relative">
                      <Link
                        href={`/${item.mediaType}/${item.id}?play=1${item.mediaType === 'tv' && item.season && item.episode ? `&season=${item.season}&episode=${item.episode}` : ''}`}
                        className="block"
                      >
                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-800 contain-content border border-black/5 dark:border-white/10 group-hover/card:border-black/10 dark:group-hover/card:border-white/20">
                          {img ? (
                            <Image
                              src={img}
                              alt={item.title}
                              fill
                              sizes="(max-width: 768px) 240px, 300px"
                              className="object-cover transition duration-500 group-hover/card:scale-105"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-white/30 text-xs text-center p-4">
                              {item.title}
                            </div>
                          )}
                          
                          {/* Play overlay on hover */}
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/card:opacity-100 transition duration-300 flex items-center justify-center">
                            <div className="p-3 rounded-full bg-white text-black shadow-lg transform scale-90 group-hover/card:scale-100 transition duration-300">
                              <Play className="w-5 h-5 fill-black" />
                            </div>
                          </div>

                          {/* Info label (TV Season/Episode details) */}
                          {item.mediaType === 'tv' && item.season && item.episode && (
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-bold text-white/95">
                              S{item.season} E{item.episode}
                            </div>
                          )}

                          {/* Progress bar */}
                          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-white/20">
                            <div 
                              className="h-full bg-red-500 transition-all duration-300" 
                              style={{ width: `${formattedPercent || 2}%` }} 
                            />
                          </div>
                        </div>
                      </Link>

                      {/* Three-dots Menu Trigger Button is removed from poster overlay */}
                    </div>

                    {/* Title Area & Actions */}
                    <div className="flex justify-between items-start gap-2 w-full mt-2 px-1">
                      <Link
                        href={`/${item.mediaType}/${item.id}?play=1${item.mediaType === 'tv' && item.season && item.episode ? `&season=${item.season}&episode=${item.episode}` : ''}`}
                        className="block min-w-0 flex-1"
                      >
                        <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight transition-colors duration-300">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-white/40 mt-0.5 font-medium transition-colors duration-300">
                          {item.mediaType === 'tv' ? 'Series' : 'Movie'} 
                          {item.duration > 0 && ` · ${Math.round(item.progress / 60)}m left`}
                        </p>
                      </Link>

                      {/* Three-dots Menu Trigger Button */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveDropdown(isDropdownOpen ? null : uniqueId);
                          }}
                          className="text-zinc-400 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white transition-colors p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
                          aria-label="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown menu */}
                        {isDropdownOpen && (
                          <div 
                            className="absolute bottom-full right-0 mb-1.5 w-44 bg-white/95 dark:bg-zinc-950/95 border border-black/5 dark:border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl z-40 flex flex-col scale-100 origin-bottom-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => handleRemoveWatching(e, item)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] font-semibold text-red-600 hover:text-red-500 hover:bg-black/5 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-white/5 rounded-lg transition duration-200"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                              Remove from watching
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* My List Section */}
      {watchlist.length > 0 && (
        <section className="relative group/row py-4">
          <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">My List</h2>
              <div className="hidden md:flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition">
                <button
                  onClick={() => handleScroll(watchlistScroller, -1)}
                  className="p-2 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/15 dark:border-white/5 text-zinc-900 dark:text-white transition"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleScroll(watchlistScroller, 1)}
                  className="p-2 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 dark:bg-white/5 dark:hover:bg-white/15 dark:border-white/5 text-zinc-900 dark:text-white transition"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={watchlistScroller}
            className="scrollbar-hide overflow-x-auto overflow-y-hidden py-4 scroll-smooth w-full transform-gpu will-change-scroll overscroll-x-contain touch-pan-x"
          >
            <div className="flex gap-4 px-6 lg:px-10 max-w-[1600px] mx-auto">
              {watchlist.map((item) => {
                const title = item.title || item.name;
                const img = IMG.poster(item.poster_path || item.backdrop_path);
                
                return (
                  <Link
                    key={`watchlist-${item.mediaType}-${item.id}`}
                    href={`/${item.mediaType}/${item.id}`}
                    className="group/card flex-shrink-0 w-[140px] md:w-[180px] transition-all duration-300 hover:scale-[1.04]"
                  >
                    <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-800 contain-content border border-black/5 dark:border-white/10 group-hover/card:border-black/10 dark:group-hover/card:border-white/20">
                      {img ? (
                        <Image
                          src={img}
                          alt={title}
                          fill
                          sizes="(max-width: 768px) 140px, 180px"
                          className="object-cover transition duration-500 group-hover/card:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-white/30 text-xs text-center p-4">
                          {title}
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition duration-300" />
                    </div>
                    <div className="mt-2 px-1">
                      <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight transition-colors duration-300">
                        {title}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-white/40 mt-0.5 transition-colors duration-300">
                        {item.mediaType === 'tv' ? 'Series' : 'Movie'}
                        {item.release_date && ` · ${item.release_date.slice(0, 4)}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
