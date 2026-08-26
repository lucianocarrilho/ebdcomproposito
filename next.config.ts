import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Desativa a checagem de tipos (TypeScript) durante o build no Vercel
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
