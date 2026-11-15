/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isolate the synthetic load-test build from the deployable application.
  distDir: process.env.CULTURE_LOAD_TEST === "1" ? ".next-culture-load" : ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ]
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uploads.lessantes.cat",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "cdn.appculturamataro.cat",
      },
    ],
  },
}

export default nextConfig
