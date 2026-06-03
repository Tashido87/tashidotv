'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { Star, MoreVertical } from 'lucide-react';
import { IMG } from '@/lib/tmdb';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function MediaCard({ item, mediaType = 'movie', variant = 'poster', isGrid = false }) {
  const { user } = useAuth();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const type = item.media_type || mediaType || 'movie';

  useEffect(() => {
    if (type === 'person') return;

    const checkWatchlist = () => {
      let isLocalBookmarked = false;
      try {
        const listData = localStorage.getItem('tashidotv_watchlist');
        if (listData) {
          const list = JSON.parse(listData);
          isLocalBookmarked = list.some((i) => String(i.id) === String(item.id) && i.mediaType === type);
        }
      } catch (err) {
        console.error('Error reading watchlist from localStorage:', err);
      }

      setInWatchlist(isLocalBookmarked);
    };

    checkWatchlist();

    window.addEventListener('tashidotv_update', checkWatchlist);
    window.addEventListener('storage', checkWatchlist);
    return () => {
      window.removeEventListener('tashidotv_update', checkWatchlist);
      window.removeEventListener('storage', checkWatchlist);
    };
  }, [item.id, type, user?.uid]);

  // Handle dropdown auto-close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (type === 'person') return null;

  const title = item.title || item.name;
  const isBackdrop = variant === 'backdrop';
  const img = isBackdrop
    ? IMG.backdrop(item.backdrop_path || item.poster_path)
    : IMG.poster(item.poster_path || item.backdrop_path);

  const widthClass = isGrid
    ? 'w-full'
    : isBackdrop
    ? 'w-[320px] md:w-[360px]'
    : 'w-[160px] md:w-[200px]';
  const aspect = isBackdrop ? 'aspect-video' : 'aspect-[2/3]';

  const toggleWatchlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdownOpen(false);

    try {
      const listData = localStorage.getItem('tashidotv_watchlist');
      let list = listData ? JSON.parse(listData) : [];
      const itemId = item.id;
      const exists = list.some((i) => String(i.id) === String(itemId) && i.mediaType === type);

      if (exists) {
        list = list.filter((i) => !(String(i.id) === String(itemId) && i.mediaType === type));
        setInWatchlist(false);
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
        setInWatchlist(true);
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

      window.dispatchEvent(new Event('tashidotv_update'));
    } catch (err) {
      console.error('Error toggling watchlist in MediaCard:', err);
    }
  };

  return (
    <Link
      href={`/${type}/${item.id}`}
      className={`group/card transition-all duration-300 hover:scale-105 ${
        isGrid ? 'w-full' : 'flex-shrink-0 ' + widthClass
      }`}
    >
      <div className={`relative ${aspect} rounded-2xl overflow-hidden bg-zinc-800 contain-content`}>
        {img ? (
          <Image
            src={img}
            alt={title}
            fill
            sizes="(max-width: 768px) 150px, (max-width: 1200px) 200px, 250px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">
            {title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition" />
        {item.vote_average ? (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-md text-[10px] font-semibold px-2 py-1 rounded-full text-white">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}
      </div>

      <div className="flex justify-between items-start gap-2 w-full mt-2.5 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white truncate transition-colors duration-300">
            {title}
          </p>
          <p className="text-[11px] text-white/40 mt-0.5 transition-colors duration-300 font-medium">
            {(item.release_date || item.first_air_date || '').slice(0, 4)}
            {item.original_language ? ` · ${item.original_language.toUpperCase()}` : ''}
          </p>
        </div>

        {/* Apple TV UI Three Dots Menu Button */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropdownOpen(!dropdownOpen);
            }}
            className="text-white/40 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5 active:scale-95"
            aria-label="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {dropdownOpen && (
            <div
              className="absolute bottom-full right-0 mb-1.5 w-44 bg-zinc-950/95 border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl z-40 flex flex-col scale-100 origin-bottom-right"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={toggleWatchlist}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] font-semibold text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition duration-200"
              >
                {inWatchlist ? 'Remove from My List' : 'Add to My List'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
