import { getMovieDetails, getMovieRecommendations, discoverMedia } from '@/lib/tmdb';
import DetailView from '@/components/DetailView';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const data = await getMovieDetails(params.id);
  if (!data) return { title: 'Not Found' };
  return {
    title: `${data.title} — Tashido TV`,
    description: data.overview,
  };
}

export default async function MoviePage({ params, searchParams }) {
  const data = await getMovieDetails(params.id);
  if (!data) notFound();

  // 1. Extract primary genres
  const genreIds = data.genres?.map((g) => g.id) || [];
  const isAnimation = genreIds.includes(16);

  // 2. Fetch curated user-behavior recommendations
  let recommendations = [];
  try {
    const recsRes = await getMovieRecommendations(params.id);
    recommendations = recsRes?.results || [];
  } catch (err) {
    console.error('Error fetching movie recommendations:', err);
  }

  // Filter out the current movie
  let filteredRecs = recommendations.filter((m) => m.id !== Number(params.id));

  let similarItems = [];

  if (isAnimation) {
    // Keep animations from recommendations
    const recsAnimations = filteredRecs.filter((m) => m.genre_ids?.includes(16));

    // If fewer than 6 animations in curated recommendations, fallback to or combine with discover animation movies
    if (recsAnimations.length < 6) {
      let discoverAnimations = [];
      try {
        const discoverRes = await discoverMedia('movie', {
          with_genres: '16',
          sort_by: 'popularity.desc',
          page: 1,
        });
        discoverAnimations = discoverRes?.results?.filter((m) => m.id !== Number(params.id)) || [];
      } catch (err) {
        console.error('Error fetching discover animation movies:', err);
      }

      // Combine recommendations (animations first) and discover animation movies
      const combined = [...recsAnimations, ...discoverAnimations];
      const seen = new Set();
      similarItems = combined.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    } else {
      similarItems = recsAnimations;
    }
  } else {
    // For non-animation movies:
    // If fewer than 6 curated recommendations in total, fallback to or combine with discover
    if (filteredRecs.length < 6) {
      let discoverItems = [];
      if (genreIds.length > 0) {
        try {
          // Try with AND condition (comma-separated) first
          const genresParam = genreIds.join(',');
          const discoverRes = await discoverMedia('movie', {
            with_genres: genresParam,
            sort_by: 'popularity.desc',
            page: 1,
          });
          discoverItems = discoverRes?.results?.filter((m) => m.id !== Number(params.id)) || [];

          // If AND returned fewer than 6, fallback to OR condition (pipe-separated) to match any of the genres
          if (discoverItems.length < 6) {
            const orGenresParam = genreIds.join('|');
            const discoverResOr = await discoverMedia('movie', {
              with_genres: orGenresParam,
              sort_by: 'popularity.desc',
              page: 1,
            });
            discoverItems = discoverResOr?.results?.filter((m) => m.id !== Number(params.id)) || [];
          }
        } catch (err) {
          console.error('Error fetching discover movies:', err);
        }
      }

      const combined = [...filteredRecs, ...discoverItems];
      const seen = new Set();
      similarItems = combined.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    } else {
      similarItems = filteredRecs;
    }
  }

  // Ensure similarItems does not contain the current movie
  similarItems = similarItems.filter((m) => m.id !== Number(params.id));

  return <DetailView data={data} mediaType="movie" autoPlay={searchParams?.play === '1'} similarItems={similarItems} />;
}
