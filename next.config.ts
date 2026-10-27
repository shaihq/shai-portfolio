import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A package-lock.json in the home folder otherwise makes Next guess the wrong root.
  turbopack: { root: process.cwd() },
  // Let phones on the home network use the dev server (npm run dev). Without this,
  // Next blocks its scripts for any address but localhost and the page stays on the loader.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
  // Pictures are served as AVIF (or WebP where AVIF isn't supported), resized to the
  // width each screen needs. 85 is for product screenshots, where text must stay
  // crisp; 60 for the faint card reflections.
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 85],
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
  // The case-study media and the mascot change rarely: let browsers keep them for a
  // week and refresh them quietly after that.
  async headers() {
    const cache = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=31536000" }];
    return [
      // Media only (/projects/<folder>/<file>), never the pages (/projects/<slug>).
      { source: "/projects/:folder/:file", headers: cache },
      { source: "/mascot/:path*", headers: cache },
    ];
  },
};

export default nextConfig;
