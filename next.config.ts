import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin uses Node.js native modules -- must not be bundled by webpack
  serverExternalPackages: ["firebase-admin"],

  async redirects() {
    return [
      { source: "/products", destination: "/catalog", permanent: true },
      { source: "/thalis", destination: "/catalog", permanent: true },

      // ── Customer ordering: single canonical URL is /menu (Req #9) ──────────
      // /order was the old canonical URL — permanently moved to /menu
      { source: "/order", destination: "/menu", permanent: true },
      // Other legacy ordering shortcut names
      { source: "/thali-order", destination: "/menu", permanent: true },
      { source: "/place-order", destination: "/menu", permanent: true },

      // ── Admin: Daily Menu management page moved from /menu to /daily-menu ──
      // NOTE: /menu is now the CUSTOMER ordering page, not the admin menu editor.
      //       Admin users who bookmarked the old /menu will be redirected.
      //       However, /menu/[slug] public share links are NOT redirected (they still work).
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;

