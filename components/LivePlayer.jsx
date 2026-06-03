'use client';

import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { useEffect } from 'react';

const ReactPlayer = dynamic(() => import('react-player/lazy'), { ssr: false });

export default function LivePlayer({ channel, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!channel) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center animate-fade-in">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 transition"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute top-5 left-6 z-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden flex items-center justify-center">
          {channel.logo ? (
            <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-1" />
          ) : (
            <span className="text-xs font-semibold">{channel.name[0]}</span>
          )}
        </div>
        <div>
          <p className="text-[14px] font-semibold">{channel.name}</p>
          <p className="text-[11px] text-white/50 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE · {channel.category}
          </p>
        </div>
      </div>

      <div className="w-full max-w-7xl aspect-video mx-4 rounded-2xl overflow-hidden shadow-2xl bg-black">
        <ReactPlayer
          url={channel.url}
          playing
          controls
          width="100%"
          height="100%"
          config={{
            file: {
              forceHLS: true,
              attributes: { crossOrigin: 'anonymous' },
            },
          }}
        />
      </div>
    </div>
  );
}
