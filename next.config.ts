import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin uses Node.js native modules — must not be bundled by webpack
  serverExternalPackages: ["firebase-admin"],

  async redirects() {
    return [
      { source: "/products", destination: "/catalog", permanent: true },
      { source: "/thalis", destination: "/catalog", permanent: true },
      { source: "/staff", destination: "/catalog", permanent: true },
    ];
  },
};

export default nextConfig;

