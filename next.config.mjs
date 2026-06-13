/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
