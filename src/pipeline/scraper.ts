/**
 * Website Scraper
 *
 * Extracts structured content from an existing business website to use
 * as context for the AI-powered rebuild.
 */

import type { Browser, Page } from 'puppeteer-core'

export interface ScrapedSite {
  url: string
  businessName: string
  tagline: string | null
  description: string | null
  phone: string | null
  email: string | null
  address: string | null
  hours: string[]
  services: string[]
  teamMembers: string[]
  socialLinks: Record<string, string>
  primaryColor: string | null
  secondaryColor: string | null
  logoText: string | null
  heroHeading: string | null
  heroSubheading: string | null
  ctaText: string | null
  allBodyText: string        // truncated raw text — fed to Claude
  pageTitle: string | null
  metaDescription: string | null
  scrapedAt: string
  error: string | null
}

export async function scrapeWebsite(url: string, page: Page): Promise<ScrapedSite> {
  const result: ScrapedSite = {
    url,
    businessName:   '',
    tagline:        null,
    description:    null,
    phone:          null,
    email:          null,
    address:        null,
    hours:          [],
    services:       [],
    teamMembers:    [],
    socialLinks:    {},
    primaryColor:   null,
    secondaryColor: null,
    logoText:       null,
    heroHeading:    null,
    heroSubheading: null,
    ctaText:        null,
    allBodyText:    '',
    pageTitle:      null,
    metaDescription: null,
    scrapedAt:      new Date().toISOString(),
    error:          null,
  }

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 1500)) // let JS render

    const scraped = await page.evaluate(() => {
      const getText = (sel: string): string =>
        (document.querySelector(sel)?.textContent ?? '').trim()
      const getAttr = (sel: string, attr: string): string | null =>
        document.querySelector(sel)?.getAttribute(attr) ?? null

      // ── Page meta ──────────────────────────────────────────────────────────
      const pageTitle  = document.title ?? null
      const metaDesc   = getAttr('meta[name="description"]', 'content') ??
                         getAttr('meta[property="og:description"]', 'content')

      // ── Business name ──────────────────────────────────────────────────────
      const businessName =
        getAttr('meta[property="og:site_name"]', 'content') ||
        getText('[class*="logo"] [class*="name"], [id*="logo"] [class*="name"]') ||
        getText('header h1, .header h1') ||
        pageTitle?.split(/[-|•]/)[0].trim() || ''

      // ── Hero section ───────────────────────────────────────────────────────
      const heroEl = document.querySelector(
        'section.hero, #hero, .hero, [class*="hero"], [class*="banner"], header'
      )
      const heroHeading   = (heroEl?.querySelector('h1, h2')?.textContent ?? '').trim() || null
      const heroSub       = (heroEl?.querySelector('h2, h3, p')?.textContent ?? '').trim() || null
      const ctaEl         = heroEl?.querySelector('a[href], button')
      const ctaText       = ctaEl ? (ctaEl.textContent ?? '').trim() : null

      // ── Logo text ──────────────────────────────────────────────────────────
      const logoText = getText('[class*="logo"], [id*="logo"], .brand, .site-name') || null

      // ── Contact info via regex on full body text ───────────────────────────
      const bodyText = (document.body?.innerText ?? '').substring(0, 8000)

      const phoneMatch = bodyText.match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/)
      const emailMatch = bodyText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)

      // ── Services / offerings ───────────────────────────────────────────────
      const serviceHeaders = [
        ...document.querySelectorAll(
          '[class*="service"] h2, [class*="service"] h3, ' +
          '[class*="service"] li, [id*="service"] h3, ' +
          '[class*="offering"] h3, [class*="offering"] li, ' +
          '.menu-item, [class*="product"] h3'
        )
      ]
        .map(el => el.textContent?.trim())
        .filter((t): t is string => !!t && t.length > 2 && t.length < 80)
        .slice(0, 15)

      // ── Hours ──────────────────────────────────────────────────────────────
      const hoursText = [
        ...document.querySelectorAll(
          '[class*="hour"], [class*="schedule"], [class*="time"] li, ' +
          '[class*="opening"] li'
        )
      ]
        .map(el => el.textContent?.trim())
        .filter((t): t is string => !!t && t.length > 3 && t.length < 80)
        .slice(0, 10)

      // ── Team ───────────────────────────────────────────────────────────────
      const teamText = [
        ...document.querySelectorAll('[class*="team"] h3, [class*="team"] h4, [class*="staff"] h3')
      ]
        .map(el => el.textContent?.trim())
        .filter((t): t is string => !!t && t.length > 1 && t.length < 50)
        .slice(0, 8)

      // ── Social links ───────────────────────────────────────────────────────
      const socialLinks: Record<string, string> = {}
      const socialPatterns: Record<string, string> = {
        facebook:  'facebook.com',
        instagram: 'instagram.com',
        twitter:   'twitter.com',
        linkedin:  'linkedin.com',
        youtube:   'youtube.com',
        yelp:      'yelp.com',
      }
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') ?? ''
        for (const [key, domain] of Object.entries(socialPatterns)) {
          if (href.includes(domain) && !socialLinks[key]) {
            socialLinks[key] = href
          }
        }
      })

      // ── Colors via computed styles ─────────────────────────────────────────
      const bodyBg    = getComputedStyle(document.body).backgroundColor
      const headerEl  = document.querySelector('header, nav, .header, .navbar')
      const headerBg  = headerEl ? getComputedStyle(headerEl).backgroundColor : null

      // ── Address ────────────────────────────────────────────────────────────
      const addrMatch = bodyText.match(
        /\d+\s+[A-Za-z0-9\s,.']+(?:Ave|Blvd|Dr|Hwy|Ln|Pkwy|Pl|Rd|St|Way|Suite|Ste)\b[^$\n]{0,50}/i
      )

      return {
        pageTitle,
        metaDesc,
        businessName,
        heroHeading,
        heroSub,
        ctaText,
        logoText,
        phone:     phoneMatch?.[0] ?? null,
        email:     emailMatch?.[0] ?? null,
        address:   addrMatch?.[0]?.trim() ?? null,
        services:  serviceHeaders,
        hours:     hoursText,
        teamMembers: teamText,
        socialLinks,
        primaryColor:   headerBg || bodyBg || null,
        allBodyText: bodyText,
      }
    })

    result.pageTitle      = scraped.pageTitle
    result.metaDescription = scraped.metaDesc
    result.businessName   = scraped.businessName
    result.heroHeading    = scraped.heroHeading
    result.heroSubheading = scraped.heroSub
    result.ctaText        = scraped.ctaText
    result.logoText       = scraped.logoText
    result.phone          = scraped.phone
    result.email          = scraped.email
    result.address        = scraped.address
    result.services       = scraped.services
    result.hours          = scraped.hours
    result.teamMembers    = scraped.teamMembers
    result.socialLinks    = scraped.socialLinks
    result.primaryColor   = scraped.primaryColor
    result.allBodyText    = scraped.allBodyText

  } catch (err) {
    result.error = (err as Error).message
    console.warn(`  [scraper] Failed to scrape ${url}: ${result.error}`)
  }

  return result
}
