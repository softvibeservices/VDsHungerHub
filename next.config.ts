import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin uses Node.js native modules -- must not be bundled by webpack
  serverExternalPackages: ["firebase-admin"],

  async redirects() {
    return [
      { source: "/products", destination: "/catalog", permanent: true },
      { source: "/thalis", destination: "/catalog", permanent: true },
      { source: "/staff", destination: "/catalog", permanent: true },
      // Legacy ordering URLs -- all redirect to canonical /order (customer ordering)
      { source: "/thali-order", destination: "/order", permanent: true },
      { source: "/place-order", destination: "/order", permanent: true },
    ];
  },
};

export default nextConfig;

