/** @type {import('next').NextConfig} */
const proxyTarget = process.env.API_PROXY_TARGET || "http://localhost:3001";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${proxyTarget}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;