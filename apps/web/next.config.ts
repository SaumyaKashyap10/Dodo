import type { NextConfig } from 'next';
import path from 'node:path';
const api = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  experimental: {
    agentUpgrade: 'security' as any,
  },
  async rewrites() {
    const isPreview =
      process.env.REFERENCE_READONLY_PREVIEW === 'true' ||
      process.env.JODO_READONLY_PREVIEW === 'true';
    if (isPreview) {
      return [{ source: '/media/:path*', destination: `${api}/v1/media/:path*` }];
    }
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        { source: '/api/:path*', destination: `${api}/:path*` },
        { source: '/media/:path*', destination: `${api}/v1/media/:path*` },
      ],
    };
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'" +
              (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') +
              "; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'" +
              (process.env.NODE_ENV === 'development' ? ' ws: wss:' : '') +
              "; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};
export default config;
