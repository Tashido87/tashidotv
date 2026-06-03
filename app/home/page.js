'use client';

import { useState, useEffect } from 'react';
import Hero from '@/components/Hero';
import ContentRow from '@/components/ContentRow';
import LocalRows from '@/components/LocalRows';
import BecauseYouWatchedRow from '@/components/BecauseYouWatchedRow';
import { subscribeHomeRows, updateUserHeartbeat, subscribeWatchHistory } from '@/lib/db';
import { useAuth } from '@/components/AuthProvider';
import {
  getTrending,
  getPopularMovies,
  getTopRatedMovies,
  getPopularTV,
  getUpcomingMovies,
  getOnTheAirTV,
  discoverMedia,
  discoverByGenre,
  getMovieDetails
} from '@/lib/tmdb';

export default function HomePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [rowContents, setRowContents] = useState({});
  const [heroItems, setHeroItems] = useState([]);
  const [recentWatches, setRecentWatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Heartbeat tracker: increment watchHours in Firestore/LocalStorage
  useEffect(() => {
    if (!user?.uid) return;

    // Immediately mark user active
    updateUserHeartbeat(user.uid, 0);

    const interval = setInterval(() => {
      updateUserHeartbeat(user.uid, 20);
    }, 20000);

    return () => clearInterval(interval);
  }, [user?.uid]);

  // Load row configurations from real-time Firestore sync with localStorage fallback
  useEffect(() => {
    const unsubscribe = subscribeHomeRows((loadedRows) => {
      setRows(loadedRows);
    });
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Fetch recent watches for recommendations
  useEffect(() => {
    let unsubscribe = () => {};

    try {
      unsubscribe = subscribeWatchHistory(user?.uid || null, (firestoreItems) => {
        let localItems = [];
        try {
          const progressData = localStorage.getItem('tashidotv_progress');
          if (progressData) {
            localItems = Object.values(JSON.parse(progressData));
          }
        } catch (e) {}

        const mergedMap = new Map();
        const allItems = [...localItems, ...firestoreItems];

        for (const item of allItems) {
          const key = `${item.mediaType}_${item.id}`;
          const existing = mergedMap.get(key);
          if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
            mergedMap.set(key, item);
          }
        }

        const mergedItems = Array.from(mergedMap.values());
        mergedItems.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        setRecentWatches(mergedItems.slice(0, 5));
      });
    } catch (err) {
      console.error('Failed to initialize watch history subscription for home page:', err);
    }

    return () => unsubscribe();
  }, [user]);

  // Fetch row items dynamically based on visibility and config type
  useEffect(() => {
    if (rows.length === 0) return;

    async function fetchAllData() {
      const activeRows = rows.filter(r => r.visible);
      const contentMap = {};
      let heroPool = [];

      await Promise.all(
        activeRows.map(async (row) => {
          try {
            let data = null;

            // Handle default TMDB endpoints
            if (row.type === 'tmdb') {
              switch (row.endpoint) {
                case 'trending':
                  data = await getTrending('all', 'week');
                  break;
                case 'popularMovies':
                  data = await getPopularMovies();
                  if (data?.results) {
                    const mapped = data.results.slice(0, 5).map(m => ({ ...m, media_type: 'movie' }));
                    heroPool = [...heroPool, ...mapped];
                  }
                  break;
                case 'topRatedMovies':
                  data = await getTopRatedMovies();
                  break;
                case 'popularTV':
                  data = await getPopularTV();
                  if (data?.results) {
                    const mapped = data.results.slice(0, 5).map(t => ({ ...t, media_type: 'tv' }));
                    heroPool = [...heroPool, ...mapped];
                  }
                  break;
                case 'upcomingMovies':
                  data = await getUpcomingMovies();
                  break;
                case 'onTheAirTV':
                  data = await getOnTheAirTV();
                  break;
                default:
                  break;
              }
            }
            // Handle dynamic custom genres
            else if (row.type === 'genre') {
              if (row.mediaType === 'all') {
                const [movieData, tvData] = await Promise.all([
                  discoverByGenre('movie', row.value),
                  discoverByGenre('tv', row.value)
                ]);
                const movies = (movieData?.results || []).map(m => ({ ...m, media_type: 'movie' }));
                const tvs = (tvData?.results || []).map(t => ({ ...t, media_type: 'tv' }));
                
                // Merge, sort by popularity desc, slice to 20
                const merged = [...movies, ...tvs]
                  .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
                  .slice(0, 20);
                data = { results: merged };
              } else {
                const mType = row.mediaType || 'movie';
                data = await discoverByGenre(mType, row.value);
                if (data?.results) {
                  data.results = data.results.map(item => ({ ...item, media_type: mType }));
                }
              }
            }
            // Handle custom curated specific movie lists (Chips/Hashtags)
            else if (row.type === 'custom_ids') {
              const ids = row.value ? row.value.split(',').map(id => id.trim()).filter(Boolean) : [];
              const movies = await Promise.all(
                ids.map(async (id) => {
                  try {
                    return await getMovieDetails(id);
                  } catch (err) {
                    console.error(`Error fetching movie details for id ${id}:`, err);
                    return null;
                  }
                })
              );
              data = { results: movies.filter(Boolean) };
            }
            // Handle legacy preset custom queries
            else if (row.type === 'custom') {
              if (row.id === 'korean-movies') {
                // Highly Rated Korean Movies
                data = await discoverMedia('movie', {
                  with_original_language: 'ko',
                  sort_by: 'vote_average.desc',
                  'vote_count.gte': 100,
                  page: 1
                });
              } else if (row.id === 'latest-animations') {
                // Latest Animation Movies (Genre ID: 16)
                data = await discoverMedia('movie', {
                  with_genres: '16',
                  sort_by: 'primary_release_date.desc',
                  page: 1
                });
              }
            }

            if (data?.results) {
              contentMap[row.id] = data.results;
            }
          } catch (e) {
            console.error(`Error loading row ${row.title}:`, e);
          }
        })
      );

      setRowContents(contentMap);
      
      // Filter out items without backdrop paths and set Hero Carousel items
      const validHeroItems = heroPool.filter(item => item.backdrop_path);
      setHeroItems(validHeroItems.length > 0 ? validHeroItems : []);
      setLoading(false);
    }

    fetchAllData();
  }, [rows]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        <p className="text-[12px] font-medium text-white/50 tracking-wider uppercase">Preparing Cinema...</p>
      </div>
    );
  }

  // Find visible rows in their configured order
  const visibleRows = rows.filter(r => r.visible && rowContents[r.id]);

  return (
    <>
      {heroItems.length > 0 && <Hero items={heroItems} />}

      <div className="relative z-10 mt-8 sm:mt-12 md:mt-14 pb-10 space-y-2">
        <LocalRows />
        
        {recentWatches.map((item) => (
          <BecauseYouWatchedRow 
            key={`${item.mediaType}-${item.id}`}
            mediaId={item.id} 
            mediaType={item.mediaType || 'movie'} 
            title={item.title} 
          />
        ))}
        
        {visibleRows.map((row) => (
          <ContentRow
            key={row.id}
            title={row.title}
            items={rowContents[row.id] || []}
            mediaType={row.mediaType || 'movie'}
            variant={row.variant || 'poster'}
          />
        ))}
      </div>
    </>
  );
}
