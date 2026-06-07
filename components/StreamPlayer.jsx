'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Play, ChevronDown, AlertTriangle, RotateCcw, Loader2, Bookmark, CheckCircle2 } from 'lucide-react';
import { getTVDetails, getTVSeasonDetails } from '@/lib/tmdb';
import { useAuth } from '@/components/AuthProvider';
import { getWatchProgress, setWatchProgress, deleteWatchProgress, getAllWatchHistory } from '@/lib/db';

// Time format helpers
function fmtTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function parseTime(str) {
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return parts[0] || 0;
}

const getLang2Letter = (code) => {
  const mapping = {
    eng: 'en',
    my: 'my',
    spa: 'es',
    fre: 'fr',
    ger: 'de',
  };
  return mapping[code] || code;
};

const SERVERS = {
  autoembed: {
    name: 'AutoEmbed (Primary)',
    supportsSubs: true,
    supportsStartTime: false,
    getUrl: (mediaType, id, season, episode, subLang = 'eng', startAt = 0) => {
      const lang2 = getLang2Letter(subLang);
      const sub = subLang && subLang !== 'off' ? `?sub_lang=${lang2}` : '';
      const uiParams = sub ? `&autohide=1` : `?autohide=1`;
      if (mediaType === 'tv') {
        return `https://autoembed.co/tv/tmdb/${id}-${season}-${episode}${sub}${uiParams}`;
      }
      return `https://autoembed.co/movie/tmdb/${id}${sub}${uiParams}`;
    }
  },
  vidlink: {
    name: 'VidLink',
    supportsSubs: true,
    supportsStartTime: true,
    getUrl: (mediaType, id, season, episode, subLang = 'eng', startAt = 0) => {
      const startParam = startAt > 5 ? `&startTime=${Math.floor(startAt)}` : '';
      const subParam = subLang && subLang !== 'off' ? `&subLang=${getLang2Letter(subLang)}&sub_lang=${getLang2Letter(subLang)}` : '';
      if (mediaType === 'tv') {
        return `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=ffffff&autoplay=false${startParam}${subParam}`;
      }
      return `https://vidlink.pro/movie/${id}?primaryColor=ffffff&autoplay=false${startParam}${subParam}`;
    }
  },
  vidsrc: {
    name: 'VidSrc',
    supportsSubs: false,
    supportsStartTime: false,
    getUrl: (mediaType, id, season, episode, subLang = 'eng', startAt = 0) => {
      if (mediaType === 'tv') {
        return `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
      }
      return `https://vidsrc.to/embed/movie/${id}`;
    }
  },
  embedsu: {
    name: 'Embed.su',
    supportsSubs: false,
    supportsStartTime: false,
    getUrl: (mediaType, id, season, episode, subLang = 'eng', startAt = 0) => {
      if (mediaType === 'tv') {
        return `https://embed.su/embed/tv/${id}/${season}/${episode}`;
      }
      return `https://embed.su/embed/movie/${id}`;
    }
  },
  superembed: {
    name: 'SuperEmbed',
    supportsSubs: false,
    supportsStartTime: false,
    getUrl: (mediaType, id, season, episode, subLang = 'eng', startAt = 0) => {
      if (mediaType === 'tv') {
        return `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`;
      }
      return `https://multiembed.mov/?video_id=${id}&tmdb=1`;
    }
  },
  smashy: {
    name: 'SmashyStream',
    supportsSubs: false,
    supportsStartTime: false,
    getUrl: (mediaType, id, season, episode, subLang = 'eng', startAt = 0) => {
      if (mediaType === 'tv') {
        return `https://player.smashy.stream/tv/${id}?s=${season}&e=${episode}`;
      }
      return `https://player.smashy.stream/movie/${id}`;
    }
  }
};

export default function StreamPlayer({
  id,
  mediaType = 'movie',
  autoOpen = false,
  season,
  episode,
  title,
  posterPath,
  backdropPath,
  children,
  className
}) {
  const [open, setOpen] = useState(false);
  const [activeServer, setActiveServer] = useState('autoembed');
  const [activeSeason, setActiveSeason] = useState(season || 1);
  const [activeEpisode, setActiveEpisode] = useState(episode || 1);
  const [tvDetails, setTvDetails] = useState(null);
  const [seasonDetails, setSeasonDetails] = useState(null);
  const [savedProgress, setSavedProgress] = useState(0);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [subLang, setSubLang] = useState('eng');
  const [manualTime, setManualTime] = useState('00:00:00');
  const [durationEstimate, setDurationEstimate] = useState(0);
  const [saveToast, setSaveToast] = useState(null);
  const hasAutoOpened = useRef(false);
  const { user } = useAuth();
  const hasFinishedRef = useRef(false);
  const lastSavedProgressTimeRef = useRef(0);
  const latestPlaybackTimeRef = useRef({ currentTime: 0, durationVal: 0 });

  // Reset hasFinishedRef and lastSavedProgressTimeRef when player is opened or dynamic parameters change
  useEffect(() => {
    hasFinishedRef.current = false;
    lastSavedProgressTimeRef.current = 0;
    latestPlaybackTimeRef.current = { currentTime: 0, durationVal: 0 };
  }, [open, id, activeSeason, activeEpisode]);

  // Immediate save on close / unmount
  useEffect(() => {
    return () => {
      const { currentTime, durationVal } = latestPlaybackTimeRef.current;
      if (currentTime > 0 && durationVal > 0) {
        if (Math.abs(currentTime - lastSavedProgressTimeRef.current) > 1) {
          const isFinished = durationVal > 0 && (currentTime > durationVal - 60 || currentTime > durationVal * 0.95);
          if (isFinished) {
            deleteWatchProgress(user?.uid || null, mediaType, id, activeSeason, activeEpisode).then(() => {
              window.dispatchEvent(new CustomEvent('tashidotv_update', { detail: { action: 'delete', mediaType, id } }));
            }).catch(err => console.warn('Unmount delete progress failed:', err));
          } else {
            setWatchProgress(user?.uid || null, {
              mediaType,
              id,
              title: title || (mediaType === 'tv' ? tvDetails?.name : ''),
              posterPath,
              backdropPath,
              progress: currentTime,
              duration: durationVal,
              season: activeSeason,
              episode: activeEpisode
            }).then(() => {
              window.dispatchEvent(new Event('tashidotv_update'));
            }).catch(err => console.warn('Unmount watch progress save failed:', err));
          }
        }
      }
    };
  }, [open, id, mediaType, activeSeason, activeEpisode, user, title, posterPath, backdropPath, tvDetails]);

  // Load TV show most recent season and episode if not explicitly passed
  useEffect(() => {
    if (mediaType === 'tv' && !season) {
      let cancelled = false;
      async function determineAutoResume() {
        try {
          // 1. Get localStorage history
          let localItems = [];
          try {
            const progressData = localStorage.getItem('tashidotv_progress');
            if (progressData) {
              localItems = Object.values(JSON.parse(progressData));
            }
          } catch (e) {}

          // 2. Get Firestore history if user is logged in
          let firestoreItems = [];
          if (user?.uid) {
            try {
              firestoreItems = await getAllWatchHistory(user.uid);
            } catch (err) {
              console.error('Error fetching Firestore history in StreamPlayer:', err);
            }
          }

          if (cancelled) return;

          // 3. Combine and filter by TV show ID and mediaType
          const allItems = [...localItems, ...firestoreItems]
            .filter((item) => String(item.id) === String(id) && item.mediaType === 'tv');

          // 4. Sort by updatedAt descending
          allItems.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

          if (allItems.length > 0) {
            const latest = allItems[0];
            if (latest.season) setActiveSeason(latest.season);
            if (latest.episode) setActiveEpisode(latest.episode);
          }
        } catch (err) {
          console.error('Error determining auto-resume:', err);
        }
      }
      determineAutoResume();
      return () => { cancelled = true; };
    }
  }, [id, mediaType, season, user]);

  // Fetch saved progress from Firestore (or localStorage) when player opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadProgress() {
      try {
        const entry = await getWatchProgress(user?.uid || null, mediaType, id, activeSeason, activeEpisode);
        if (cancelled) return;

        if (entry) {
          const dur = entry.duration || 0;
          const prog = entry.progress || 0;
          setDurationEstimate(dur);

          // Heuristic: If they finished >95% or within 60s of end, start from 0
          const isFinished = dur > 0 && (prog > dur - 60 || prog > dur * 0.95);
          const resumeTime = isFinished ? 0 : prog;

          if (mediaType === 'tv') {
            if (entry.season === activeSeason && entry.episode === activeEpisode) {
              setSavedProgress(resumeTime);
              setManualTime(fmtTime(resumeTime));
            } else {
              setSavedProgress(0);
              setManualTime('00:00:00');
            }
          } else {
            setSavedProgress(resumeTime);
            setManualTime(fmtTime(resumeTime));
          }
        } else {
          setSavedProgress(0);
          setManualTime('00:00:00');
        }

        // Initialize a 0-progress entry so it shows up in Continue Watching immediately, 
        // even if the server (like AutoEmbed) doesn't emit time updates.
        // We do this by calling setWatchProgress with current values.
        if (cancelled) return;
        
        // Let's only do this if it's the very first time opening (not already existing)
        if (!entry) {
          setWatchProgress(user?.uid || null, {
            mediaType,
            id,
            title: title || (mediaType === 'tv' ? tvDetails?.name : document.title.replace(' — Tashido TV', '')),
            posterPath,
            backdropPath,
            progress: 0,
            duration: 0,
            season: activeSeason,
            episode: activeEpisode
          }).then(() => {
            window.dispatchEvent(new Event('tashidotv_update'));
          }).catch(() => {});
        }

      } catch (err) {
        console.error('Error loading saved progress:', err);
      }
    }

    loadProgress();
    return () => { cancelled = true; };
  }, [open, id, mediaType, activeSeason, activeEpisode, user, title, tvDetails, posterPath, backdropPath]);

  const saveProgress = useCallback(async (currentTime, durationVal) => {
    try {
      const isFinished = durationVal > 0 && (currentTime > durationVal - 60 || currentTime > durationVal * 0.95);

      if (isFinished) {
        if (hasFinishedRef.current) return;
        hasFinishedRef.current = true;

        await deleteWatchProgress(user?.uid || null, mediaType, id, activeSeason, activeEpisode);
        window.dispatchEvent(new Event('tashidotv_update'));
      } else {
        // Throttling to 60 seconds to prevent runaway Firebase writes
        if (Math.abs(currentTime - lastSavedProgressTimeRef.current) < 60) return;
        lastSavedProgressTimeRef.current = currentTime;

        if (hasFinishedRef.current) hasFinishedRef.current = false;

        await setWatchProgress(user?.uid || null, {
          mediaType,
          id,
          title: title || (mediaType === 'tv' ? tvDetails?.name : document.title.replace(' — Tashido TV', '')),
          posterPath,
          backdropPath,
          progress: currentTime,
          duration: durationVal,
          season: activeSeason,
          episode: activeEpisode
        });
      }
    } catch (err) {
      console.error('Error saving progress:', err);
    }
  }, [id, mediaType, title, posterPath, backdropPath, tvDetails, activeSeason, activeEpisode, user]);

  // Manual save handlers for the custom UI
  const handleManualSave = async () => {
    const seconds = parseTime(manualTime);
    if (seconds < 0) return;

    const dur = durationEstimate > 0 ? durationEstimate : seconds + 3600; // fallback estimate
    await setWatchProgress(user?.uid || null, {
      mediaType,
      id,
      title: title || (mediaType === 'tv' ? tvDetails?.name : ''),
      posterPath,
      backdropPath,
      progress: seconds,
      duration: dur,
      season: activeSeason,
      episode: activeEpisode
    });
    setSavedProgress(seconds);
    setSaveToast({ message: `Saved at ${fmtTime(seconds)}`, type: 'success' });
    setTimeout(() => setSaveToast(null), 2500);
    window.dispatchEvent(new Event('tashidotv_update'));
  };

  const handleMarkWatched = async () => {
    await deleteWatchProgress(user?.uid || null, mediaType, id, activeSeason, activeEpisode);
    setSavedProgress(0);
    setManualTime('00:00:00');
    setSaveToast({ message: 'Marked as watched', type: 'success' });
    setTimeout(() => setSaveToast(null), 2500);
    window.dispatchEvent(new Event('tashidotv_update'));
  };

  const handlePlayClick = useCallback(() => {
    setOpen(true);
  }, []);

  useEffect(() => {
    if (mediaType !== 'tv' || !open) return;
    async function fetchTV() {
      try {
        const data = await getTVDetails(id);
        if (data) {
          setTvDetails(data);
        }
      } catch (err) {
        console.error('Error fetching TV details in player:', err);
      }
    }
    fetchTV();
  }, [id, mediaType, open]);

  useEffect(() => {
    if (mediaType !== 'tv' || !open) return;
    async function fetchSeason() {
      try {
        const data = await getTVSeasonDetails(id, activeSeason);
        if (data) {
          setSeasonDetails(data);
        }
      } catch (err) {
        console.error('Error fetching season details in player:', err);
      }
    }
    fetchSeason();
  }, [id, mediaType, activeSeason, open]);

  const seasonsList = tvDetails?.seasons
    ? tvDetails.seasons
        .filter((s) => s.season_number > 0)
        .map((s) => s.season_number)
    : [...Array(Math.max(12, activeSeason)).keys()].map((i) => i + 1);

  const episodesList = seasonDetails?.episodes
    ? seasonDetails.episodes.map((e) => e.episode_number)
    : [...Array(Math.max(30, activeEpisode)).keys()].map((i) => i + 1);

  useEffect(() => {
    if (autoOpen && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      handlePlayClick();
    }
  }, [autoOpen, handlePlayClick]);

  useEffect(() => {
    if (season) setActiveSeason(season);
    if (episode) setActiveEpisode(episode);
  }, [season, episode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePlayerMessage = (event) => {
      // Allow any valid origin to emit PLAYER_EVENT
      if (event.data?.type === 'PLAYER_EVENT') {
        const { event: eventType, currentTime, duration: durationVal } = event.data.data;
        if (currentTime && durationVal) {
          latestPlaybackTimeRef.current = { currentTime, durationVal };
        }
        if (eventType === 'timeupdate' && currentTime && durationVal) {
          saveProgress(currentTime, durationVal);
        } else if (eventType === 'pause' && currentTime && durationVal) {
          setWatchProgress(user?.uid || null, {
            mediaType,
            id,
            title: title || (mediaType === 'tv' ? tvDetails?.name : document.title.replace(' — Tashido TV', '')),
            posterPath,
            backdropPath,
            progress: currentTime,
            duration: durationVal,
            season: activeSeason,
            episode: activeEpisode
          }).then(() => {
            window.dispatchEvent(new Event('tashidotv_update'));
          }).catch(err => console.warn('Sync on pause failed:', err));
        }
      }
    };

    window.addEventListener('message', handlePlayerMessage);
    return () => window.removeEventListener('message', handlePlayerMessage);
  }, [open, saveProgress, user, mediaType, id, title, tvDetails, posterPath, backdropPath, activeSeason, activeEpisode]);

  // Track iframe load status with timeout-based error detection
  useEffect(() => {
    if (!open) {
      setLoadStatus('idle');
      return;
    }
    setLoadStatus('loading');

    const slowTimer = setTimeout(() => {
      setLoadStatus((s) => (s === 'loading' ? 'slow' : s));
    }, 5000);

    const errorTimer = setTimeout(() => {
      setLoadStatus((s) => (s === 'loading' || s === 'slow' ? 'error' : s));
    }, 12000);

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(errorTimer);
    };
  }, [open, activeServer, activeSeason, activeEpisode]);

  const tryNextServer = useCallback(() => {
    const keys = Object.keys(SERVERS);
    const idx = keys.indexOf(activeServer);
    const next = keys[(idx + 1) % keys.length];
    setActiveServer(next);
    setLoadStatus('loading');
  }, [activeServer]);

  const src = SERVERS[activeServer].getUrl(mediaType, id, activeSeason, activeEpisode, subLang, savedProgress);

  return (
    <>
      {children ? (
        <div onClick={handlePlayClick} className={className}>
          {children}
        </div>
      ) : (
        <button
          onClick={handlePlayClick}
          className="inline-flex items-center gap-2 bg-white text-black font-semibold text-[14px] px-7 py-3 rounded-full hover:bg-white/90 transition-all duration-300 hover:scale-[1.02]"
        >
          <Play className="w-4 h-4 fill-black" />
          Play
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-fade-in">
          {/* Top Panel: Server Selector & TV Episode Controls */}
          <div className="w-full max-w-7xl mx-4 mb-4 px-4 flex flex-col md:flex-row gap-4 items-center justify-between z-10">
            {/* Servers */}
            <div className="flex w-full md:w-auto overflow-x-auto scrollbar-hide gap-2 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              {Object.entries(SERVERS).map(([key, server]) => (
                <button
                  key={key}
                  onClick={() => { setActiveServer(key); setLoadStatus('loading'); }}
                  className={`px-4 py-1.5 whitespace-nowrap shrink-0 rounded-full text-xs font-semibold transition-all duration-300 ${
                    activeServer === key
                      ? 'bg-white text-black shadow-lg scale-[1.02]'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {server.name}
                </button>
              ))}
            </div>


            {/* TV Show Episode Selectors */}
            {mediaType === 'tv' && (
              <div className="flex gap-3 items-center bg-white/5 border border-white/10 backdrop-blur-md px-4 py-1.5 rounded-full select-none">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold tracking-wider text-white/50 uppercase">Season</span>
                  <div className="relative inline-flex items-center">
                    <select
                      value={activeSeason}
                      onChange={(e) => {
                        setActiveSeason(Number(e.target.value));
                        setActiveEpisode(1);
                        setLoadStatus('loading');
                      }}
                      className="appearance-none bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg px-2.5 py-0.5 text-center text-xs font-bold text-white focus:outline-none transition cursor-pointer pr-6"
                    >
                      {seasonsList.map((num) => (
                        <option key={num} value={num} className="bg-zinc-900 text-white">
                          {num}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-1.5 text-white/60">
                      <ChevronDown className="w-3 h-3" />
                    </span>
                  </div>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold tracking-wider text-white/50 uppercase">Episode</span>
                  <div className="relative inline-flex items-center">
                    <select
                      value={activeEpisode}
                      onChange={(e) => { setActiveEpisode(Number(e.target.value)); setLoadStatus('loading'); }}
                      className="appearance-none bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg px-2.5 py-0.5 text-center text-xs font-bold text-white focus:outline-none transition cursor-pointer pr-6"
                    >
                      {episodesList.map((num) => (
                        <option key={num} value={num} className="bg-zinc-900 text-white">
                          {num}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-1.5 text-white/60">
                      <ChevronDown className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition"
              aria-label="Close player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Iframe Player Wrapper */}
          <div className="w-full max-w-7xl flex-1 mx-4 rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10 relative max-h-[75vh] min-h-[50vh] shrink-0 md:shrink">
            <style dangerouslySetInnerHTML={{ __html: `
              .stream-iframe-player {
                width: 100% !important;
                height: 100% !important;
                position: absolute;
                top: 0;
                left: 0;
              }
            `}} />
            <iframe
              key={`${activeServer}-${activeSeason}-${activeEpisode}-${subLang}`}
              src={src}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="eager"
              onLoad={() => setLoadStatus('loaded')}
              className="stream-iframe-player border-0 w-full h-full max-w-full max-h-full m-auto"
              title="Stream Player"
            />

            {/* Loading / Error Overlays */}
            {loadStatus !== 'loaded' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 transition-opacity duration-300">
                {loadStatus === 'loading' && (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-white/70" />
                    <p className="text-[12px] tracking-wider text-white/50 uppercase">Loading stream…</p>
                  </div>
                )}

                {loadStatus === 'slow' && (
                  <div className="flex flex-col items-center gap-3 text-center px-6">
                    <Loader2 className="w-8 h-8 animate-spin text-white/40" />
                    <p className="text-sm text-white/60">Taking longer than usual…</p>
                    <p className="text-[11px] text-white/40 max-w-sm">
                      The server may be slow. You can wait or switch to another server above.
                    </p>
                  </div>
                )}

                {loadStatus === 'error' && (
                  <div className="flex flex-col items-center gap-4 text-center px-6">
                    <AlertTriangle className="w-10 h-10 text-yellow-500" />
                    <div>
                      <p className="text-[15px] font-semibold text-white/90 mb-1">Server Unavailable</p>
                      <p className="text-[12px] text-white/50 max-w-sm">
                        This streaming source is not responding. Switch to another server below.
                      </p>
                    </div>
                    <button
                      onClick={tryNextServer}
                      className="inline-flex items-center gap-2 bg-white text-black font-semibold text-[13px] px-5 py-2.5 rounded-full hover:bg-white/90 transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Try Next Server
                    </button>
                    <p className="text-[10px] text-white/30">
                      Next: {SERVERS[Object.keys(SERVERS)[(Object.keys(SERVERS).indexOf(activeServer) + 1) % Object.keys(SERVERS).length]]?.name}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
 
          {/* Subtitle Fallback Warning Toast */}
          {activeServer === 'autoembed' && subLang !== 'off' && (
            <div className="w-full max-w-7xl mx-4 mt-3 bg-amber-500/10 border border-amber-500/25 px-5 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-xl z-10 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-[12px] text-zinc-300 leading-normal font-semibold">
                AutoEmbed subtitles failing? Try switching to the more reliable{' '}
                <button 
                  onClick={() => { setActiveServer('vidlink'); setLoadStatus('loading'); }} 
                  className="text-white hover:underline font-bold transition decoration-amber-400 cursor-pointer"
                >
                  VidLink
                </button>{' '}
                or{' '}
                <button 
                  onClick={() => { setActiveServer('vidsrc'); setLoadStatus('loading'); }} 
                  className="text-white hover:underline font-bold transition decoration-amber-400 cursor-pointer"
                >
                  Vidsrc
                </button>{' '}
                servers.
              </p>
            </div>
          )}

          {/* Manual Progress Save Bar — Apple TV+ style */}
          <div className="w-full max-w-7xl mx-4 mt-3 flex flex-col sm:flex-row items-center gap-3 z-10">
            {/* Saved position display */}
            <div className="text-[13px] text-white/70 whitespace-nowrap">
              {savedProgress > 0 ? (
                <span className="flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-white/50" />
                  Resume {fmtTime(savedProgress)}
                </span>
              ) : (
                <span className="text-white/40">Start from beginning</span>
              )}
            </div>

            <div className="flex-1" />

            {/* Time input + buttons */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="text-[10px] font-semibold tracking-wider text-white/40 uppercase">Position</span>
              <input
                type="text"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                onBlur={(e) => {
                  const s = parseTime(e.target.value);
                  setManualTime(fmtTime(Math.max(0, s)));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const s = parseTime(manualTime);
                    setManualTime(fmtTime(Math.max(0, s)));
                  }
                }}
                placeholder="HH:MM:SS"
                className="w-[90px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-center text-[12px] font-mono font-semibold text-white focus:outline-none focus:border-white/30 transition"
              />

              <button
                onClick={handleManualSave}
                className="inline-flex items-center gap-1.5 bg-white text-black font-semibold text-[12px] px-4 py-1.5 rounded-full hover:bg-white/90 transition-all active:scale-[0.98]"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Save Progress
              </button>

              <button
                onClick={handleMarkWatched}
                className="inline-flex items-center gap-1.5 bg-white/10 text-white font-semibold text-[12px] px-4 py-1.5 rounded-full hover:bg-white/20 border border-white/10 transition-all active:scale-[0.98]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Watched
              </button>
            </div>
          </div>

          {/* Toast */}
          {saveToast && (
            <div className="mt-2 inline-flex items-center gap-2 bg-green-500/90 text-white text-[12px] font-semibold px-4 py-1.5 rounded-full animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saveToast.message}
            </div>
          )}

          {/* Small hint about URL resume */}
          {SERVERS[activeServer].supportsStartTime && savedProgress > 5 && (
            <p className="mt-1 text-[10px] text-white/25 text-center">
              Auto-resume injected into player URL ({fmtTime(savedProgress)})
            </p>
          )}
        </div>
      )}
    </>
  );
}
