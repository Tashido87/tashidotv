/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // IMG URLs use our cached image route, including plain <img> elements.
    // Avoid running a second image transformation on the same response.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
    ],
  },
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/movie/:id', destination: '/movie' },
      { source: '/tv/:id', destination: '/tv' },
      { source: '/person/:id', destination: '/person' }
    ];
  }
};

export default nextConfig;
