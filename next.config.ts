import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['lighthouse', 'puppeteer'],
};

export default nextConfig;
