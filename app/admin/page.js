'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import {
  Tv,
  Users,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Settings,
  Clock,
  ShieldCheck,
  TrendingUp,
  LayoutGrid,
  ShieldAlert,
  ExternalLink,
  Copy,
  CheckCircle2,
  X
} from 'lucide-react';
import { subscribeHomeRows, saveHomeRows, resetHomeRows, subscribeUsers, deleteUser } from '@/lib/db';
import { searchMovies } from '@/lib/tmdb';
import UserAnalyticsModal from '@/components/UserAnalyticsModal';

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Anyone can read home rows to build page layout, only admin can write
    match /settings/home_rows {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.email == 'herozboy@gmail.com';
    }
    // Users can read/write their own profile; Admin can read/write/delete any user
    match /users/{userId} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'herozboy@gmail.com');
      
      // Personal cross-device continue watching collections
      match /continueWatching/{mediaId} {
        allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'herozboy@gmail.com');
      }
      
      // Analytics watch sessions
      match /watchSessions/{sessionId} {
        allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'herozboy@gmail.com');
      }
    }
  }
}`;

const TMDB_GENRES = [
  { name: 'Action', id: '28' },
  { name: 'Adventure', id: '12' },
  { name: 'Animation', id: '16' },
  { name: 'Comedy', id: '35' },
  { name: 'Crime', id: '80' },
  { name: 'Documentary', id: '99' },
  { name: 'Drama', id: '18' },
  { name: 'Family', id: '10751' },
  { name: 'Fantasy', id: '14' },
  { name: 'History', id: '36' },
  { name: 'Horror', id: '27' },
  { name: 'Music', id: '10402' },
  { name: 'Mystery', id: '9648' },
  { name: 'Romance', id: '10749' },
  { name: 'Sci-Fi', id: '878' },
  { name: 'Thriller', id: '53' },
  { name: 'War', id: '10752' },
  { name: 'Western', id: '37' }
];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('rows'); // 'rows' | 'users'
  const [currentPage, setCurrentPage] = useState(1);
  const [userSortBy, setUserSortBy] = useState('active'); // 'active' | 'registration'
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [firestoreError, setFirestoreError] = useState(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);
  const [selectedAnalyticsUser, setSelectedAnalyticsUser] = useState(null);

  // Advanced Row Builder State variables
  const [newRowTitle, setNewRowTitle] = useState('');
  const [fetchType, setFetchType] = useState('genre'); // 'genre' | 'custom_ids'
  const [mediaType, setMediaType] = useState('all'); // 'all' | 'movie' | 'tv'
  const [layoutVariant, setLayoutVariant] = useState('poster'); // 'poster' | 'backdrop'
  const [selectedGenre, setSelectedGenre] = useState('28'); // Defaults to 'Action' (28)
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSuggestions, setMovieSuggestions] = useState([]);
  const [selectedMovies, setSelectedMovies] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  // Security guard check
  useEffect(() => {
    if (!loading) {
      if (!user || user.email !== 'herozboy@gmail.com') {
        router.push('/home');
      }
    }
  }, [user, loading, router]);

  // Subscribe to real-time database values
  useEffect(() => {
    if (!user || user.email !== 'herozboy@gmail.com') return;

    const unsubscribeRows = subscribeHomeRows(
      (loadedRows) => {
        setRows(loadedRows);
      },
      (err) => {
        console.error("Firestore rows subscription failed:", err);
        setFirestoreError("Firestore rules locked or database not initialized.");
      }
    );

    const unsubscribeUsers = subscribeUsers(
      (loadedUsers) => {
        setUsers(loadedUsers);
      },
      (err) => {
        console.error("Firestore users subscription failed:", err);
        setFirestoreError("Firestore rules locked or database not initialized.");
      }
    );

    return () => {
      if (unsubscribeRows && typeof unsubscribeRows === 'function') unsubscribeRows();
      if (unsubscribeUsers && typeof unsubscribeUsers === 'function') unsubscribeUsers();
    };
  }, [user]);

  // Live debounced suggestions search for TMDB movies
  useEffect(() => {
    if (fetchType !== 'custom_ids') return;
    if (movieSearchQuery.trim().length < 3) {
      setMovieSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchMovies(movieSearchQuery);
        if (res && res.results) {
          setMovieSuggestions(res.results.slice(0, 8)); // Limit to top 8 suggestions
          setShowSuggestions(true);
        } else {
          setMovieSuggestions([]);
        }
      } catch (err) {
        console.error("Error searching TMDB movies:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [movieSearchQuery, fetchType]);

  if (loading || !user || user.email !== 'herozboy@gmail.com') {
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center space-y-4 transition-colors duration-300">
        <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 flex items-center justify-center shadow-lg animate-pulse">
          <Tv className="w-6 h-6 text-zinc-900 dark:text-white" />
        </div>
        <div className="w-6 h-6 border-2 border-zinc-300 dark:border-white/25 border-t-zinc-900 dark:border-t-white rounded-full animate-spin"></div>
        <p className="text-[11px] font-semibold text-zinc-550 dark:text-white/40 tracking-wider uppercase">Authenticating...</p>
      </div>
    );
  }

  // Row toggling handlers
  const toggleRowVisibility = async (id) => {
    const updated = rows.map((row) =>
      row.id === id ? { ...row, visible: !row.visible } : row
    );
    setRows(updated);
    await saveHomeRows(updated);
  };

  // Add highly rated Korean / Animations preset cards
  const addPresetRow = async (id, title, type, endpoint, mediaType) => {
    const exists = rows.some((row) => row.id === id);
    let updated;
    if (exists) {
      updated = rows.map((row) =>
        row.id === id ? { ...row, visible: true } : row
      );
    } else {
      const newRow = { id, title, type, endpoint, mediaType, visible: true };
      updated = [...rows, newRow];
    }
    setRows(updated);
    await saveHomeRows(updated);
  };

  // Create Row Form Action handler
  const handleCreateRow = async (e) => {
    e.preventDefault();

    if (!newRowTitle.trim()) {
      alert("Please provide a valid row title.");
      return;
    }

    let value = '';
    if (fetchType === 'genre') {
      value = selectedGenre;
    } else if (fetchType === 'custom_ids') {
      if (selectedMovies.length === 0) {
        alert("Please add at least one movie to build your curated list.");
        return;
      }
      value = selectedMovies.map((m) => m.id).join(',');
    }

    // Generate a unique row ID based on slug + random suffix
    const slug = newRowTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const newId = `${slug}-${randomSuffix}`;

    const newRow = {
      id: newId,
      title: newRowTitle,
      type: fetchType,
      value,
      mediaType,
      variant: layoutVariant,
      visible: true,
      endpoint: fetchType === 'genre' ? 'discoverByGenre' : 'getMovieDetails'
    };

    const updated = [...rows, newRow];
    setRows(updated);

    try {
      await saveHomeRows(updated);
      
      // Reset form variables
      setNewRowTitle('');
      setSelectedMovies([]);
      setMovieSearchQuery('');
    } catch (err) {
      console.error("Firestore dynamic row creation failed:", err);
      alert("Failed to write layout configuration to the database.");
    }
  };

  // Delete dynamic custom category row handler
  const handleDeleteRow = async (id) => {
    if (confirm('Are you sure you want to permanently delete this dynamic layout row?')) {
      const updated = rows.filter((row) => row.id !== id);
      setRows(updated);
      await saveHomeRows(updated);
    }
  };

  const handleResetRows = async () => {
    if (confirm('Are you sure you want to reset rows to system defaults?')) {
      const defaults = await resetHomeRows();
      setRows(defaults);
    }
  };

  // User deletion handler
  const handleDeleteUser = async (uid, email) => {
    if (email === 'herozboy@gmail.com') {
      alert('Cannot terminate the primary administrator account.');
      return;
    }
    if (confirm(`Are you sure you want to terminate user account "${email}"?`)) {
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      await deleteUser(uid);
    }
  };

  // Movie tag chip selectors
  const handleSelectMovie = (movie) => {
    if (!selectedMovies.some((m) => m.id === movie.id)) {
      const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
      setSelectedMovies((prev) => [...prev, { id: movie.id, title: movie.title, year }]);
    }
    setMovieSearchQuery('');
    setMovieSuggestions([]);
    setShowSuggestions(false);
  };

  const handleRemoveMovie = (movieId) => {
    setSelectedMovies((prev) => prev.filter((m) => m.id !== movieId));
  };

  // Analytics helper metrics
  const activeCount = users.filter((u) => u.active).length;
  const totalWatchHours = (users.reduce((acc, u) => acc + (u.watchHours || 0), 0) / 60).toFixed(1);

  return (
    <div className="min-h-screen bg-transparent text-zinc-900 dark:text-white pt-28 pb-16 px-6 lg:px-12 select-none transition-colors duration-300">
      {/* Top Welcome Title */}
      <div className="max-w-[1450px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 border-b border-black/5 dark:border-white/5 pb-8">
        <div>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-white/50 text-[12px] font-bold tracking-widest uppercase mb-1">
            <ShieldCheck className="w-4 h-4 text-zinc-655 dark:text-white/60" />
            <span>Administrator Control Panel</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Tashido TV Configuration</h1>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-black/5 dark:bg-neutral-900 border border-black/5 dark:border-white/5 p-1 rounded-xl transition-colors duration-300">
          <button
            onClick={() => setActiveTab('rows')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-[13px] font-semibold transition-all duration-300 ${
              activeTab === 'rows'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-lg scale-[1.02]'
                : 'text-zinc-650 hover:text-zinc-900 dark:text-white/70 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Homepage Layouts</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-[13px] font-semibold transition-all duration-300 ${
              activeTab === 'users'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-lg scale-[1.02]'
                : 'text-zinc-650 hover:text-zinc-900 dark:text-white/70 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Accounts & heartbeats</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="max-w-[1450px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white/60 dark:bg-neutral-900/40 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div>
            <span className="text-[11px] font-bold text-zinc-550 dark:text-white/40 tracking-wider uppercase transition-colors duration-300">Registered Accounts</span>
            <p className="text-3xl font-extrabold mt-1">{users.length}</p>
          </div>
          <div className="w-12 h-12 bg-black/5 border border-black/5 dark:bg-white/5 dark:border-white/10 rounded-xl flex items-center justify-center text-zinc-700 dark:text-white/80 transition-all duration-300">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white/60 dark:bg-neutral-900/40 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div>
            <span className="text-[11px] font-bold text-zinc-550 dark:text-white/40 tracking-wider uppercase transition-colors duration-300">Active Streaming</span>
            <p className="text-3xl font-extrabold mt-1">{activeCount}</p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-neutral-900/40 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div>
            <span className="text-[11px] font-bold text-zinc-550 dark:text-white/40 tracking-wider uppercase transition-colors duration-300">Total Watch Hours</span>
            <p className="text-3xl font-extrabold mt-1">{totalWatchHours} <span className="text-xs text-zinc-550 dark:text-white/40 font-medium">hrs</span></p>
          </div>
          <div className="w-12 h-12 bg-amber-550/10 dark:bg-amber-500/10 border border-amber-550/20 dark:border-amber-500/20 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 transition-all duration-300">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white/60 dark:bg-neutral-900/40 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div>
            <span className="text-[11px] font-bold text-zinc-550 dark:text-white/40 tracking-wider uppercase transition-colors duration-300">Catalog rows</span>
            <p className="text-3xl font-extrabold mt-1">{rows.filter((r) => r.visible).length} <span className="text-xs text-zinc-550 dark:text-white/40 font-medium">/{rows.length} Visible</span></p>
          </div>
          <div className="w-12 h-12 bg-indigo-550/10 dark:bg-indigo-500/10 border border-indigo-550/20 dark:border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 transition-all duration-300">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Firestore Connection status banner */}
      {firestoreError ? (
        <div className="max-w-[1450px] mx-auto mb-6 bg-amber-500/10 border border-amber-500/25 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-xl animate-fade-in animate-pulse">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg mt-0.5 md:mt-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-500 dark:text-amber-400">Local Cache Synchronization Fallback</h3>
              <p className="text-[12px] text-zinc-600 dark:text-white/60 mt-0.5 leading-relaxed">
                App sync rules are restricted. Database is locked, falling back to local cookies storage.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSetupGuide(true)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-black bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-full transition duration-300 shadow-lg active:scale-95"
          >
            <span>Firestore Setup Guide</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="max-w-[1450px] mx-auto mb-6 bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/10 px-4 py-3 rounded-2xl flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold tracking-wider uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Firestore Database Connected & Synced Real-Time</span>
          </div>
          <button
            onClick={() => setShowSetupGuide(true)}
            className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 px-3 py-1 rounded-full transition-all duration-300"
          >
            Security Setup
          </button>
        </div>
      )}

      {/* Main Container View Box */}
      <div className="max-w-[1450px] mx-auto bg-white/60 dark:bg-neutral-900/30 border border-black/5 dark:border-white/5 shadow-md dark:shadow-none backdrop-blur-xl p-6 md:p-8 rounded-3xl min-h-[500px]">
        {activeTab === 'rows' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Homepage Dynamic Rows</h2>
                <p className="text-[13px] text-zinc-500 dark:text-white/50 mt-0.5">Toggle row visibility, append movies, or add customized TMDB catalogs.</p>
              </div>
              <button
                onClick={handleResetRows}
                className="self-start text-[12px] font-semibold text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 px-4 py-1.5 rounded-full transition-all duration-300"
              >
                Reset To Default Shelves
              </button>
            </div>

            {/* UPGRADED Custom Rows Creator split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column (5/12 = ~42%): Modern Custom Row Builder */}
              <div className="lg:col-span-5 bg-white/60 dark:bg-neutral-950/40 border border-black/5 dark:border-white/5 p-6 rounded-3xl backdrop-blur-xl relative overflow-visible shadow-sm dark:shadow-none transition-all duration-300">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-650 dark:text-indigo-400 transition-colors duration-300">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold tracking-wide text-zinc-950 dark:text-white transition-colors duration-300">Create Layout Shelf</h3>
                    <p className="text-[11px] text-zinc-400 dark:text-white/40 transition-colors duration-300">Select TMDB Genre or add curated movies manually</p>
                  </div>
                </div>

                <form onSubmit={handleCreateRow} className="space-y-5">
                  {/* Row Title */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40 mb-1.5 transition-colors duration-300">Shelf Title</label>
                    <input
                      type="text"
                      required
                      value={newRowTitle}
                      onChange={(e) => setNewRowTitle(e.target.value)}
                      placeholder="e.g. My Favorite Action Thrillers"
                      className="w-full bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-[13px] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/20 focus:border-indigo-500/50 outline-none transition duration-300"
                    />
                  </div>

                  {/* Split parameters: Fetch Type & Layout */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Fetch Type */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40 mb-1.5 transition-colors duration-300">Fetch Type</label>
                      <select
                        value={fetchType}
                        onChange={(e) => {
                          setFetchType(e.target.value);
                          setSelectedMovies([]);
                        }}
                        className="w-full bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-zinc-900 dark:text-white focus:border-indigo-500/50 outline-none transition duration-300 cursor-pointer"
                      >
                        <option value="genre">TMDB Genre</option>
                        <option value="custom_ids">Custom Movie List</option>
                      </select>
                    </div>

                    {/* Layout Variant */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40 mb-1.5 transition-colors duration-300">Layout Style</label>
                      <select
                        value={layoutVariant}
                        onChange={(e) => setLayoutVariant(e.target.value)}
                        className="w-full bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-zinc-900 dark:text-white focus:border-indigo-500/50 outline-none transition duration-300 cursor-pointer"
                      >
                        <option value="poster">Poster (Portrait)</option>
                        <option value="backdrop">Backdrop (Landscape)</option>
                      </select>
                    </div>
                  </div>

                  {/* Media Type Selection */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40 mb-1.5 transition-colors duration-300">Media Type</label>
                    <div className="grid grid-cols-3 gap-1 bg-black/5 dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-0.5 transition-colors duration-300">
                      <button
                        type="button"
                        onClick={() => setMediaType('all')}
                        disabled={fetchType === 'custom_ids'}
                        className={`py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-300 ${
                          fetchType === 'custom_ids'
                            ? 'opacity-20 cursor-not-allowed text-zinc-300 dark:text-white/20'
                            : mediaType === 'all'
                            ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none'
                            : 'text-zinc-550 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/70'
                        }`}
                        title={fetchType === 'custom_ids' ? "Mixed types not supported in custom IDs list selection." : ""}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaType('movie')}
                        className={`py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-300 ${
                          mediaType === 'movie'
                            ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none'
                            : 'text-zinc-550 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/70'
                        }`}
                      >
                        Movie
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaType('tv')}
                        disabled={fetchType === 'custom_ids'}
                        className={`py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-300 ${
                          fetchType === 'custom_ids'
                            ? 'opacity-20 cursor-not-allowed text-zinc-300 dark:text-white/20'
                            : mediaType === 'tv'
                            ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none'
                            : 'text-zinc-550 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/70'
                        }`}
                        title={fetchType === 'custom_ids' ? "TV Shows not supported in custom IDs list selection." : ""}
                      >
                        TV Show
                      </button>
                    </div>
                  </div>

                  {/* Static Genre Selector dropdown */}
                  {fetchType === 'genre' && (
                    <div className="animate-fade-in">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40 mb-1.5 transition-colors duration-300">Select Catalog Genre</label>
                      <select
                        value={selectedGenre}
                        onChange={(e) => setSelectedGenre(e.target.value)}
                        className="w-full bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-zinc-900 dark:text-white focus:border-indigo-500/50 outline-none transition duration-300 cursor-pointer"
                      >
                        {TMDB_GENRES.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Live Search and suggestions list */}
                  {fetchType === 'custom_ids' && (
                    <div className="space-y-4 animate-fade-in relative">
                      <div className="relative">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40 mb-1.5 transition-colors duration-300">Type Movie Name to Add...</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={movieSearchQuery}
                            onChange={(e) => {
                              setMovieSearchQuery(e.target.value);
                              setShowSuggestions(true);
                            }}
                            placeholder="e.g. Inception, Interstellar..."
                            className="w-full bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-[13px] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/20 focus:border-indigo-500/50 outline-none transition duration-300"
                          />
                          {searching && (
                            <div className="absolute right-3.5 top-3.5 w-4 h-4 border-2 border-zinc-300 dark:border-white/25 border-t-zinc-900 dark:border-t-white rounded-full animate-spin"></div>
                          )}
                        </div>

                        {/* Dropdown Floating suggestions list */}
                        {showSuggestions && movieSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-neutral-950 border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden max-h-60 overflow-y-auto backdrop-blur-xl animate-fade-in">
                            {movieSuggestions.map((movie) => {
                              const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                              return (
                                <button
                                  key={movie.id}
                                  type="button"
                                  onClick={() => handleSelectMovie(movie)}
                                  className="w-full text-left px-4 py-3 text-[13px] hover:bg-black/5 dark:hover:bg-white/5 border-b border-black/5 dark:border-white/5 transition flex items-center justify-between text-zinc-900 dark:text-white"
                                >
                                  <div>
                                    <p className="font-semibold">{movie.title}</p>
                                    <p className="text-[11px] text-zinc-400 dark:text-white/40 mt-0.5">ID: {movie.id}</p>
                                  </div>
                                  <span className="text-[11px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 px-2.5 py-0.5 rounded text-zinc-600 dark:text-white/60">
                                    {year}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {showSuggestions && movieSearchQuery.trim().length >= 3 && movieSuggestions.length === 0 && !searching && (
                          <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-neutral-950 border border-black/5 dark:border-white/10 rounded-2xl p-4 text-center text-[12px] text-zinc-450 dark:text-white/40 z-[100] backdrop-blur-xl">
                            No matching movies. Try another keyword.
                          </div>
                        )}
                      </div>

                      {/* Movie Chip items */}
                      {selectedMovies.length > 0 && (
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40 mb-1.5 transition-colors duration-300">
                            Curated Selection ({selectedMovies.length})
                          </label>
                          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-black/5 dark:bg-neutral-900/50 border border-black/5 dark:border-white/5 rounded-xl">
                            {selectedMovies.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2.5 py-1 text-[12px] text-indigo-600 dark:text-indigo-300 transition hover:border-indigo-500/30"
                              >
                                <span className="font-medium max-w-[120px] truncate">{m.title}</span>
                                <span className="text-[10px] text-indigo-500/75 dark:text-indigo-400/75">({m.year})</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMovie(m.id)}
                                  className="text-indigo-550 dark:text-indigo-400 hover:text-red-500 p-0.5 rounded transition"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add Row Button */}
                  <button
                    type="submit"
                    className="w-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 py-3 rounded-xl font-bold text-[13px] transition duration-300 flex items-center justify-center gap-2 shadow-lg active:scale-98"
                  >
                    <Plus className="w-4 h-4 text-white dark:text-black" />
                    <span>Create Custom Row</span>
                  </button>
                </form>
              </div>

              {/* Right Column (7/12 = ~58%): Description & Preset Options */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {/* Visual Premium Description Card */}
                <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-black/5 dark:border-white/5 p-6 rounded-3xl flex flex-col justify-between min-h-[180px] relative overflow-hidden backdrop-blur-xl select-none transition-all duration-300">
                  <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-indigo-500/10 blur-[85px]"></div>
                  
                  <div>
                    <span className="text-[10px] font-bold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase">Interactive Layout Shelf Builder</span>
                    <h3 className="text-xl font-extrabold mt-1 text-zinc-900 dark:text-white tracking-tight transition-colors duration-300">Apple TV Styling Standards</h3>
                    <p className="text-[13px] text-zinc-600 dark:text-white/50 mt-2 leading-relaxed transition-colors duration-300">
                      Say goodbye to manual TMDB IDs! Use the intuitive selector to curate movies in chips style, or choose genres using drop-down list boxes. Everything is synchronized dynamically to all users in real-time.
                    </p>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-4 text-[11px] text-zinc-400 dark:text-white/40 transition-colors duration-300">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>Real-time Sync</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                      <span>Automated Genres</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
                      <span>Curated Movie Chips</span>
                    </div>
                  </div>
                </div>


              </div>
            </div>

            {/* Configured Rows Shelf Table */}
            <div className="space-y-4">
              <h3 className="text-[14px] font-bold tracking-wider text-zinc-500 dark:text-white/70 uppercase transition-colors duration-300">Active Homepage Layout Shelf</h3>
              <div className="border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden bg-white/40 dark:bg-neutral-950/20 shadow-sm dark:shadow-none transition-all duration-300">
                <div className="divide-y divide-black/5 dark:divide-white/5">
                  {rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between p-4 sm:p-5 hover:bg-black/5 dark:hover:bg-white/5 transition duration-300">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-zinc-900 dark:text-white transition-colors duration-300">{row.title}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            row.type === 'genre' || row.type === 'custom_ids'
                              ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20'
                              : 'bg-black/5 dark:bg-white/5 text-zinc-500 dark:text-white/60 border border-black/5 dark:border-white/5'
                          }`}>
                            {row.type}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-zinc-400 dark:text-white/30 mt-1 transition-colors duration-300">
                          ID: {row.id} • API: {row.endpoint} • Style: {row.variant || 'poster'}
                          {row.type === 'genre' && ` • Genre ID: ${row.value}`}
                          {row.type === 'custom_ids' && ` • Curated IDs: ${row.value}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Display toggle */}
                        <button
                          onClick={() => toggleRowVisibility(row.id)}
                          className={`flex items-center gap-2 text-[12px] font-semibold px-4 py-1.5 rounded-full border transition-all duration-300 ${
                            row.visible
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-zinc-500 hover:text-zinc-900 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10'
                          }`}
                        >
                          {row.visible ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Displayed</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Hidden</span>
                            </>
                          )}
                        </button>

                        {/* Deletion button for dynamically added rows */}
                        {(row.type === 'genre' || row.type === 'custom_ids' || row.type === 'custom') && (
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-2 text-zinc-400 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all duration-300 active:scale-95"
                            title="Delete Row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Users Manager View */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Active User Accounts</h2>
                <p className="text-[13px] text-zinc-500 dark:text-white/50 mt-0.5 transition-colors duration-300">Monitor user sessions, calculate active weekly watch hours, or terminate unapproved accounts.</p>
              </div>
              <select
                value={userSortBy}
                onChange={(e) => {
                  setUserSortBy(e.target.value);
                  setCurrentPage(1); // Reset to page 1 on sort change
                }}
                className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-zinc-700 dark:text-white/80 text-[13px] font-semibold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 cursor-pointer"
              >
                <option value="active" className="bg-white dark:bg-zinc-900 text-black dark:text-white">Active Now (Default)</option>
                <option value="registration" className="bg-white dark:bg-zinc-900 text-black dark:text-white">Latest Registration</option>
              </select>
            </div>

            {(() => {
              const sortedUsers = [...users].sort((a, b) => {
                if (userSortBy === 'registration') {
                  // Fallback to lastActive if createdAt is not available for older users
                  return (b.createdAt || b.lastActive || 0) - (a.createdAt || a.lastActive || 0);
                }
                return (b.lastActive || 0) - (a.lastActive || 0);
              });
              const usersPerPage = 15;
              const indexOfLastUser = currentPage * usersPerPage;
              const indexOfFirstUser = indexOfLastUser - usersPerPage;
              const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);
              const totalPages = Math.ceil(sortedUsers.length / usersPerPage) || 1;

              return (
                <>
                  <div className="border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden bg-white/40 dark:bg-neutral-950/20 shadow-sm dark:shadow-none overflow-x-auto transition-all duration-300">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="border-b border-black/5 dark:border-b-white/5 bg-black/5 dark:bg-white/5 text-[11px] font-bold text-zinc-500 dark:text-white/40 tracking-wider uppercase transition-colors duration-300">
                          <th className="p-4 pl-6">User details</th>
                          <th className="p-4">Authorization</th>
                          <th className="p-4">Last Active</th>
                          <th className="p-4 text-center">Status</th>
                          <th className="p-4 text-right">Watch Time</th>
                          <th className="p-4 text-center pr-6">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5 text-[13px]">
                        {currentUsers.map((item) => (
                    <tr key={item.uid} className="hover:bg-black/5 dark:hover:bg-white/5 transition duration-300">
                      <td className="p-4 pl-6 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-neutral-800 dark:to-neutral-900 border border-black/10 dark:border-white/10 flex items-center justify-center overflow-hidden transition-colors duration-300">
                          {item.photoURL ? (
                            <img src={item.photoURL} alt={item.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold uppercase text-zinc-700 dark:text-white/70">{item.displayName ? item.displayName[0] : 'U'}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white transition-colors duration-300">{item.displayName || 'Guest User'}</p>
                          <p className="text-[11px] text-zinc-500 dark:text-white/40 font-mono transition-colors duration-300">{item.email}</p>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                          item.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/20'
                            : 'bg-black/5 dark:bg-white/5 text-zinc-650 dark:text-white/60 border border-black/5 dark:border-white/5'
                        }`}>
                          {item.role || 'user'}
                        </span>
                      </td>

                      <td className="p-4 text-zinc-600 dark:text-white/60 text-[12px] font-medium transition-colors duration-300">{item.lastSignInTime || 'N/A'}</td>

                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          {item.active ? (
                            <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Active
                            </span>
                          ) : (
                            <span className="bg-black/5 dark:bg-white/5 text-zinc-500 dark:text-white/40 border border-black/5 dark:border-white/5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                              Offline
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-right font-mono font-semibold text-zinc-850 dark:text-white/80 pr-6 transition-colors duration-300">
                        {item.watchHours ? `${(item.watchHours / 60).toFixed(1)} hrs` : '0.0 hrs'}
                      </td>

                      <td className="p-4 text-center pr-6 flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedAnalyticsUser(item)}
                          className="p-2 rounded-full text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-500/10 hover:scale-105 active:scale-95 transition-all duration-300"
                          title="View User Analytics"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(item.uid, item.email)}
                          disabled={item.email === 'herozboy@gmail.com'}
                          className={`p-2 rounded-full transition-all duration-300 ${
                            item.email === 'herozboy@gmail.com'
                              ? 'text-zinc-200 dark:text-white/10 cursor-not-allowed'
                              : 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10 hover:scale-105 active:scale-95'
                          }`}
                          title="Terminate Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border border-black/5 dark:border-white/5 rounded-xl p-4 bg-white/40 dark:bg-neutral-950/20 shadow-sm dark:shadow-none">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-white/80 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                      >
                        Previous
                      </button>
                      <span className="text-sm font-medium text-zinc-500 dark:text-white/60">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-white/80 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Firestore Security Rules Modal */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-all duration-300 select-text animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-3xl max-w-xl w-full p-6 md:p-8 relative shadow-2xl overflow-y-auto max-h-[90vh] transition-all duration-300">
            <button
              onClick={() => setShowSetupGuide(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-900 dark:text-white/50 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 mb-2">
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Configuration Assistant</span>
            </div>

            <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2 transition-colors duration-300">Firebase Firestore Rules Setup</h2>
            <p className="text-[12px] text-zinc-650 dark:text-white/60 leading-relaxed mb-6 transition-colors duration-300">
              To allow users to register profiles, log watch heartbeats, and synchronize settings across devices, you must publish the following security rules in your Firebase Console.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 dark:text-white/40 uppercase tracking-wider transition-colors duration-300">
                <span>Copy-paste security rules</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(FIRESTORE_RULES);
                    setCopiedRules(true);
                    setTimeout(() => setCopiedRules(false), 2000);
                  }}
                  className="flex items-center gap-1 text-zinc-600 hover:text-zinc-950 dark:text-white/60 dark:hover:text-white bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 px-2.5 py-1 rounded-md transition-colors duration-300"
                >
                  {copiedRules ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-555 dark:text-emerald-400" />
                      <span className="text-emerald-650 dark:text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Rules</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="bg-black/5 dark:bg-black/60 border border-black/5 dark:border-white/5 p-4 rounded-xl text-[11px] font-mono text-zinc-800 dark:text-white/80 overflow-x-auto select-all leading-relaxed whitespace-pre transition-colors duration-300">
{FIRESTORE_RULES}
              </pre>

              <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 transition-colors duration-300">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800 dark:text-white/80 transition-colors duration-300">Instructional Steps</span>
                <ol className="list-decimal list-inside text-[11px] text-zinc-600 dark:text-white/60 space-y-2 mt-2 leading-relaxed transition-colors duration-300">
                  <li>Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-650 dark:text-white hover:underline font-semibold inline-flex items-center gap-0.5 transition-colors duration-305">Firebase Console <ExternalLink className="w-2.5 h-2.5" /></a> and select your <b>tashido-tv</b> project.</li>
                  <li>Click on <b>Firestore Database</b> under the Build menu.</li>
                  <li>Select the <b>Rules</b> tab in the top navigation.</li>
                  <li>Replace the existing rules text with the configuration copied above.</li>
                  <li>Click the <b>Publish</b> button.</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowSetupGuide(false)}
              className="mt-6 w-full py-3 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold text-[13px] rounded-xl transition duration-300"
            >
              Done & Verified
            </button>
          </div>
        </div>
      )}

      {selectedAnalyticsUser && (
        <UserAnalyticsModal 
          user={selectedAnalyticsUser} 
          onClose={() => setSelectedAnalyticsUser(null)} 
        />
      )}
    </div>
  );
}
