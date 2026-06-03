'use client';

import { useEffect, useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import MediaCard from '@/components/MediaCard';
import { useAuth } from '@/components/AuthProvider';
import { getMovieDetails, getTVDetails } from '@/lib/tmdb';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function MyListPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setRefreshTrigger((prev) => prev + 1);
    window.addEventListener('tashidotv_update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('tashidotv_update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    async function fetchList() {
      setLoading(true);
      try {
        // 1. Fetch from Local Storage
        let localList = [];
        try {
          const stored = localStorage.getItem('tashidotv_watchlist');
          if (stored) {
            localList = JSON.parse(stored);
          }
        } catch (e) {
          console.error("Local storage error:", e);
        }

        // 2. Fetch from Firestore
        let firestoreIds = [];
        try {
          const userRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            firestoreIds = docSnap.data().liked_movies || [];
          }
        } catch (e) {
          console.warn("Firestore error, falling back to local storage:", e);
        }

        // Convert all IDs to strings for robust comparison
        const localIdMap = new Map(localList.map(item => [String(item.id), item]));
        const missingIds = firestoreIds.map(String).filter(id => !localIdMap.has(id));

        // Fetch details of missing items in parallel
        const fetchedMissing = await Promise.all(
          missingIds.map(async (id) => {
            // Try Movie first
            try {
              const movie = await getMovieDetails(id);
              if (movie && movie.title) {
                return {
                  id: movie.id,
                  mediaType: 'movie',
                  title: movie.title,
                  poster_path: movie.poster_path,
                  backdrop_path: movie.backdrop_path,
                  vote_average: movie.vote_average,
                  release_date: movie.release_date,
                };
              }
            } catch (e) {}

            // Try TV details next
            try {
              const tv = await getTVDetails(id);
              if (tv && tv.name) {
                return {
                  id: tv.id,
                  mediaType: 'tv',
                  title: tv.name,
                  poster_path: tv.poster_path,
                  backdrop_path: tv.backdrop_path,
                  vote_average: tv.vote_average,
                  release_date: tv.first_air_date,
                };
              }
            } catch (e) {}

            return null;
          })
        );

        // Filter out nulls
        const validMissing = fetchedMissing.filter(item => item !== null);

        // Combine lists
        const combined = [...localList, ...validMissing];

        // Deduplicate using Map to ensure absolute unique entries
        const uniqueMap = new Map();
        combined.forEach(item => {
          uniqueMap.set(`${item.mediaType || 'movie'}_${item.id}`, item);
        });

        const finalItems = Array.from(uniqueMap.values());
        setItems(finalItems);
      } catch (err) {
        console.error("Error loading watchlist:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchList();
  }, [user?.uid, authLoading, refreshTrigger]);

  if (authLoading || (loading && items.length === 0)) {
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center space-y-4 transition-colors duration-300">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-500 dark:text-white/70" />
        <p className="text-[12px] font-medium text-zinc-500 dark:text-white/50 tracking-wider uppercase">
          Curating Your List...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-900 dark:text-white pt-28 pb-16 max-w-[1600px] mx-auto px-6 lg:px-10 select-none transition-colors duration-300">
      {/* Title & Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-center gap-2 text-zinc-500 dark:text-white/50 text-[11px] font-bold tracking-widest uppercase mb-1.5">
          <Heart className="w-4 h-4 text-red-500 animate-pulse fill-red-500" />
          <span>Personal Shelf</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-[1.05]">
          My List
        </h1>
        <p className="mt-3 text-zinc-500 dark:text-white/40 max-w-xl text-[14px] leading-relaxed">
          Your bookmarked movies and TV shows. Keep track of what you want to watch next in one sleek, unified location.
        </p>
      </div>

      {/* Grid container */}
      <div className="transition-all duration-500">
        {items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {items.map((item, index) => (
              <div
                key={`${item.mediaType || 'movie'}_${item.id}`}
                className="animate-fade-in"
                style={{ animationDelay: `${(index % 12) * 50}ms` }}
              >
                <MediaCard item={item} mediaType={item.mediaType || 'movie'} isGrid={true} />
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 bg-zinc-900/10 dark:bg-zinc-900/10 border border-black/5 dark:border-white/5 rounded-3xl backdrop-blur-md px-6 transition-colors duration-300">
            <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center border border-black/10 dark:border-white/10 shadow-inner">
              <Heart className="w-6 h-6 text-zinc-400 dark:text-white/20" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900 dark:text-white">Your list is empty</p>
              <p className="text-[12px] text-zinc-500 dark:text-white/40 mt-1 max-w-xs mx-auto">
                Add movies and TV shows to watch later by clicking the 'My List' button on details pages.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
