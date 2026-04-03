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
  // Desativa a checagem de estilo (Lint) durante o build no Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
