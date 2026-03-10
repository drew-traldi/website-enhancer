/**
 * Stage 3: SCORE — Website Modernity Assessment
 *
 * Scores each website 1-10 across 8 weighted categories:
 * - Responsive Design   20%
 * - Visual Design Era   20%
 * - Performance         15%
 * - Security            10%
 * - Accessibility       10%
 * - Technical Stack     10%
 * - Content Quality     10%
 * - UX Patterns          5%
 *
 * Uses Puppeteer for headless rendering + Lighthouse for performance.
 */

import { type Browser, type Page } from 'puppeteer-core'

export interface CategoryScore {
  score: number       // 1-10
  details: Record<string, unknown>
}

export interface ScoringDetails {
  responsive: CategoryScore
  visualEra: CategoryScore
  performance: CategoryScore
  security: CategoryScore
  accessibility: CategoryScore
  techStack: CategoryScore
  contentQuality: CategoryScore
  ux: CategoryScore
  overall: number
  url: string
  loadedUrl: string
  errorFlag?: string
}

const WEIGHTS = {
  responsive:     0.20,
  visualEra:      0.20,
  performance:    0.15,
  security:       0.10,
  accessibility:  0.10,
  techStack:      0.10,
  contentQuality: 0.10,
  ux:             0.05,
}

// ─── Heuristic helpers ────────────────────────────────────────────────────────

async function evaluateHeuristics(page: Page, url: string): Promise<Omit<ScoringDetails, 'performance' | 'overall' | 'url' | 'loadedUrl'> & { performance: CategoryScore }> {
  // Run all DOM analysis in a single page.evaluate call for efficiency
  const dom = await page.evaluate(() => {
    const html = document.documentElement.outerHTML.toLowerCase()
    const bodyText = document.body?.innerText ?? ''
    const allStyles = Array.from(document.styleSheets)
      .flatMap((ss) => {
        try { return Array.from(ss.cssRules).map((r) => r.cssText) }
        catch { return [] }
      })
      .join(' ')
      .toLowerCase()

    // ── RESPONSIVE (20%) ──────────────────────────────────────────
    const hasViewportMeta = !!document.querySelector('meta[name="viewport"]')
    const hasMediaQueries = allStyles.includes('@media')
    const hasFlexbox = allStyles.includes('display:flex') || allStyles.includes('display: flex')
    const hasGrid = allStyles.includes('display:grid') || allStyles.includes('display: grid')
    const hasTableLayout = (html.match(/<table/g) ?? []).length > 2 && !allStyles.includes('display:table')
    const hasSrcset = !!document.querySelector('img[srcset], picture source')
    const hasMobileHamburger = !!document.querySelector('[class*="hamburger"], [class*="mobile-menu"], [class*="nav-toggle"], [aria-label*="menu"]')

    const responsiveDetails = { hasViewportMeta, hasMediaQueries, hasFlexbox, hasGrid, hasTableLayout, hasSrcset, hasMobileHamburger }
    let responsiveScore = 1
    if (hasViewportMeta) responsiveScore += 2
    if (hasMediaQueries) responsiveScore += 2
    if (hasFlexbox || hasGrid) responsiveScore += 2
    if (!hasTableLayout) responsiveScore += 1
    if (hasSrcset) responsiveScore += 1
    if (hasMobileHamburger) responsiveScore += 1
    responsiveScore = Math.min(10, responsiveScore)

    // ── VISUAL ERA (20%) ──────────────────────────────────────────
    const hasGoogleFonts = html.includes('fonts.googleapis.com') || html.includes('fonts.gstatic.com')
    const hasSystemFontsOnly = !hasGoogleFonts && (
      allStyles.includes('arial') || allStyles.includes('times new roman') ||
      allStyles.includes('courier') || allStyles.includes('georgia')
    )
    const hasFlash = html.includes('<object') || html.includes('<embed') || html.includes('.swf')
    const hasInlineStyles = (html.match(/style="/g) ?? []).length > 10
    const copyrightMatch = bodyText.match(/©\s*(19\d{2}|200\d|201[0-5])/i)
    const hasOldCopyright = !!copyrightMatch
    const hasTailwind = html.includes('tailwind') || allStyles.includes('tailwindcss')
    const hasBootstrap = html.includes('bootstrap')
    const hasModernUI = hasTailwind || hasBootstrap || hasGrid || hasFlexbox

    // Check CMS / generator meta
    const generatorMeta = document.querySelector('meta[name="generator"]')?.getAttribute('content') ?? ''
    const oldCMS = /wordpress [3-4]\.|drupal [5-7]\.|joomla 1\./i.test(generatorMeta)

    const visualDetails = { hasGoogleFonts, hasSystemFontsOnly, hasFlash, hasInlineStyles, hasOldCopyright, hasTailwind, hasBootstrap, hasModernUI, oldCMS, copyrightYear: copyrightMatch?.[1] }
    let visualScore = 5
    if (hasGoogleFonts) visualScore += 1
    if (hasSystemFontsOnly) visualScore -= 2
    if (hasFlash) visualScore -= 3
    if (hasInlineStyles) visualScore -= 1
    if (hasOldCopyright) visualScore -= 2
    if (hasModernUI) visualScore += 2
    if (oldCMS) visualScore -= 1
    visualScore = Math.max(1, Math.min(10, visualScore))

    // ── SECURITY (10%) ────────────────────────────────────────────
    const isHttps = window.location.protocol === 'https:'
    const hasMixedContent = !isHttps ? false : html.includes('src="http://') || html.includes("src='http://")
    const securityDetails = { isHttps, hasMixedContent }
    let securityScore = isHttps ? 8 : 1
    if (hasMixedContent) securityScore -= 2
    securityScore = Math.max(1, Math.min(10, securityScore))

    // ── ACCESSIBILITY (10%) ───────────────────────────────────────
    const images = Array.from(document.querySelectorAll('img'))
    const imagesWithAlt = images.filter((i) => i.alt && i.alt.trim().length > 0).length
    const altRatio = images.length > 0 ? imagesWithAlt / images.length : 1
    const hasH1 = !!document.querySelector('h1')
    const hasSkipLink = !!document.querySelector('a[href="#main"], a[href="#content"]')
    const hasAriaLabels = document.querySelectorAll('[aria-label]').length > 0
    const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6').length

    const a11yDetails = { altRatio: Math.round(altRatio * 100), hasH1, hasSkipLink, hasAriaLabels, headings, totalImages: images.length }
    let a11yScore = 3
    if (altRatio > 0.8) a11yScore += 2
    if (hasH1) a11yScore += 2
    if (headings > 2) a11yScore += 1
    if (hasAriaLabels) a11yScore += 1
    if (hasSkipLink) a11yScore += 1
    a11yScore = Math.min(10, a11yScore)

    // ── TECH STACK (10%) ─────────────────────────────────────────
    const hasJQuery = !!(window as Window & { jQuery?: unknown }).jQuery
    const hasReact = !!(window as Window & { React?: unknown; __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }).React ||
      !!document.querySelector('[data-reactroot], #__next, #root')
    const hasVue = !!(window as Window & { Vue?: unknown; __vue_app__?: unknown }).__vue_app__ || !!document.querySelector('#app[data-v-app]')
    const hasModernJS = hasReact || hasVue || html.includes('type="module"')
    const hasJQueryOnly = hasJQuery && !hasModernJS

    const techDetails = { hasJQuery, hasReact, hasVue, hasModernJS, hasJQueryOnly, hasTailwind, hasBootstrap }
    let techScore = 5
    if (hasModernJS) techScore += 3
    if (hasJQueryOnly) techScore -= 2
    if (hasTailwind) techScore += 2
    if (hasBootstrap) techScore += 1
    if (hasJQuery && !hasModernJS) techScore -= 1
    techScore = Math.max(1, Math.min(10, techScore))

    // ── CONTENT QUALITY (10%) ─────────────────────────────────────
    const brokenImages = images.filter((i) => !i.complete || i.naturalWidth === 0).length
    const links = Array.from(document.querySelectorAll('a[href]'))
    const hasContactInfo = bodyText.includes('phone') || bodyText.includes('email') ||
      bodyText.includes('contact') || !!document.querySelector('a[href^="tel:"], a[href^="mailto:"]')
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length

    const contentDetails = { brokenImages, totalImages: images.length, wordCount, hasContactInfo, totalLinks: links.length }
    let contentScore = 5
    if (brokenImages === 0) contentScore += 2
    if (brokenImages > 2) contentScore -= 2
    if (hasContactInfo) contentScore += 1
    if (wordCount > 200) contentScore += 1
    if (!hasOldCopyright) contentScore += 1
    contentScore = Math.max(1, Math.min(10, contentScore))

    // ── UX PATTERNS (5%) ─────────────────────────────────────────
    const hasNav = !!document.querySelector('nav, [role="navigation"]')
    const hasCTA = !!document.querySelector('[class*="cta"], [class*="btn"], button, a.button') ||
      bodyText.toLowerCase().includes('contact us') || bodyText.toLowerCase().includes('get started') ||
      bodyText.toLowerCase().includes('call us') || bodyText.toLowerCase().includes('book')
    const hasSearch = !!document.querySelector('input[type="search"], [class*="search"]')

    const uxDetails = { hasNav, hasCTA, hasSearch }
    let uxScore = 3
    if (hasNav) uxScore += 3
    if (hasCTA) uxScore += 3
    if (hasSearch) uxScore += 1
    uxScore = Math.min(10, uxScore)

    return {
      responsive: { score: responsiveScore, details: responsiveDetails },
      visualEra: { score: visualScore, details: visualDetails },
      security: { score: securityScore, details: securityDetails },
      accessibility: { score: a11yScore, details: a11yDetails },
      techStack: { score: techScore, details: techDetails },
      contentQuality: { score: contentScore, details: contentDetails },
      ux: { score: uxScore, details: uxDetails },
    }
  })

  return {
    ...dom,
    performance: { score: 5, details: { note: 'Lighthouse pending' } }, // placeholder, overwritten below
  }
}

// ─── Lighthouse performance score ─────────────────────────────────────────────

async function runLighthouse(url: string, wsEndpoint: string): Promise<CategoryScore> {
  try {
    // Dynamic import — lighthouse is ESM
    const { default: lighthouse } = await import('lighthouse')

    const result = await lighthouse(url, {
      port: parseInt(new URL(wsEndpoint).port),
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
      formFactor: 'desktop',
      throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
    })

    const lhScore = (result?.lhr?.categories?.performance?.score ?? 0.5) as number
    // Map Lighthouse 0-1 score to our 1-10 scale
    const mapped = Math.max(1, Math.round(lhScore * 9) + 1)

    return {
      score: mapped,
      details: {
        lighthouseScore: Math.round(lhScore * 100),
        fcp: result?.lhr?.audits?.['first-contentful-paint']?.displayValue,
        lcp: result?.lhr?.audits?.['largest-contentful-paint']?.displayValue,
        tbt: result?.lhr?.audits?.['total-blocking-time']?.displayValue,
        cls: result?.lhr?.audits?.['cumulative-layout-shift']?.displayValue,
      },
    }
  } catch (err) {
    // Lighthouse failures are non-fatal — use a neutral score
    return { score: 5, details: { error: (err as Error).message } }
  }
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

export async function scoreWebsite(
  url: string,
  browser: Browser
): Promise<ScoringDetails> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
  let loadedUrl = normalizedUrl
  let errorFlag: string | undefined

  const page = await browser.newPage()

  try {
    await page.setViewport({ width: 1280, height: 800 })
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Navigate with a 20s timeout — skip if site times out
    try {
      const response = await page.goto(normalizedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      })
      loadedUrl = page.url()
      if (response && response.status() >= 400) {
        errorFlag = `http_${response.status()}`
      }
    } catch (navErr) {
      errorFlag = (navErr as Error).message.substring(0, 80)
    }

    // Wait a bit for JS to settle
    await page.waitForNetworkIdle({ timeout: 5000, idleTime: 500 }).catch(() => {})

    // Run DOM heuristics
    const heuristics = await evaluateHeuristics(page, loadedUrl)

    // Run Lighthouse for performance
    const wsEndpoint = browser.wsEndpoint()
    const perf = await runLighthouse(loadedUrl, wsEndpoint)

    // Calculate weighted overall score (1-10)
    const scores = {
      responsive:     heuristics.responsive.score,
      visualEra:      heuristics.visualEra.score,
      performance:    perf.score,
      security:       heuristics.security.score,
      accessibility:  heuristics.accessibility.score,
      techStack:      heuristics.techStack.score,
      contentQuality: heuristics.contentQuality.score,
      ux:             heuristics.ux.score,
    }

    const overall = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => {
      return sum + scores[key as keyof typeof scores] * weight
    }, 0)

    return {
      ...heuristics,
      performance: perf,
      overall: Math.max(1, Math.min(10, Math.round(overall * 10) / 10)),
      url: normalizedUrl,
      loadedUrl,
      ...(errorFlag ? { errorFlag } : {}),
    }
  } finally {
    await page.close()
  }
}

// ─── Browser lifecycle ────────────────────────────────────────────────────────

export { launchBrowser } from '@/lib/browser'
