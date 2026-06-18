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
