import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
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
    ],
  },
};

export default nextConfig;
