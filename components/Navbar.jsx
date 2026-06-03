'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Search, Tv, Film, Home, LogOut, Settings, Heart, Clock, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const authenticatedLinks = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/movies', label: 'Movies', icon: Film },
  { href: '/tv', label: 'TV Shows', icon: Tv },
  { href: '/anime', label: 'Anime', icon: Sparkles },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If user is not logged in, show only a minimalist, centered brand logo in the top navbar
  if (!user) {
    return (
      <header className="fixed top-0 inset-x-0 z-50 bg-transparent py-6">
        <nav className="max-w-[1600px] mx-auto px-6 lg:px-10 flex items-center justify-between">
          <div className="flex items-center gap-2 select-none">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-lg">
              <Tv className="w-4 h-4 text-black animate-pulse" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Tashido <span className="text-white/60">TV</span>
            </span>
          </div>
        </nav>
      </header>
    );
  }

  const logoHref = user ? '/home' : '/';

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 border-b shadow-none ${
          scrolled
            ? 'bg-zinc-950/60 backdrop-blur-xl border-white/5'
            : 'bg-transparent bg-gradient-to-b from-zinc-950/85 via-zinc-950/30 to-transparent border-transparent'
        }`}
      >
        <nav className="max-w-[1600px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href={logoHref} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white to-white/70 flex items-center justify-center shadow-md border border-transparent">
              <Tv className="w-4 h-4 text-black group-hover:scale-115 transition-transform duration-300" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Tashido <span className="text-white/60">TV</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <ul className="hidden md:flex items-center gap-1">
            {authenticatedLinks.map(({ href, label }) => {
              const active = href === '/home' ? pathname === '/home' : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`px-4 py-2 text-[13px] font-medium rounded-full transition-all duration-300 ${
                      active
                        ? 'text-white bg-white/10 shadow-sm border border-white/5'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* User Settings, Search & Profile */}
          <div className="flex items-center gap-4">
            <Link
              href="/search"
              className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition duration-300"
              aria-label="Search"
            >
              <Search className="w-[18px] h-[18px]" />
            </Link>

            {/* Profile Dropdown Trigger */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-8 h-8 rounded-full overflow-hidden border border-white/10 hover:border-white/40 focus:outline-none transition-all duration-300 hover:scale-105 active:scale-95 shadow-md flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] font-bold text-white uppercase">
                    {user.displayName ? user.displayName[0] : 'U'}
                  </span>
                )}
              </button>

              {/* Glassmorphic Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-3 w-64 origin-top-right backdrop-blur-md bg-zinc-900/90 rounded-2xl p-4 shadow-2xl border border-white/10 animate-fade-in z-50">
                  <div className="pb-3 mb-2 border-b border-white/5 flex flex-col space-y-1 select-none">
                    <p className="text-[13px] font-semibold text-white truncate">
                      {user.displayName || 'Guest User'}
                    </p>
                    <p className="text-[11px] text-white/55 truncate">
                      {user.email}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Link
                      href="/my-list"
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-[12px] font-medium text-white/85 hover:text-white hover:bg-white/5 rounded-xl transition duration-300 text-left"
                    >
                      <Heart className="w-4 h-4 text-white/60" />
                      <span>My List</span>
                    </Link>
                    <Link
                      href="/watching"
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-[12px] font-medium text-white/85 hover:text-white hover:bg-white/5 rounded-xl transition duration-300 text-left"
                    >
                      <Clock className="w-4 h-4 text-white/60" />
                      <span>Watching</span>
                    </Link>


                    {user.email === 'herozboy@gmail.com' && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-[12px] font-medium text-white/85 hover:text-white hover:bg-white/5 rounded-xl transition duration-300 text-left"
                      >
                        <Settings className="w-4 h-4 text-white/60" />
                        <span>Admin Panel</span>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-[12px] font-medium text-red-400 hover:text-red-300 hover:bg-white/5 rounded-xl transition duration-300 text-left"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Floating Bottom Glassmorphic Mobile Navigation Bar */}
      <div className="fixed bottom-5 inset-x-4 z-50 md:hidden flex justify-center pointer-events-none">
        <nav className="pointer-events-auto flex items-center justify-around w-full max-w-[420px] h-16 bg-black/85 backdrop-blur-2xl border border-white/10 rounded-2xl px-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.85)]">
          {[
            { href: '/home', label: 'Home', icon: Home },
            { href: '/movies', label: 'Movies', icon: Film },
            { href: '/tv', label: 'TV Shows', icon: Tv },
            { href: '/anime', label: 'Anime', icon: Sparkles },
            { href: '/search', label: 'Search', icon: Search },
          ].map(({ href, label, icon: Icon }) => {
            const active = href === '/home' ? pathname === '/home' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-xl transition-all duration-300 ${
                  active
                    ? 'text-white scale-105 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.45)]'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Icon
                  className={`w-[20px] h-[20px] transition-transform duration-300 ${
                    active ? 'scale-110 text-white' : 'text-white/60'
                  }`}
                />
                <span className="text-[9px] font-semibold tracking-tight">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
