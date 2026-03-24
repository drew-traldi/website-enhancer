import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'
import { existsSync } from 'fs'

const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar'

export async function launchBrowser(): Promise<Browser> {
  const isLocal = process.env.NODE_ENV === 'development'
  const executablePath = isLocal
    ? await resolveLocalChromePath()
    : await chromium.executablePath(CHROMIUM_PACK_URL)

  return puppeteer.launch({
    args: isLocal
      ? ['--no-sandbox', '--disable-setuid-sandbox']
      : chromium.args,
    executablePath,
    headless: true,
  })
}

async function resolveLocalChromePath(): Promise<string> {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROME_EXECUTABLE_PATH
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const macCandidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ]
  for (const path of macCandidates) {
    if (existsSync(path)) return path
  }

  return chromium.executablePath(CHROMIUM_PACK_URL)
}
