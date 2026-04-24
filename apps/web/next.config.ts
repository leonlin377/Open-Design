import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@opendesign/contracts", "@opendesign/ui"],
  experimental: {
    optimizePackageImports: ["@opendesign/ui"]
  }
};

export default nextConfig;
