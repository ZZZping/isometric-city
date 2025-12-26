/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // Aggressive caching for large static sprite sheets and screenshots.
    // These files are fingerprinted by filename (content updates change the file),
    // so immutable caching is safe and significantly improves repeat-load performance.
    const cache = 'public, max-age=31536000, immutable';
    return [
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: cache }],
      },
      {
        source: '/games/:path*',
        headers: [{ key: 'Cache-Control', value: cache }],
      },
    ];
  },
}

module.exports = nextConfig





