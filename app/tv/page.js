'use client';

import { usePathname } from 'next/navigation';
import ClientDetailPage from '@/components/ClientDetailPage';
import TVShowsPage from '@/components/TVShowsPage';

export default function TVPage() {
  const pathname = usePathname();
  const pathParts = pathname ? pathname.split('/').filter(Boolean) : [];
  
  // If the URL is /tv/:id (e.g. /tv/2316 or /tv/1339713), render the show Detail View
  const possibleId = pathParts.length > 1 ? pathParts[1] : null;
  const isDetailPage = possibleId && possibleId !== 'tv';

  if (isDetailPage) {
    return <ClientDetailPage mediaType="tv" />;
  }

  // Otherwise (URL is /tv), render the TV Shows Catalogue Page
  return <TVShowsPage />;
}
