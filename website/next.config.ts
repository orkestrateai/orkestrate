import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      { source: "/docs/extensions/introduction", destination: "/docs/harnesses/introduction", permanent: false },
      { source: "/docs/extensions/architecture", destination: "/docs/concepts", permanent: false },
      { source: "/docs/extensions/adapters", destination: "/docs/harnesses/authoring", permanent: false },
      { source: "/docs/extensions/registry", destination: "/docs/registry", permanent: false },
      { source: "/docs/publisher", destination: "/submit", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/registry",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Accept, Content-Type" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
