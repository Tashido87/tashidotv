import { catalogResponse } from '@/lib/tmdb-proxy.mjs';

export const revalidate = 3600;

export function GET(request, { params }) {
  return catalogResponse(request, params.path);
}
