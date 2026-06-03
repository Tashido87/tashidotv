"use client";

import { useState } from 'react';
import { Film } from 'lucide-react';
import MediaCard from './MediaCard';

export default function PersonFilmography({ items = [] }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'movie' | 'tv'

  const filtered = items.filter((item) => {
    if (filter === 'all') return true;
    return item.media_type === filter;
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-platinum select-none">
          Known For
        </h2>
        
        {/* Apple TV-style Pill Selector Tab Group */}
        <div className="flex bg-white/5 border border-white/10 p-1 rounded-full backdrop-blur-md self-start sm:self-auto select-none">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 active:scale-95 ${
              filter === 'all'
                ? 'bg-white text-black shadow-lg scale-[1.02]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('movie')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 active:scale-95 ${
              filter === 'movie'
                ? 'bg-white text-black shadow-lg scale-[1.02]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Movies
          </button>
          <button
            onClick={() => setFilter('tv')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 active:scale-95 ${
              filter === 'tv'
                ? 'bg-white text-black shadow-lg scale-[1.02]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            TV Shows
          </button>
        </div>
      </div>

      {/* Grid Results */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-6 animate-fade-in">
          {filtered.map((item) => (
            <MediaCard
              key={`${item.id}-${item.media_type || 'movie'}`}
              item={item}
              mediaType={item.media_type || 'movie'}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center text-white/40 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl animate-fade-in select-none">
          <Film className="w-12 h-12 mb-3 stroke-[1.5] text-white/25" />
          <p className="text-sm font-semibold tracking-wide uppercase">
            No {filter === 'movie' ? 'Movies' : 'TV Shows'} found for this person.
          </p>
        </div>
      )}
    </section>
  );
}
