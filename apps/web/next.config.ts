import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The API base URL is read server-side only. It is deliberately NOT a
  // NEXT_PUBLIC_ variable — the browser never talks to the API directly.
  typedRoutes: true,
  experimental: {
    // Photos are downscaled in the browser before upload, but ten of them
    // still exceed the 1MB default.
    serverActions: { bodySizeLimit: '12mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
