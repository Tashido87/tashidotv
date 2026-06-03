'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Play, Plus, Check, Info } from 'lucide-react';
import { IMG } from '@/lib/tmdb';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function Hero({ items = [] }) {
  const { user } = useAuth();
  const [index, setIndex] = useState(0);
  const [watchlistState, setWatchlistState] = useState({});
  const [isHovered, setIsHovered] = useState(false);

  const slides = items.slice(0, 10);

  // Sync Watchlist for Hero items
  useEffect(() => {
    if (slides.length === 0) return;

    const syncWatchlist = async () => {
      let localList = [];
      try {
        const stored = localStorage.getItem('tashidotv_watchlist');
        if (stored) {
          localList = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Local storage sync error:", e);
      }

      let firestoreLiked = [];
      if (user?.uid) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            firestoreLiked = docSnap.data().liked_movies || [];
          }
        } catch (e) {
          console.warn("Firestore error in Hero watchlist sync:", e);
        }
      }

      const updatedState = {};
      slides.forEach(item => {
        const type = item.media_type || (item.title ? 'movie' : 'tv');
        const inLocal = localList.some(i => String(i.id) === String(item.id) && i.mediaType === type);
        const inFirestore = firestoreLiked.some(id => String(id) === String(item.id));
        updatedState[item.id] = inLocal || inFirestore;
      });
      setWatchlistState(updatedState);
    };

    syncWatchlist();

    window.addEventListener('tashidotv_update', syncWatchlist);
    window.addEventListener('storage', syncWatchlist);
    return () => {
      window.removeEventListener('tashidotv_update', syncWatchlist);
      window.removeEventListener('storage', syncWatchlist);
    };
  }, [slides, user?.uid]);

  // Autoplay functionality with pause-on-hover
  useEffect(() => {
    if (slides.length === 0 || isHovered) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 8000);
    return () => clearInterval(t);
  }, [slides.length, isHovered]);

  if (slides.length === 0) return null;

  // Toggle watchlist logic
  const toggleWatchlist = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();

    const type = item.media_type || (item.title ? 'movie' : 'tv');
    try {
      const listData = localStorage.getItem('tashidotv_watchlist');
      let list = listData ? JSON.parse(listData) : [];
      const itemId = item.id;
      const exists = list.some((i) => String(i.id) === String(itemId) && i.mediaType === type);

      if (exists) {
        list = list.filter((i) => !(String(i.id) === String(itemId) && i.mediaType === type));
      } else {
        list.push({
          id: itemId,
          mediaType: type,
          title: item.title || item.name,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          vote_average: item.vote_average,
          release_date: item.release_date || item.first_air_date,
          addedAt: Date.now()
        });
      }
      localStorage.setItem('tashidotv_watchlist', JSON.stringify(list));

      if (user && user.uid) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        let currentLiked = [];
        
        if (userSnap.exists()) {
          currentLiked = userSnap.data().liked_movies || [];
        }

        let updatedLiked;
        if (exists) {
          updatedLiked = currentLiked.filter((id) => String(id) !== String(itemId));
        } else {
          const cleanId = String(itemId);
          if (!currentLiked.some((id) => String(id) === cleanId)) {
            updatedLiked = [...currentLiked, cleanId];
          } else {
            updatedLiked = currentLiked;
          }
        }

        await setDoc(userRef, { liked_movies: updatedLiked }, { merge: true });
      }

      setWatchlistState(prev => ({ ...prev, [item.id]: !exists }));
      window.dispatchEvent(new Event('tashidotv_update'));
    } catch (err) {
      console.error('Error toggling watchlist in Hero:', err);
    }
  };

  return (
    <section
      className="relative w-full h-[324px] sm:h-[396px] md:h-[648px] lg:h-[720px] overflow-hidden select-none border-b border-white/5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Full-bleed background images — edge to edge, no framing */}
      {slides.map((item, i) => {
        const bg = IMG.backdrop(item.backdrop_path || item.poster_path);
        const active = i === index;
        if (!bg) return null;
        return (
          <div
            key={`bg-${item.id}`}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              active ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={bg}
              alt=""
              className={`w-full h-full object-cover origin-center transition-transform ${
                active 
                  ? 'duration-20000 ease-out scale-[1.15]' 
                  : 'duration-1000 ease-in-out scale-100'
              }`}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          </div>
        );
      })}

      {/* Gradient overlays for cinematic blending */}
      {/* Strong bottom gradient to blend into dark rows */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent pointer-events-none z-10" />
      {/* Top gradient for navbar readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-transparent to-transparent pointer-events-none z-10" />
      {/* Side gradients */}
      <div className="absolute inset-y-0 left-0 w-12 md:w-24 lg:w-40 bg-gradient-to-r from-zinc-950 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-y-0 right-0 w-12 md:w-24 lg:w-40 bg-gradient-to-l from-zinc-950 to-transparent pointer-events-none z-10" />

      {/* Content overlay — bottom-left aligned */}
      <div className="absolute inset-0 z-20 flex items-end">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 pb-6 sm:pb-8 md:pb-12">
          {slides.map((item, i) => {
            const active = i === index;
            const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
            const title = item.title || item.name;
            const inList = watchlistState[item.id] || false;

            return (
              <div
                key={item.id}
                className={`transition-all duration-700 ease-in-out ${
                  active
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 translate-y-3 pointer-events-none absolute'
                }`}
              >
                {/* Meta tag */}
                <p className="text-[9px] sm:text-[10px] md:text-[11px] font-bold tracking-[0.25em] sm:tracking-[0.3em] text-white/60 uppercase mb-1 sm:mb-2 md:mb-3">
                  {mediaType === 'tv' ? 'Series' : 'Featured Film'}
                </p>

                {/* Title — crisp solid white */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1] drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-lg sm:max-w-xl md:max-w-2xl">
                  {title}
                </h1>

                {/* Overview — hidden on smallest screens, clamped */}
                <p className="hidden sm:block text-[12px] sm:text-[13px] md:text-[14px] text-white/80 line-clamp-2 max-w-md sm:max-w-lg md:max-w-xl leading-relaxed mt-1.5 sm:mt-2 md:mt-3 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                  {item.overview}
                </p>

                {/* Buttons */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-4 md:mt-5">
                  <Link
                    href={`/${mediaType}/${item.id}?play=1`}
                    className="inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white text-zinc-950 hover:bg-white/90 font-semibold text-[12px] sm:text-[13px] md:text-[14px] px-5 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-full transition-all duration-300 shadow-[0_4px_14px_rgba(255,255,255,0.25)] hover:scale-[1.03]"
                  >
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                    Play
                  </Link>

                  <button
                    onClick={(e) => toggleWatchlist(e, item)}
                    className="inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/15 backdrop-blur-md font-semibold text-[12px] sm:text-[13px] md:text-[14px] px-5 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-full transition-all duration-300"
                  >
                    {inList ? <Check className="w-4 h-4 text-green-400" /> : <Plus className="w-4 h-4" />}
                    <span>My List</span>
                  </button>

                  <Link
                    href={`/${mediaType}/${item.id}`}
                    className="inline-flex items-center justify-center p-2 sm:p-2.5 md:p-3 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-md transition-all duration-300"
                    title="More Info"
                  >
                    <Info className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vertical Carousel Pagination — per-item elastic morphing */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col items-end gap-3">
        {slides.map((item, i) => {
          const active = i === index;
          const numStr = String(i + 1).padStart(2, '0');
          const title = item.title || item.name;

          return (
            <button
              key={`nav-${item.id}`}
              onClick={() => setIndex(i)}
              className="flex items-center justify-end focus:outline-none select-none group/nav"
              aria-label={`Go to slide ${title}`}
            >
              {/* Index number — fades in beside the active bar, collapses when inactive */}
              <span
                className={`font-mono text-sm font-bold tracking-wider text-orange-500 mr-2.5 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] whitespace-nowrap overflow-hidden ${
                  active
                    ? 'opacity-100 max-w-[2rem]'
                    : 'opacity-0 max-w-0'
                }`}
              >
                {numStr}
              </span>

              {/* Morphing bar — stretches to w-12 orange when active, shrinks to w-4 gray when inactive */}
              <div
                className={`h-2 rounded-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  active
                    ? 'w-12 bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.5)]'
                    : 'w-4 bg-white/20 group-hover/nav:bg-white/40 group-hover/nav:w-5'
                }`}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
