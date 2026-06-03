'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Clock, Calendar, Plus, Share2, ChevronRight, Check, Play, X } from 'lucide-react';
import { IMG } from '@/lib/tmdb';
import StreamPlayer from './StreamPlayer';
import ContentRow from './ContentRow';
import EpisodeList from './EpisodeList';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import BackButton from './BackButton';

function formatRuntime(min) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function DetailView({ data, mediaType, autoPlay = false, searchParams, similarItems }) {
  const { user } = useAuth();
  const title = data.title || data.name;
  const release = data.release_date || data.first_air_date;
  const year = release ? release.slice(0, 4) : '';
  const runtime = data.runtime || (data.episode_run_time && data.episode_run_time[0]);
  const cast = data.credits?.cast?.slice(0, 12) || [];
  const similar = similarItems || data.similar?.results || [];
  const backdrop = IMG.original(data.backdrop_path);
  const poster = IMG.poster(data.poster_path);

  const [inWatchlist, setInWatchlist] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showTrailer, setShowTrailer] = useState(false);

  const trailerKey = (() => {
    const list = data.videos?.results || [];
    const ytVideos = list.filter((v) => v.site === 'YouTube');

    // 1. Highest priority: YouTube, type 'Trailer', official, name contains "official trailer" (case-insensitive)
    let best = ytVideos.find(
      (v) =>
        v.type === 'Trailer' &&
        v.official &&
        v.name?.toLowerCase().includes('official trailer')
    );
    if (best) return best.key;

    // 2. Second priority: YouTube, type 'Trailer', official (any name)
    best = ytVideos.find((v) => v.type === 'Trailer' && v.official);
    if (best) return best.key;

    // 3. Third priority: YouTube, type 'Trailer', not marked official but contains "trailer" in name
    best = ytVideos.find(
      (v) =>
        v.type === 'Trailer' &&
        v.name?.toLowerCase().includes('trailer') &&
        !v.name?.toLowerCase().includes('teaser') &&
        !v.name?.toLowerCase().includes('spot')
    );
    if (best) return best.key;

    // 4. Fourth priority: YouTube, type 'Trailer' (any trailer)
    best = ytVideos.find((v) => v.type === 'Trailer');
    if (best) return best.key;

    // 5. Fifth priority: YouTube, official, any video that isn't behind-the-scenes/featurette
    best = ytVideos.find(
      (v) =>
        v.official &&
        v.type !== 'Behind the Scenes' &&
        v.type !== 'Featurette' &&
        !v.name?.toLowerCase().includes('teaser') &&
        !v.name?.toLowerCase().includes('spot')
    );
    if (best) return best.key;

    // 6. Final fallback: Any non-behind-the-scenes clip
    best = ytVideos.find(
      (v) =>
        v.type !== 'Behind the Scenes' &&
        v.type !== 'Featurette'
    );
    return best?.key || ytVideos[0]?.key;
  })();

  useEffect(() => {
    if (showTrailer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showTrailer]);

  const handleShare = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setToastMessage('Link copied to clipboard!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  useEffect(() => {
    const checkWatchlist = async () => {
      let isLocalBookmarked = false;
      try {
        const listData = localStorage.getItem('tashidotv_watchlist');
        if (listData) {
          const list = JSON.parse(listData);
          isLocalBookmarked = list.some((item) => String(item.id) === String(data.id) && item.mediaType === mediaType);
        }
      } catch (err) {
        console.error('Error reading watchlist from localStorage:', err);
      }

      if (user && user.uid) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const likedMovies = userSnap.data().liked_movies || [];
            const isFirestoreBookmarked = likedMovies.some((itemId) => String(itemId) === String(data.id));
            
            setInWatchlist(isFirestoreBookmarked || isLocalBookmarked);
            return;
          }
        } catch (err) {
          console.warn('Error reading from Firestore, falling back to local storage:', err);
        }
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
  }, [data.id, mediaType, user?.uid]);

  const toggleWatchlist = async () => {
    try {
      const listData = localStorage.getItem('tashidotv_watchlist');
      let list = listData ? JSON.parse(listData) : [];
      const itemId = data.id;
      const exists = list.some((item) => String(item.id) === String(itemId) && item.mediaType === mediaType);

      if (exists) {
        // Remove locally
        list = list.filter((item) => !(String(item.id) === String(itemId) && item.mediaType === mediaType));
        setInWatchlist(false);
        setToastMessage('Removed from My List');
      } else {
        // Add locally
        list.push({
          id: itemId,
          mediaType,
          title: data.title || data.name,
          poster_path: data.poster_path,
          backdrop_path: data.backdrop_path,
          vote_average: data.vote_average,
          release_date: data.release_date || data.first_air_date,
          addedAt: Date.now()
        });
        setInWatchlist(true);
        setToastMessage('Added to My List');
      }
      localStorage.setItem('tashidotv_watchlist', JSON.stringify(list));

      // Synchronize with Firestore if authenticated
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

      // Show sleek glassmorphic toast
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);

      // Dispatch sync event
      window.dispatchEvent(new Event('tashidotv_update'));
    } catch (err) {
      console.error('Error toggling watchlist:', err);
    }
  };

  return (
    <article>
      {/* Backdrop hero */}
      <section className="relative w-full h-[65vh] min-h-[450px] overflow-hidden">
        <BackButton />
        {backdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

        <div className="relative z-10 h-full max-w-[1600px] mx-auto px-6 lg:px-10 flex items-end pb-16">
          <div className="flex flex-col md:flex-row gap-8 w-full">
            {poster && (
              <div className="hidden md:block relative w-56 aspect-[2/3] rounded-2xl shadow-2xl overflow-hidden bg-zinc-800 contain-content shrink-0">
                <Image
                  src={poster}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 150px, 250px"
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1 max-w-3xl space-y-5">
              {data.tagline && (
                <p className="text-[12px] font-semibold tracking-[0.25em] text-white/60 uppercase">
                  {data.tagline}
                </p>
              )}
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-platinum leading-[1.05]">
                {title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/70">
                {data.vote_average ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {data.vote_average.toFixed(1)}
                  </span>
                ) : null}
                {year && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> {year}
                  </span>
                )}
                {runtime && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> {formatRuntime(runtime)}
                  </span>
                )}
                {data.genres?.slice(0, 3).map((g) => (
                  <span key={g.id} className="px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-medium">
                    {g.name}
                  </span>
                ))}
              </div>

              <p className="text-[15px] text-white/80 leading-relaxed max-w-2xl line-clamp-4">
                {data.overview}
              </p>

              <div className="flex items-center gap-3 pt-3">
                <StreamPlayer
                  id={data.id}
                  mediaType={mediaType}
                  autoOpen={autoPlay}
                  title={data.title || data.name}
                  posterPath={data.poster_path}
                  backdropPath={data.backdrop_path}
                />
                <button
                  onClick={toggleWatchlist}
                  className={`inline-flex items-center gap-2 font-semibold text-[14px] px-6 py-3 rounded-full border transition duration-300 backdrop-blur-md ${
                    inWatchlist
                      ? 'bg-white text-black border-white hover:bg-white/90'
                      : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                  }`}
                >
                  {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  My List
                </button>
                {trailerKey && (
                  <button
                    onClick={() => setShowTrailer(true)}
                    className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 font-semibold text-[14px] px-6 py-3 rounded-full transition duration-300 backdrop-blur-md active:scale-95"
                  >
                    <Play className="w-4 h-4 text-white fill-white" />
                    Watch Trailer
                  </button>
                )}
                <button
                  onClick={handleShare}
                  className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/15 hover:bg-white/20 transition active:scale-95"
                  aria-label="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Glassmorphic Toast Alert */}
      <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-zinc-950/80 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-full text-xs md:text-sm font-semibold text-white shadow-2xl transition-all duration-300 pointer-events-none ${
        showToast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'
      }`}>
        <Check className="w-4 h-4 text-green-400" />
        {toastMessage}
      </div>

      {/* Cast & Crew */}
      {cast.length > 0 && (
        <section id="cast-section" className="max-w-[1600px] mx-auto px-6 lg:px-10 py-12 border-t border-white/5 scroll-mt-20">
          <h2
            onClick={() => document.getElementById('cast-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="group text-xl md:text-2xl font-semibold tracking-tight mb-6 cursor-pointer hover:text-zinc-600 dark:hover:text-white/80 inline-flex items-center gap-1 select-none"
          >
            Cast & Crew <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-white/50 group-hover:text-zinc-900 dark:group-hover:text-white transition" />
          </h2>
          <div
            className="flex overflow-x-auto overflow-y-hidden py-4 gap-6 scrollbar-hide pb-6 mask-fade-r w-full transform-gpu will-change-scroll overscroll-x-contain touch-pan-x scroll-smooth"
          >
            {cast.map((p) => (
              <Link
                key={p.cast_id || p.credit_id || p.id}
                href={`/person/${p.id}`}
                className="flex flex-col items-center text-center shrink-0 w-24 md:w-32 group select-none cursor-pointer"
              >
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-zinc-800 contain-content mb-3 border border-black/10 dark:border-white/10 shrink-0 relative transition-transform duration-300 group-hover:scale-105 group-hover:border-black/30 dark:group-hover:border-white/30">
                  {p.profile_path ? (
                    <Image
                      src={IMG.profile(p.profile_path)}
                      alt={p.name}
                      fill
                      sizes="100px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl md:text-2xl text-zinc-400 dark:text-white/30 font-bold bg-black/5 dark:bg-white/5">
                      {p.name?.[0]}
                    </div>
                  )}
                </div>
                <p className="text-[13px] font-semibold text-zinc-900 group-hover:text-zinc-950 dark:text-white/95 dark:group-hover:text-platinum transition duration-300 w-full truncate leading-tight mb-0.5">
                  {p.name}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 w-full truncate leading-normal">
                  {p.character}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {mediaType === 'tv' && data.seasons && (
        <EpisodeList
          tvId={data.id}
          seasons={data.seasons}
          tvShowName={data.name}
          tvShowPoster={data.poster_path}
          tvShowBackdrop={data.backdrop_path}
          searchParams={searchParams}
        />
      )}

      {/* Similar */}
      {similar.length > 0 && (
        <ContentRow title="More Like This" items={similar} mediaType={mediaType} />
      )}

      {/* Premium YouTube Trailer Modal */}
      {showTrailer && trailerKey && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 md:p-10 transition-all duration-300">
          <div className="relative w-full max-w-5xl aspect-[16/9] rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl shadow-black/80">
            {/* Close Button */}
            <button
              onClick={() => setShowTrailer(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition duration-200 active:scale-95"
              aria-label="Close Trailer"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&showinfo=0&controls=1`}
              title="Official Trailer"
              className="absolute top-0 left-0 w-full h-full border-0 object-contain max-h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </article>
  );
}
