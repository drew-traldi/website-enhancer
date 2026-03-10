/**
 * Email Discovery Pipeline
 *
 * For rebuilt businesses, attempts to find a contact email via:
 *   1. Scraped email from the original website (stored during rebuild scrape)
 *   2. Crawl the business website for mailto: links
 *   3. Crawl common contact page paths
 *   4. Try common patterns (info@, contact@, hello@)
 */

import type { Page } from 'puppeteer-core'

export interface EmailDiscoveryResult {
  email: string | null
  source: 'scraped' | 'mailto' | 'contact_page' | 'pattern_guess' | 'none'
  allFound: string[]
}

const CONTACT_PATHS = [
  '/contact', '/contact-us', '/contactus',
  '/about', '/about-us', '/aboutus',
  '/get-in-touch', '/reach-us',
]

const COMMON_PREFIXES = ['info', 'contact', 'hello', 'office', 'admin', 'sales', 'support']

export async function discoverEmail(
  websiteUrl: string,
  page: Page
): Promise<EmailDiscoveryResult> {
  const result: EmailDiscoveryResult = { email: null, source: 'none', allFound: [] }
  const foundEmails = new Set<string>()

  try {
    const baseUrl = new URL(websiteUrl)
    const domain = baseUrl.hostname.replace(/^www\./, '')

    // Step 1: Scrape the homepage for emails
    try {
      await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await new Promise(r => setTimeout(r, 1500))
      const homeEmails = await extractEmailsFromPage(page)
      homeEmails.forEach(e => foundEmails.add(e))
    } catch { /* continue */ }

    // Step 2: Check common contact pages
    for (const path of CONTACT_PATHS) {
      if (foundEmails.size > 0) break
      try {
        const url = `${baseUrl.origin}${path}`
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
        if (response && response.status() < 400) {
          await new Promise(r => setTimeout(r, 1000))
          const pageEmails = await extractEmailsFromPage(page)
          pageEmails.forEach(e => foundEmails.add(e))
        }
      } catch { /* page doesn't exist, continue */ }
    }

    // Step 3: Try common email patterns via domain
    if (foundEmails.size === 0) {
      for (const prefix of COMMON_PREFIXES) {
        const guess = `${prefix}@${domain}`
        foundEmails.add(guess)
      }
      result.source = 'pattern_guess'
    }

    // Pick the best email
    result.allFound = Array.from(foundEmails)
    const realEmails = result.allFound.filter(e => !COMMON_PREFIXES.some(p => e.startsWith(`${p}@`)))

    if (realEmails.length > 0) {
      result.email = realEmails[0]
      result.source = 'mailto'
    } else if (result.allFound.length > 0 && result.source !== 'pattern_guess') {
      result.email = result.allFound[0]
      result.source = 'mailto'
    } else if (result.allFound.length > 0) {
      // Pattern guesses — pick info@ first
      const infoEmail = result.allFound.find(e => e.startsWith('info@'))
      result.email = infoEmail ?? result.allFound[0]
      result.source = 'pattern_guess'
    }
  } catch (err) {
    console.warn(`  [email-discovery] Error: ${(err as Error).message}`)
  }

  return result
}

async function extractEmailsFromPage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const emails = new Set<string>()
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

    // Check mailto: links
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      const href = a.getAttribute('href') ?? ''
      const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase()
      if (email && email.includes('@')) emails.add(email)
    })

    // Scan visible text
    const bodyText = document.body?.innerText ?? ''
    const matches = bodyText.match(emailRegex) ?? []
    matches.forEach(m => {
      const lower = m.toLowerCase()
      // Filter out common false positives
      if (!lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.endsWith('.svg') &&
          !lower.includes('example.com') && !lower.includes('sentry')) {
        emails.add(lower)
      }
    })

    return Array.from(emails)
  })
}
