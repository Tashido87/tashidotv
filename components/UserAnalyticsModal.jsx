'use client';

import { useState, useEffect } from 'react';
import { X, Clock, PlayCircle, Activity, LayoutGrid } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { getUserWatchSessions, getAllWatchHistory } from '@/lib/db';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

export default function UserAnalyticsModal({ user, onClose }) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [continueHistory, setContinueHistory] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;

    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [watchLogs, contHistory] = await Promise.all([
          getUserWatchSessions(user.uid),
          getAllWatchHistory(user.uid)
        ]);
        if (mounted) {
          setSessions(watchLogs);
          setContinueHistory(contHistory);
        }
      } catch (err) {
        console.error('Failed to load user analytics', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [user]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // 1. Calculate Total Watch Hours
  const totalWatchHours = sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0) / 60;

  // 2. Activity Data (Last 7 Days)
  const activityData = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    // Find all sessions that occurred on this day
    const daySessions = sessions.filter(s => {
      const sDate = new Date(s.createdAt);
      return sDate.setHours(0, 0, 0, 0) === d.getTime();
    });

    const hours = daySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0) / 60;

    activityData.push({
      date: dateStr,
      hours: Number(hours.toFixed(2))
    });
  }

  // 3. Genre Distribution
  const genreCounts = {};
  sessions.forEach(s => {
    if (s.genres && s.genres.length > 0) {
      s.genres.forEach(g => {
        genreCounts[g.name || g] = (genreCounts[g.name || g] || 0) + 1;
      });
    }
  });

  const genreData = Object.entries(genreCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 genres

  // 4. Most Active Time
  const timeBuckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  sessions.forEach(s => {
    const hour = new Date(s.createdAt).getHours();
    if (hour >= 6 && hour < 12) timeBuckets.Morning += (s.durationMinutes || 0);
    else if (hour >= 12 && hour < 18) timeBuckets.Afternoon += (s.durationMinutes || 0);
    else if (hour >= 18 && hour < 24) timeBuckets.Evening += (s.durationMinutes || 0);
    else timeBuckets.Night += (s.durationMinutes || 0);
  });

  let mostActiveTime = 'N/A';
  let maxTime = -1;
  for (const [time, val] of Object.entries(timeBuckets)) {
    if (val > maxTime && val > 0) {
      maxTime = val;
      mostActiveTime = time;
    }
  }

  // 5. Completion Rate
  let completionRate = 0;
  if (continueHistory.length > 0) {
    let completedCount = 0;
    continueHistory.forEach(item => {
      if (item.duration > 0 && item.progress / item.duration > 0.9) {
        completedCount++;
      }
    });
    completionRate = Math.round((completedCount / continueHistory.length) * 100);
  }

  // 6. Recent History
  const recentHistory = sessions.slice(0, 3);

  return (
    <div className="fixed inset-0 z-[99999] flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-zinc-950 border-l border-white/10 h-full shadow-2xl flex flex-col overflow-hidden animate-slide-left">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold uppercase text-indigo-400">
                  {user?.displayName ? user.displayName[0] : 'U'}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">{user?.displayName || 'Guest User'}</h2>
              <p className="text-xs text-white/50 font-mono">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-4">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              <p className="text-xs text-white/40 tracking-widest uppercase font-bold">Aggregating Data...</p>
            </div>
          ) : sessions.length === 0 && continueHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 bg-white/5 rounded-2xl border border-white/5">
              <Activity className="w-8 h-8 text-white/20 mb-3" />
              <p className="text-sm text-white/40 font-medium">No watch history available for this user.</p>
            </div>
          ) : (
            <>
              {/* KPIs Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-indigo-400 mb-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Watch Hours</span>
                  </div>
                  <p className="text-2xl font-extrabold text-white">{totalWatchHours.toFixed(1)}h</p>
                </div>
                
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <PlayCircle className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Titles</span>
                  </div>
                  <p className="text-2xl font-extrabold text-white">{continueHistory.length}</p>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <Activity className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Active Time</span>
                  </div>
                  <p className="text-xl font-extrabold text-white mt-1">{mostActiveTime}</p>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-pink-400 mb-2">
                    <LayoutGrid className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Completion</span>
                  </div>
                  <p className="text-2xl font-extrabold text-white">{completionRate}%</p>
                </div>
              </div>

              {/* Activity Line Chart */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-6">Activity Trends (Last 7 Days)</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activityData}>
                      <XAxis 
                        dataKey="date" 
                        stroke="#ffffff40" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#ffffff40" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `${val}h`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff10', borderRadius: '12px', fontSize: '12px' }}
                        itemStyle={{ color: '#818cf8' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="hours" 
                        stroke="#818cf8" 
                        strokeWidth={3}
                        dot={{ fill: '#818cf8', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#fff' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tastes & Genres Bar Chart */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-6">Favorite Genres</h3>
                {genreData.length > 0 ? (
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={genreData} layout="vertical" margin={{ left: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          stroke="#ffffff60" 
                          fontSize={11} 
                          tickLine={false}
                          axisLine={false}
                          width={80}
                        />
                        <Tooltip 
                          cursor={{ fill: '#ffffff05' }}
                          contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff10', borderRadius: '12px', fontSize: '12px' }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {genreData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[100px] flex items-center justify-center text-xs text-white/30">
                    No genre data recorded yet.
                  </div>
                )}
              </div>

              {/* Recent Watch History */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">Recent Sessions</h3>
                {recentHistory.length > 0 ? (
                  <div className="space-y-3">
                    {recentHistory.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.title || 'Unknown Title'}</p>
                          <p className="text-[10px] text-white/40 mt-0.5">
                            {new Date(item.createdAt).toLocaleString()} • {item.mediaType?.toUpperCase()}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md">
                          {item.durationMinutes}m
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-white/30">No recent sessions found.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
