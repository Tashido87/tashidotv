'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getTrending, IMG } from '@/lib/tmdb';
import { Tv } from 'lucide-react';

export default function LandingClient({ trendingItems = [] }) {
  const { loginWithGoogle, user, loading } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [clientTrendingItems, setClientTrendingItems] = useState(trendingItems);

  useEffect(() => {
    if (clientTrendingItems.length > 0) return;

    let cancelled = false;
    async function loadTrendingBackdrops() {
      try {
        const trending = await getTrending('all', 'week');
        if (!cancelled) {
          setClientTrendingItems(trending?.results || []);
        }
      } catch (err) {
        console.error('Error loading landing backdrops:', err);
      }
    }

    loadTrendingBackdrops();
    return () => {
      cancelled = true;
    };
  }, [clientTrendingItems.length]);

  // Filter trending items to only those that have valid backdrop paths
  const slides = (clientTrendingItems || []).filter((item) => item.backdrop_path).slice(0, 8);

  // Automatic slideshow transition
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black text-white px-6">
      {/* Immersive UHD Cinematic Background Slider */}
      <div className="absolute inset-0 z-0">
        {slides.map((slide, idx) => {
          const imageUrl = IMG.original(slide.backdrop_path);
          const isActive = idx === currentIndex;
          return (
            <div
              key={slide.id || idx}
              className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out transform ${
                isActive ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
              }`}
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          );
        })}
      </div>

      {/* Dark Overlay & Backdrop Blur */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/60 to-black/80 backdrop-blur-md" />

      {/* Main Content Card */}
      <div className="relative z-20 max-w-3xl text-center flex flex-col items-center space-y-8 select-none">
        {/* Subtle, Floating premium Logo Badge */}
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 shadow-2xl animate-fade-in">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
            <Tv className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="text-[12px] font-semibold tracking-wider uppercase text-white/90">
            Tashido <span className="text-white/50">TV</span>
          </span>
        </div>

        {/* Elegant Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight max-w-2xl drop-shadow-2xl">
          All your favorite movies, series, and live TV. <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40">All in one place.</span>
        </h1>

        {/* Clean, Modern Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-white/60 max-w-xl leading-relaxed font-light">
          Sign in with your Google account to start your private screening.
        </p>

        {/* Google Authentication Capsule Login Button */}
        <div className="pt-4">
          <button
            onClick={loginWithGoogle}
            disabled={loading}
            className="group flex items-center gap-3 bg-white text-black hover:bg-neutral-200 font-medium px-8 py-3.5 rounded-full transition-all duration-300 shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {/* Minimalist Google Icon SVG */}
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="text-[15px] font-semibold tracking-tight">Continue with Google</span>
          </button>
        </div>
      </div>
    </div>
  );
}
