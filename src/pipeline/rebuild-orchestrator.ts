/**
 * Rebuild Orchestrator
 *
 * For each business with status='queued_for_rebuild':
 *   1. Scrape existing website
 *   2. Generate AI demo site (Claude)
 *   3. Deploy to GitHub Pages
 *   4. Take after-screenshots
 *   5. Update DB (rebuilds + businesses tables)
 */

import 'dotenv/config'
import puppeteer from 'puppeteer'
import { supabaseAdmin } from '@/lib/supabase'
import { scrapeWebsite } from './scraper'
import { buildSite }     from './builder'
import { deployToGitHubPages, waitForPages, buildSlug } from './deployer'
import { captureScreenshots } from './screenshot'

interface QueuedBusiness {
  id: string
  name: string
  website: string | null
  city_id: string
  cities: { name: string; state: string } | null
  rebuilds: Array<{ id: string }>
  website_scores: Array<{ overall_score: number | null }>
}

export interface RebuildResult {
  businessId:  string
  businessName: string
  success:     boolean
  pagesUrl:    string | null
  error:       string | null
}

export async function runRebuildPipeline(maxCount: number = 15): Promise<RebuildResult[]> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Website Enhancer — Rebuild Pipeline`)
  console.log(`${'='.repeat(60)}`)

  // ── Load queued businesses ─────────────────────────────────────────────────
  const { data: businesses, error: loadErr } = await supabaseAdmin
    .from('businesses')
    .select(`
      id, name, website, city_id,
      cities ( name, state ),
      rebuilds ( id ),
      website_scores ( overall_score )
    `)
    .eq('status', 'queued_for_rebuild')
    .limit(maxCount)

  if (loadErr) throw new Error(`Failed to load queued businesses: ${loadErr.message}`)
  if (!businesses?.length) {
    console.log('  No businesses queued for rebuild.')
    return []
  }

  const typed = businesses as unknown as QueuedBusiness[]
  console.log(`\n  ${typed.length} businesses queued for rebuild.\n`)

  // ── Launch browser ─────────────────────────────────────────────────────────
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const results: RebuildResult[] = []

  for (const biz of typed) {
    const cityName  = (biz.cities as { name: string; state: string } | null)?.name ?? ''
    const cityState = (biz.cities as { name: string; state: string } | null)?.state ?? ''
    const score     = biz.website_scores?.[0]?.overall_score ?? 5
    const rebuildId = biz.rebuilds?.[0]?.id

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`  Business: ${biz.name} (${cityName}, ${cityState})`)
    console.log(`  Original score: ${score?.toFixed(1) ?? '?'}/10`)
    console.log(`${'─'.repeat(50)}`)

    const result: RebuildResult = {
      businessId:   biz.id,
      businessName: biz.name,
      success:      false,
      pagesUrl:     null,
      error:        null,
    }

    try {
      // Mark as rebuilding
      await supabaseAdmin
        .from('businesses')
        .update({ status: 'rebuilding' })
        .eq('id', biz.id)

      if (rebuildId) {
        await supabaseAdmin
          .from('rebuilds')
          .update({ status: 'building' })
          .eq('id', rebuildId)
      }

      // ── 1. Scrape existing site ──────────────────────────────────────────
      const page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 800 })
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/120.0.0.0 Safari/537.36'
      )

      let scraped = null
      if (biz.website) {
        console.log(`\n  [1/4] Scraping ${biz.website}…`)
        scraped = await scrapeWebsite(biz.website, page)
        console.log(`  ✓ Scraped — found ${scraped.services.length} services`)
      } else {
        console.log(`  [1/4] No website URL — using placeholder content`)
      }

      // ── 2. Generate AI site ──────────────────────────────────────────────
      const slug = buildSlug(biz.name, cityName)
      console.log(`\n  [2/4] Generating AI demo site (slug: ${slug})…`)

      const buildResult = await buildSite(
        scraped ?? fallbackScraped(biz.name, cityName, cityState),
        biz.name,
        cityName,
        cityState,
        score,
        slug
      )
      console.log(`  ✓ HTML generated (${Math.round(buildResult.html.length / 1024)}KB)`)

      // ── 3. Deploy to GitHub Pages ────────────────────────────────────────
      console.log(`\n  [3/4] Deploying to GitHub Pages…`)
      const deploy = await deployToGitHubPages(slug, buildResult.html, biz.name)

      if (!deploy.deployed) {
        throw new Error(`Deploy failed: ${deploy.error}`)
      }
      console.log(`  ✓ Deployed: ${deploy.pagesUrl}`)

      // ── 4. Take after-screenshots (after Pages goes live) ────────────────
      console.log(`\n  [4/4] Taking after-screenshots…`)
      const isLive = await waitForPages(deploy.pagesUrl, 120_000)

      let afterUrls: string[] = []
      if (isLive) {
        try {
          await page.goto(deploy.pagesUrl, { waitUntil: 'networkidle2', timeout: 30000 })
          afterUrls = await captureScreenshots(page, slug, 'after')
          console.log(`  ✓ ${afterUrls.length} after-screenshots captured`)
        } catch (shotErr) {
          console.warn(`  ⚠ After-screenshot failed: ${(shotErr as Error).message}`)
        }
      } else {
        console.warn('  ⚠ Skipping after-screenshots — Pages not live in time')
      }

      await page.close()

      // ── 5. Save results to DB ────────────────────────────────────────────
      const afterUrlStr = afterUrls.length > 0 ? JSON.stringify(afterUrls) : null

      if (rebuildId) {
        await supabaseAdmin
          .from('rebuilds')
          .update({
            status:              'deployed',
            live_demo_url:       deploy.pagesUrl,
            github_repo_url:     deploy.repoUrl,
            screenshot_after_url: afterUrlStr,
            built_at:            new Date().toISOString(),
          })
          .eq('id', rebuildId)
      } else {
        await supabaseAdmin
          .from('rebuilds')
          .insert({
            business_id:         biz.id,
            status:              'deployed',
            live_demo_url:       deploy.pagesUrl,
            github_repo_url:     deploy.repoUrl,
            screenshot_after_url: afterUrlStr,
            built_at:            new Date().toISOString(),
          })
      }

      await supabaseAdmin
        .from('businesses')
        .update({ status: 'rebuilt' })
        .eq('id', biz.id)

      result.success  = true
      result.pagesUrl = deploy.pagesUrl
      console.log(`\n  ✅ ${biz.name} — DONE (${deploy.pagesUrl})`)

    } catch (err) {
      result.error = (err as Error).message
      console.error(`\n  ❌ ${biz.name} — FAILED: ${result.error}`)

      // Mark rebuild as failed
      await supabaseAdmin
        .from('businesses')
        .update({ status: 'queued_for_rebuild' })  // reset so it can be retried
        .eq('id', biz.id)

      if (rebuildId) {
        await supabaseAdmin
          .from('rebuilds')
          .update({ status: 'failed' })
          .eq('id', rebuildId)
      }
    }

    results.push(result)
  }

  await browser.close()

  // ── Summary ─────────────────────────────────────────────────────────────
  const succeeded = results.filter(r => r.success).length
  const failed    = results.filter(r => !r.success).length

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  REBUILD COMPLETE — ${succeeded} succeeded, ${failed} failed`)
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌'
    const info = r.success ? r.pagesUrl : r.error
    console.log(`  ${icon} ${r.businessName}: ${info}`)
  })
  console.log(`${'='.repeat(60)}\n`)

  return results
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function fallbackScraped(
  businessName: string,
  city: string,
  state: string
): Parameters<typeof import('./builder').buildSite>[0] {
  return {
    url:            '',
    businessName,
    tagline:        null,
    description:    `${businessName} serves the ${city}, ${state} community.`,
    phone:          null,
    email:          null,
    address:        `${city}, ${state}`,
    hours:          [],
    services:       [],
    teamMembers:    [],
    socialLinks:    {},
    primaryColor:   null,
    secondaryColor: null,
    logoText:       businessName,
    heroHeading:    `Welcome to ${businessName}`,
    heroSubheading: `Serving ${city}, ${state}`,
    ctaText:        'Contact Us',
    allBodyText:    `${businessName} is a local business in ${city}, ${state}.`,
    pageTitle:      businessName,
    metaDescription: null,
    scrapedAt:      new Date().toISOString(),
    error:          'No website to scrape',
  }
}
