import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/products", destination: "/catalog", permanent: true },
      { source: "/thalis", destination: "/catalog", permanent: true },
      { source: "/staff", destination: "/catalog", permanent: true },
    ];
  },
};

export default nextConfig;
