import { getTrending } from '@/lib/tmdb';
import LandingClient from '@/components/LandingClient';

export const revalidate = 86400; // Revalidate trending backdrops once a day

export default async function LandingPage() {
  const trending = await getTrending('all', 'week');
  const trendingItems = trending?.results || [];

  return <LandingClient trendingItems={trendingItems} />;
}
