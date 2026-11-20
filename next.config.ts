import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node-only packages that must not be bundled by Next.
  serverExternalPackages: ["pdf-parse", "@remotion/renderer", "@remotion/bundler"],
  experimental: { serverActions: { bodySizeLimit: "11mb" } }, // 10 MB PDFs + form overhead
};

export default nextConfig;
