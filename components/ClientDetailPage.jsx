'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import DetailView from '@/components/DetailView';
import { getMovieDetails, getTVDetails } from '@/lib/tmdb';

export default function ClientDetailPage({ mediaType }) {
  const params = useParams();
  const pathname = usePathname();
  const id = params?.id || (pathname ? pathname.split('/').pop() : null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    async function loadDetails() {
      setLoading(true);
      try {
        const detail = mediaType === 'tv'
          ? await getTVDetails(id)
          : await getMovieDetails(id);

        if (!cancelled) {
          setData(detail);
        }
      } catch (err) {
        console.error('Error loading title details:', err);
        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [id, mediaType]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-white/70" />
        <p className="text-[12px] tracking-[0.25em] uppercase text-white/40">Loading</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-6 text-center">
        <div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/40 mb-3">Not Found</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-platinum mb-4">
            We could not find that title.
          </h1>
        </div>
      </div>
    );
  }

  return <DetailView data={data} mediaType={mediaType} />;
}
