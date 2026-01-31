import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid build failure from ESLint "Plugin '' not found" when using legacy eslint-config-next with flat config
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kolleris.b-cdn.net",
      },
      {
        protocol: "https",
        hostname: "*.b-cdn.net",
      },
      {
        protocol: "https",
        hostname: "storage.bunnycdn.com",
      },
    ],
  },
};

export default nextConfig;
