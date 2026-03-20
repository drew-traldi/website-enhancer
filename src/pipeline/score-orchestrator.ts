/**
 * Score Orchestrator
 *
 * For a given city:
 * 1. Load all filtered (status='filtered') businesses from Supabase
 * 2. Score each website (Puppeteer + Lighthouse + heuristics)
 * 3. Capture 1-3 before-screenshots → Supabase Storage
 * 4. Write website_scores rows to Supabase
 * 5. Select the bottom BATCH_SIZE businesses (lowest scores)
 * 6. Mark them queued_for_rebuild
 */

import 'dotenv/config'
import { supabaseAdmin } from '@/lib/supabase'
import { scoreWebsite, launchBrowser } from './score'
import { captureScreenshots, buildSlug } from './screenshot'
import { generateScoreNarrativesFromScoring } from './score-narrative'
import type { Business } from '@/types/database'

const BATCH_SIZE = 15

export interface ScoreRunResult {
  city: string
  totalScored: number
  queued: number
  skipped: number
  batchSize: number
}

export async function runScoring(cityInput: string): Promise<ScoreRunResult> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Website Enhancer — Scoring Pipeline`)
  console.log(`  City: ${cityInput}`)
  console.log(`${'='.repeat(60)}`)

  // ── Step 1: Load city + filtered businesses ───────────────────
  console.log('\n[1/4] Loading filtered businesses from database...')
  const cityName = cityInput.split(',')[0].trim()
  const cityState = cityInput.split(',')[1]?.trim() ?? ''

  const { data: city } = await supabaseAdmin
    .from('cities')
    .select('*')
    .ilike('name', cityName)
    .ilike('state', cityState)
    .single()

  if (!city) throw new Error(`City not found in DB: "${cityInput}". Run discover first.`)

  const { data: businesses, error } = await supabaseAdmin
    .from('businesses')
    .select('*')
    .eq('city_id', city.id)
    .eq('status', 'filtered')
    .not('website', 'is', null)

  if (error) throw new Error(`Failed to load businesses: ${error.message}`)
  if (!businesses?.length) {
    console.log('  ⚠ No filtered businesses to score. Run discover first.')
    return { city: cityInput, totalScored: 0, queued: 0, skipped: 0, batchSize: BATCH_SIZE }
  }

  console.log(`  ✓ ${businesses.length} businesses to score`)

  // ── Step 2: Launch browser ────────────────────────────────────
  console.log('\n[2/4] Launching headless browser...')
  const browser = await launchBrowser()
  console.log('  ✓ Browser ready')

  let totalScored = 0
  let skipped = 0
  const scored: Array<{ business: Business; overallScore: number }> = []

  // ── Step 3: Score each website ────────────────────────────────
  console.log(`\n[3/4] Scoring ${businesses.length} websites...`)

  for (let i = 0; i < businesses.length; i++) {
    const biz = businesses[i] as Business
    const url = biz.website!
    const slug = buildSlug(biz.name, `${city.name}-${city.state}`)

    process.stdout.write(`  [${i + 1}/${businesses.length}] ${biz.name.substring(0, 40).padEnd(40)} `)

    try {
      // Score the website
      const scoring = await scoreWebsite(url, browser)

      // Capture before-screenshots
      const page = (await browser.pages())[0] // reuse the scoring page context
      // Re-open page for screenshots (score() closes it)
      const screenshotPage = await browser.newPage()
      await screenshotPage.setViewport({ width: 1280, height: 800 })
      try {
        await screenshotPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await screenshotPage.waitForNetworkIdle({ timeout: 3000, idleTime: 500 }).catch(() => {})
      } catch { /* screenshot on partial load is fine */ }

      const screenshotUrls = await captureScreenshots(screenshotPage, slug, 'before')
      await screenshotPage.close()

      // Primary screenshot = first URL
      const primaryScreenshot = screenshotUrls[0] ?? null

      const baseDetails = {
        responsive: scoring.responsive.details,
        visualEra: scoring.visualEra.details,
        performance: scoring.performance.details,
        security: scoring.security.details,
        accessibility: scoring.accessibility.details,
        techStack: scoring.techStack.details,
        contentQuality: scoring.contentQuality.details,
        ux: scoring.ux.details,
        loadedUrl: scoring.loadedUrl,
        screenshotUrls,
        errorFlag: scoring.errorFlag,
      }

      let narrativeBlock: Record<string, unknown> = {}
      try {
        const nar = await generateScoreNarrativesFromScoring(biz.name, city.name, city.state, scoring)
        narrativeBlock = {
          email_opening: nar.email_opening,
          narrative_extended: nar.narrative_extended,
          narrative_summary: nar.email_opening,
          category_notes: nar.category_notes,
          narrative_generated_at: new Date().toISOString(),
          narrative_last_usage: nar.usage ?? null,
        }
      } catch (e) {
        console.warn(`  narrative generation skipped: ${(e as Error).message}`)
      }

      // Save to website_scores
      const { error: insertErr } = await supabaseAdmin.from('website_scores').upsert({
        business_id: biz.id,
        overall_score: scoring.overall,
        responsive_score: scoring.responsive.score,
        visual_era_score: scoring.visualEra.score,
        performance_score: scoring.performance.score,
        security_score: scoring.security.score,
        accessibility_score: scoring.accessibility.score,
        tech_stack_score: scoring.techStack.score,
        content_quality_score: scoring.contentQuality.score,
        ux_score: scoring.ux.score,
        details: { ...baseDetails, ...narrativeBlock },
        screenshot_before_url: primaryScreenshot,
      }, { onConflict: 'business_id' })

      if (insertErr) {
        console.log(`WARN: score save failed — ${insertErr.message}`)
      } else {
        // Update business status to 'scored'
        await supabaseAdmin
          .from('businesses')
          .update({ status: 'scored' })
          .eq('id', biz.id)

        scored.push({ business: biz, overallScore: scoring.overall })
        totalScored++
        console.log(`score: ${scoring.overall.toFixed(1)}/10 (${scoring.errorFlag ? '⚠ ' + scoring.errorFlag : '✓'})`)
      }
    } catch (err) {
      console.log(`SKIP: ${(err as Error).message.substring(0, 50)}`)
      skipped++
    }

    // Polite delay between sites
    await new Promise((r) => setTimeout(r, 1000))
  }

  await browser.close()
  console.log(`\n  ✓ Scored ${totalScored}, skipped ${skipped}`)

  // ── Step 4: Select bottom BATCH_SIZE → queued_for_rebuild ─────
  console.log(`\n[4/4] Selecting bottom ${BATCH_SIZE} by score...`)

  scored.sort((a, b) => a.overallScore - b.overallScore)
  const batch = scored.slice(0, BATCH_SIZE)

  for (const { business, overallScore } of batch) {
    await supabaseAdmin
      .from('businesses')
      .update({ status: 'queued_for_rebuild' })
      .eq('id', business.id)

    // Create a rebuild row in 'queued' state
    await supabaseAdmin.from('rebuilds').upsert({
      business_id: business.id,
      status: 'queued',
    }, { onConflict: 'business_id' })

    console.log(`  🎯 ${business.name.substring(0, 45)} → score ${overallScore.toFixed(1)} → QUEUED`)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  SCORING COMPLETE`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  City:          ${city.name}, ${city.state}`)
  console.log(`  Businesses:    ${businesses.length} loaded`)
  console.log(`  Scored:        ${totalScored}`)
  console.log(`  Skipped:       ${skipped}`)
  console.log(`  Queued (${BATCH_SIZE}):   ${batch.length}`)
  console.log(`${'='.repeat(60)}\n`)

  return {
    city: `${city.name}, ${city.state}`,
    totalScored,
    queued: batch.length,
    skipped,
    batchSize: BATCH_SIZE,
  }
}
