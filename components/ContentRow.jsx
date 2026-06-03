'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import MediaCard from './MediaCard';

export default function ContentRow({ title, items = [], mediaType, variant = 'poster', href }) {
  const scroller = useRef(null);

  if (!items?.length) return null;

  const scroll = (dir) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.85), behavior: 'smooth' });
  };

  return (
    <section className="relative group/row py-6">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
          <div className="hidden md:flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition">
            <button
              onClick={() => scroll(-1)}
              className="p-2 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/15 border border-black/5 dark:border-white/5 text-zinc-900 dark:text-white transition"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll(1)}
              className="p-2 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/15 border border-black/5 dark:border-white/5 text-zinc-900 dark:text-white transition"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scroller}
        className="scrollbar-hide overflow-x-auto overflow-y-hidden py-4 scroll-smooth transform-gpu will-change-scroll overscroll-x-contain touch-pan-x"
      >
        <div className="flex gap-4 px-6 lg:px-10 max-w-[1600px] mx-auto">
          {items.map((item) => (
            <MediaCard
              key={`${item.id}-${item.media_type || mediaType}`}
              item={item}
              mediaType={item.media_type || mediaType}
              variant={variant}
            />
          ))}

          {/* "See More" Card appended to the end of the row */}
          {href && (
            <Link
              href={href}
              className="flex-shrink-0 w-[140px] sm:w-[160px] md:w-[200px] aspect-[2/3] rounded-lg bg-zinc-900/50 hover:bg-zinc-800/80 border border-white/5 hover:border-white/20 flex flex-col items-center justify-center gap-3 transition-all duration-300 group cursor-pointer"
              aria-label={`See more ${title}`}
            >
              <div className="p-3 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                <ArrowRight className="w-6 h-6 text-white/70 group-hover:text-white transition-transform duration-300 group-hover:translate-x-1" />
              </div>
              <span className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">
                See All
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
