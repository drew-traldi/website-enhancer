import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar'

export async function launchBrowser(): Promise<Browser> {
  const isLocal = process.env.NODE_ENV === 'development'

  return puppeteer.launch({
    args: isLocal
      ? ['--no-sandbox', '--disable-setuid-sandbox']
      : chromium.args,
    executablePath: isLocal
      ? undefined
      : await chromium.executablePath(CHROMIUM_PACK_URL),
    headless: true,
  })
}
