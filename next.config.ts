import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "media.rawg.io" }],
  },
};

export default nextConfig;
