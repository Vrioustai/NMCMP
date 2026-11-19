/** @type {import('next').NextConfig} */

function apiOrigin() {
  const raw = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
  return raw.trim().replace(/\s+#.*$/, "") || "http://localhost:4000";
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const resetHeaders = securityHeaders.map((header) =>
  header.key === "Referrer-Policy" ? { key: header.key, value: "no-referrer" } : header,
);

const nextConfig = {
  transpilePackages: ["@movie/contracts"],
  images: { unoptimized: true },
  async rewrites() {
    const origin = apiOrigin();
    return [
      { source: "/api/:path*", destination: `${origin}/api/:path*` },
      { source: "/media/:path*", destination: `${origin}/media/:path*` },
    ];
  },
  async headers() {
    return [
      { source: "/reset-password", headers: resetHeaders },
      { source: "/((?!reset-password$).*)", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
