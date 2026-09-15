import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.igdb.com" }],
  },
};

export default nextConfig;
