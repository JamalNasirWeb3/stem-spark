import type { NextConfig } from "next";

// FastAPI backend. Requests to /api/* are proxied there so the browser (and the
// service worker) only ever talk to the Next.js origin.
const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // `next dev` only serves its client scripts to localhost by default. Without
  // this, opening http://127.0.0.1:<port> renders the page but nothing hydrates,
  // so every button is dead.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // The /api proxy times out after 30 s by default. Building a lesson plan
    // runs three Claude agents in sequence and can take a minute or more.
    proxyTimeout: 300_000,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
