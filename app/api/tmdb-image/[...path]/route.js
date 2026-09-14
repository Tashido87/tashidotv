import { imageResponse } from '@/lib/tmdb-proxy.mjs';

export const revalidate = 604800;

export function GET(request, { params }) {
  return imageResponse(request, params.path);
}
