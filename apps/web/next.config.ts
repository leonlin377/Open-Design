import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@opendesign/contracts", "@opendesign/ui"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    optimizePackageImports: ["@opendesign/ui"]
  }
};

export default nextConfig;
