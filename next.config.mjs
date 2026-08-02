/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
    ],
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'fullscreen=*, picture-in-picture=*, autoplay=*'
          }
        ]
      }
    ];
  },
  async rewrites() {
    return [
      { source: '/movie/:id', destination: '/movie' },
      { source: '/tv/:id', destination: '/tv' },
      { source: '/person/:id', destination: '/person' }
    ];
  }
};

export default nextConfig;
