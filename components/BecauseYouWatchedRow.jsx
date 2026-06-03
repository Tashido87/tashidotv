'use client';

import { useState, useEffect } from 'react';
import ContentRow from './ContentRow';
import { useAuth } from '@/components/AuthProvider';
import { subscribeWatchHistory } from '@/lib/db';
import { fetchRecommendations } from '@/lib/tmdb';

export default function BecauseYouWatchedRow({ mediaId, mediaType, title }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch TMDB Recommendations
  useEffect(() => {
    if (!mediaId) {
      setRecommendations([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRecommendations() {
      setLoading(true);
      try {
        const results = await fetchRecommendations(mediaId, mediaType || 'movie');
        if (!cancelled) {
          setRecommendations(results);
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        if (!cancelled) {
          setRecommendations([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [mediaId, mediaType]);

  // Render Row
  if (loading || !mediaId || recommendations.length === 0) return null;

  const rowTitle = `Because you watched "${title}"`;

  return (
    <ContentRow
      title={rowTitle}
      items={recommendations}
      mediaType={mediaType || 'movie'}
      variant="poster"
    />
  );
}
