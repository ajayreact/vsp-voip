const path = require('path');

if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL must be set for production builds');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo has lockfiles in repo root and web/; keep Turbopack scoped to this app.
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ['192.168.0.138', 'localhost', '127.0.0.1'],
  reactStrictMode: false,
  async redirects() {
    return [
      { source: '/admin/voice-quality', destination: '/admin/monitoring/quality', permanent: true },
      { source: '/admin/inventory', destination: '/admin/numbers', permanent: true },
      { source: '/admin/inventory/porting', destination: '/admin/numbers/porting', permanent: true },
      { source: '/admin/revenue', destination: '/admin/billing/revenue', permanent: true },
      { source: '/admin/orders', destination: '/admin/billing/orders', permanent: true },
      { source: '/admin/payments/stripe', destination: '/admin/settings/billing', permanent: true },
      { source: '/admin/payments/bank', destination: '/admin/settings/billing', permanent: true },
      { source: '/admin/trunking/lcr', destination: '/admin/settings/carrier', permanent: true },
      { source: '/admin/settings', destination: '/admin/settings/platform', permanent: true },
      { source: '/admin/audit', destination: '/admin/support/audit', permanent: true },
      { source: '/admin/security', destination: '/admin/settings/security', permanent: true },
    ];
  },
};

module.exports = nextConfig;
