import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    minimumCacheTTL: 31536000, // 1 year — browser caches optimized images aggressively
    deviceSizes: [640, 750, 828, 1080],
    imageSizes: [36, 48, 64, 128, 256],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
      },
      {
        protocol: 'https',
        hostname: '**.jagadishvarma.xyz',
      },
      {
        protocol: 'http',
        hostname: '**.jagadishvarma.xyz',
      },
      {
        protocol: 'https',
        hostname: '**.s3.ap-south-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.s3.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
