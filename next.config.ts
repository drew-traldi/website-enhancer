import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['lighthouse', 'puppeteer-core', '@sparticuz/chromium'],
};

export default nextConfig;
