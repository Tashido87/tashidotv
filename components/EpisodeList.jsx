'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChevronDown, MoreHorizontal, Check, Eye, EyeOff, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTVSeasonDetails, IMG } from '@/lib/tmdb';
import StreamPlayer from './StreamPlayer';

export default function EpisodeList({
  tvId,
  seasons = [],
  tvShowName,
  tvShowPoster,
  tvShowBackdrop,
  searchParams
}) {
  const validSeasons = seasons.filter((s) => s.season_number !== undefined);
  const defaultSeason = validSeasons.find((s) => s.season_number === 1) || validSeasons[0];

  const scroller = useRef(null);
  const scroll = (dir) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.85), behavior: 'smooth' });
  };

  // Deep-linking support: active season defaults to parameter if present
  const [activeSeason, setActiveSeason] = useState(() => {
    if (searchParams?.season) {
      const num = Number(searchParams.season);
      if (validSeasons.some((s) => s.season_number === num)) {
        return num;
      }
    }
    return defaultSeason ? defaultSeason.season_number : 1;
  });

  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Watched state & UI states
  const [watchedEpisodes, setWatchedEpisodes] = useState({});
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tashidotv_watched_episodes');
      if (saved) {
        setWatchedEpisodes(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading watched state:', e);
    }
  }, []);

  // Close options dropdown on clicking outside
  useEffect(() => {
    const handleClose = () => setOpenDropdownId(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadEpisodes() {
      setLoading(true);
      try {
        const details = await getTVSeasonDetails(tvId, activeSeason);
        if (active && details && details.episodes) {
          setEpisodes(details.episodes);
        }
      } catch (err) {
        console.error('Error loading episodes:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadEpisodes();
    return () => {
      active = false;
    };
  }, [tvId, activeSeason]);

  const toggleWatched = (episodeNumber) => {
    const key = `tv_${tvId}_s${activeSeason}_e${episodeNumber}`;
    const updated = { ...watchedEpisodes, [key]: !watchedEpisodes[key] };
    setWatchedEpisodes(updated);
    try {
      localStorage.setItem('tashidotv_watched_episodes', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setOpenDropdownId(null);
  };

  const copyEpisodeLink = (episodeNumber) => {
    const link = `${window.location.origin}/tv/${tvId}?season=${activeSeason}&episode=${episodeNumber}&play=1`;
    try {
      navigator.clipboard.writeText(link);
      setToastMessage(`Episode ${episodeNumber} link copied!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch (e) {
      console.error(e);
    }
    setOpenDropdownId(null);
  };

  if (validSeasons.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-6 lg:px-10 py-8 border-t border-white/5 relative group/row">
      {/* Season Selector & Scroll Buttons Wrapper */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative inline-flex items-center">
          <select
            value={activeSeason}
            onChange={(e) => setActiveSeason(Number(e.target.value))}
            className="appearance-none bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 pr-10 rounded-xl text-sm md:text-base font-semibold text-white focus:outline-none transition cursor-pointer select-none backdrop-blur-md"
          >
            {validSeasons.map((s) => (
              <option key={s.id} value={s.season_number} className="bg-zinc-900 text-white py-2">
                {s.name || `Season ${s.season_number}`}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 text-white/60">
            <ChevronDown className="w-4 h-4" />
          </span>
        </div>

        {/* Scroll Arrows on hover for Desktop */}
        {!loading && episodes.length > 0 && (
          <div className="hidden md:flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition duration-300">
            <button
              onClick={() => scroll(-1)}
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition active:scale-95 cursor-pointer"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll(1)}
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition active:scale-95 cursor-pointer"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex gap-5 overflow-x-auto pb-6 scrollbar-hide">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-72 md:w-80 lg:w-96 aspect-[16/9] rounded-2xl bg-white/5 animate-pulse border border-white/5"
            />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <p className="text-white/40 text-sm">No episodes found for this season.</p>
      ) : (
        <div
          ref={scroller}
          className="flex overflow-x-auto overflow-y-hidden py-4 gap-5 pb-6 scrollbar-hide mask-fade-r w-full scroll-smooth transform-gpu will-change-scroll overscroll-x-contain touch-pan-x"
        >
          {episodes.map((ep) => {
            const isWatched = watchedEpisodes[`tv_${tvId}_s${activeSeason}_e${ep.episode_number}`];
            const isDeepLinkPlay = searchParams?.season === String(activeSeason) && searchParams?.episode === String(ep.episode_number);

            return (
              <StreamPlayer
                key={ep.id}
                id={tvId}
                mediaType="tv"
                season={activeSeason}
                episode={ep.episode_number}
                title={tvShowName}
                posterPath={tvShowPoster}
                backdropPath={tvShowBackdrop}
                className="cursor-pointer group shrink-0 w-72 md:w-80 lg:w-96"
                autoOpen={isDeepLinkPlay}
              >
                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-zinc-800 contain-content border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:border-white/20 hover:shadow-2xl">
                  {/* Still photo */}
                  {ep.still_path ? (
                    <Image
                      src={IMG.backdrop(ep.still_path)}
                      alt={ep.name}
                      fill
                      sizes="(max-width: 768px) 300px, 400px"
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 bg-white/5 text-xs font-semibold">
                      No Preview Available
                    </div>
                  )}

                  {/* Watched Status Badge */}
                  {isWatched && (
                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-green-500/80 text-[9px] font-bold tracking-wider text-white uppercase backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.5)] flex items-center gap-1">
                      <Check className="w-3 h-3 text-white" /> Watched
                    </div>
                  )}

                  {/* Linear dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/10" />

                  {/* Episode Details Container */}
                  <div className="absolute bottom-0 inset-x-0 p-4 flex flex-col justify-end">
                    <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase mb-0.5">
                      EPISODE {ep.episode_number}
                    </span>
                    <h3 className="text-sm md:text-base font-bold text-white mb-1 group-hover:text-white/90 line-clamp-1 leading-tight">
                      {ep.name}
                    </h3>
                    {ep.overview && (
                      <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed mb-3 font-normal">
                        {ep.overview}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-white/40 font-semibold mt-auto relative">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[12px]">⟳</span> {ep.runtime ? `${ep.runtime}m` : '40m'}
                      </span>
                      
                      {/* Dropdown Options Button */}
                      <div className="relative">
                        <button
                          className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition relative z-20 active:scale-95"
                          aria-label="Options"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(openDropdownId === ep.id ? null : ep.id);
                          }}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>

                        {openDropdownId === ep.id && (
                          <div
                            className="absolute bottom-7 right-0 w-44 bg-zinc-950/95 border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl z-30 flex flex-col scale-100 origin-bottom-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => toggleWatched(ep.episode_number)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] font-semibold text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition"
                            >
                              {isWatched ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5 text-white/60" />
                                  Mark as Unwatched
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-white/60" />
                                  Mark as Watched
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => copyEpisodeLink(ep.episode_number)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] font-semibold text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition"
                            >
                              <Share2 className="w-3.5 h-3.5 text-white/60" />
                              Copy Episode Link
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </StreamPlayer>
            );
          })}
        </div>
      )}

      {/* Floating Glassmorphic Toast Alert */}
      <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-zinc-950/80 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-full text-xs md:text-sm font-semibold text-white shadow-2xl transition-all duration-300 pointer-events-none ${
        showToast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
      }`}>
        <Check className="w-4 h-4 text-green-400" />
        {toastMessage}
      </div>
    </section>
  );
}
