'use client';

import { useEffect, useState } from 'react';
import { Play, Clock, Loader2, MoreVertical, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { IMG } from '@/lib/tmdb';
import { deleteWatchProgress, subscribeWatchHistory } from '@/lib/db';

export default function WatchingPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    if (authLoading) return;

    let unsubscribe = () => {};

    try {
      unsubscribe = subscribeWatchHistory(user?.uid || null, (firestoreItems) => {
        let localItems = [];
        try {
          const stored = localStorage.getItem('tashidotv_progress');
          if (stored) {
            localItems = Object.values(JSON.parse(stored));
          }
        } catch (e) {}

        // Merge and deduplicate by unique show/movie ID
        const mergeMap = new Map();
        const allItems = [...localItems, ...firestoreItems];

        for (const item of allItems) {
          const key = `${item.mediaType || 'movie'}_${item.id}`;
          const existing = mergeMap.get(key);
          if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
            mergeMap.set(key, item);
          }
        }

        const mergedList = Array.from(mergeMap.values());
        mergedList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        setItems(mergedList);
        setLoading(false);

        // One-time migration/sync: Upload isolated localStorage items to Firestore
        if (user?.uid) {
          localItems.forEach(localItem => {
            const firestoreItem = firestoreItems.find(f => String(f.id) === String(localItem.id) && f.mediaType === localItem.mediaType);
            if (!firestoreItem || (localItem.updatedAt || 0) > (firestoreItem.updatedAt || 0)) {
              import('@/lib/db').then(({ setWatchProgress }) => {
                setWatchProgress(user.uid, localItem).catch(e => console.warn('Migration failed', e));
              });
            }
          });
        }
      });
    } catch (err) {
      console.error('Failed to initialize watch history subscription:', err);
      setLoading(false);
    }

    return () => {
      unsubscribe();
    };
  }, [user?.uid, authLoading]);

  // Global click handler to close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveDropdown(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleRemoveWatching = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    const itemId = String(item.id);
    const mediaType = item.mediaType || 'movie';
    const season = item.season || 0;
    const episode = item.episode || 0;

    // Remove from both Firestore + localStorage via unified utility
    await deleteWatchProgress(user?.uid || null, mediaType, itemId, season, episode);

    // Update state instantly
    setItems(prev => prev.filter(p => !(String(p.id) === itemId && (p.mediaType || 'movie') === mediaType)));

    // Dispatch sync event
    window.dispatchEvent(new CustomEvent('tashidotv_update', { detail: { action: 'delete', mediaType, id: itemId } }));
    setActiveDropdown(null);
  };

  if (authLoading || (loading && items.length === 0)) {
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center space-y-4 transition-colors duration-300">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-500 dark:text-white/70" />
        <p className="text-[12px] font-medium text-zinc-500 dark:text-white/50 tracking-wider uppercase">
          Resuming Workspace...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-900 dark:text-white pt-28 pb-16 max-w-[1600px] mx-auto px-6 lg:px-10 select-none transition-colors duration-300">
      {/* Title & Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-center gap-2 text-zinc-500 dark:text-white/50 text-[11px] font-bold tracking-widest uppercase mb-1.5">
          <Clock className="w-4 h-4 text-red-500 animate-pulse" />
          <span>Continue Watching</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-[1.05]">
          Watching
        </h1>
        <p className="mt-3 text-zinc-500 dark:text-white/40 max-w-xl text-[14px] leading-relaxed">
          Pick up right where you left off. Browse your active viewing history with precise progress indicators.
        </p>
      </div>

      {/* Grid container */}
      <div className="transition-all duration-500">
        {items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {items.map((item, index) => {
              const type = item.mediaType || 'movie';
              const progress = item.progress || 0;
              const duration = item.duration || 1;
              const percent = Math.min(100, Math.max(0, (progress / duration) * 100));
              const poster = IMG.poster(item.posterPath || item.poster_path);
              const uniqueId = `${type}_${item.id}`;
              const isDropdownOpen = activeDropdown === uniqueId;
              
              return (
                <div
                  key={`${type}_${item.id}`}
                  className="animate-fade-in relative"
                  style={{ animationDelay: `${(index % 12) * 50}ms` }}
                >
                  <div className="group/card block transition-all duration-300 hover:scale-105">
                    {/* Poster Area */}
                    <div className="relative">
                       <Link
                        href={`/${type}/${item.id}?play=1${type === 'tv' && item.season && item.episode ? `&season=${item.season}&episode=${item.episode}` : ''}`}
                        className="block"
                      >
                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-black/5 border border-black/5 dark:bg-white/5 dark:border-white/10 group-hover/card:border-black/10 dark:group-hover/card:border-white/20 shadow-lg transition-all duration-300">
                          {poster ? (
                            <img
                              src={poster}
                              alt={item.title}
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
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

                          {/* TV Season Episode Badge */}
                          {type === 'tv' && item.season && item.episode && (
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-bold text-white/95">
                              S{item.season} E{item.episode}
                            </div>
                          )}

                          {/* Progress Bar along bottom edge */}
                          <div className="absolute bottom-0 inset-x-0 h-[4px] bg-white/20">
                            <div
                              className="h-full bg-red-600 transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </Link>

                      {/* Three-dots Menu Trigger Button is removed from poster overlay */}
                    </div>

                    {/* Title Area & Actions */}
                    <div className="flex justify-between items-start gap-2 w-full mt-2.5 px-0.5">
                      <Link
                        href={`/${type}/${item.id}?play=1${type === 'tv' && item.season && item.episode ? `&season=${item.season}&episode=${item.episode}` : ''}`}
                        className="block min-w-0 flex-1"
                      >
                        <p className="text-[13px] font-medium text-zinc-900 dark:text-white/90 truncate leading-tight transition-colors duration-300">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-white/40 mt-1 font-medium transition-colors duration-300">
                          {type === 'tv' ? 'Series' : 'Movie'}
                          {duration > 0 && progress > 0 && (
                            <span> · {Math.round((duration - progress) / 60)}m left</span>
                          )}
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

                        {/* Dropdown Menu Overlay */}
                        {isDropdownOpen && (
                          <div 
                            className="absolute bottom-full right-0 mb-1.5 w-44 bg-white/95 dark:bg-zinc-950/95 border border-black/5 dark:border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl z-40 flex flex-col scale-100 origin-bottom-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => handleRemoveWatching(e, item)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] font-semibold text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition duration-200"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                              Remove from watching
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 bg-zinc-900/10 dark:bg-zinc-900/10 border border-black/5 dark:border-white/5 rounded-3xl backdrop-blur-md px-6 transition-colors duration-300">
            <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center border border-black/10 dark:border-white/10 shadow-inner">
              <Play className="w-6 h-6 text-zinc-400 dark:text-white/20 fill-black/5 dark:fill-white/5" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900 dark:text-white">No viewing history</p>
              <p className="text-[12px] text-zinc-500 dark:text-white/40 mt-1 max-w-xs mx-auto">
                Any movies or TV shows you start playing will appear here so you can easily resume them later.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
