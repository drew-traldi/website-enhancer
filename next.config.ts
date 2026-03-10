import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['lighthouse', 'puppeteer-core', '@sparticuz/chromium-min'],
};

export default nextConfig;
