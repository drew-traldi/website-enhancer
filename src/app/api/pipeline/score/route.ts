import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { city, state, count } = body

    if (!city || !state) {
      return NextResponse.json({ ok: false, message: 'city and state required' }, { status: 400 })
    }

    const limit = count === 'all' ? 999 : Math.min(Math.max(parseInt(count) || 5, 1), 999)

    // Find the city
    const { data: cityRow } = await supabaseAdmin
      .from('cities')
      .select('id, name, state')
      .ilike('name', city.trim())
      .ilike('state', state.trim())
      .single()

    if (!cityRow) {
      return NextResponse.json({ ok: false, message: `City not found: ${city}, ${state}` }, { status: 404 })
    }

    // Load filtered businesses that haven't been scored yet
    const { data: businesses, error } = await supabaseAdmin
      .from('businesses')
      .select('id, name, website')
      .eq('city_id', cityRow.id)
      .eq('status', 'filtered')
      .not('website', 'is', null)
      .limit(limit)

    if (error) throw new Error(error.message)
    if (!businesses?.length) {
      return NextResponse.json({ ok: true, message: 'No filtered businesses left to score', scored: 0, queued: 0 })
    }

    // Dynamic import to avoid Turbopack issues with Lighthouse's dynamic requires
    const scoreModule = await import('@/pipeline/score')
    const screenshotModule = await import('@/pipeline/screenshot')
    const { generateScoreNarrativesFromScoring } = await import('@/pipeline/score-narrative')
    const { scoreWebsite, launchBrowser } = scoreModule
    const { captureScreenshots, buildSlug } = screenshotModule

    const browser = await launchBrowser()
    let totalScored = 0
    let skipped = 0
    const scored: Array<{ id: string; score: number }> = []

    for (const biz of businesses) {
      try {
        const url = biz.website!
        const slug = buildSlug(biz.name, `${cityRow.name}-${cityRow.state}`)

        const scoring = await scoreWebsite(url, browser)

        const screenshotPage = await browser.newPage()
        await screenshotPage.setViewport({ width: 1280, height: 800 })
        try {
          await screenshotPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
          await screenshotPage.waitForNetworkIdle({ timeout: 3000, idleTime: 500 }).catch(() => {})
        } catch { /* partial load is fine */ }

        const screenshotUrls = await captureScreenshots(screenshotPage, slug, 'before')
        await screenshotPage.close()

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
          const nar = await generateScoreNarrativesFromScoring(
            biz.name,
            cityRow.name,
            cityRow.state,
            scoring
          )
          narrativeBlock = {
            email_opening: nar.email_opening,
            narrative_extended: nar.narrative_extended,
            narrative_summary: nar.email_opening,
            category_notes: nar.category_notes,
            narrative_generated_at: new Date().toISOString(),
          }
        } catch {
          /* optional */
        }

        await supabaseAdmin.from('website_scores').upsert({
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

        await supabaseAdmin
          .from('businesses')
          .update({ status: 'scored' })
          .eq('id', biz.id)

        scored.push({ id: biz.id, score: scoring.overall })
        totalScored++
      } catch {
        skipped++
      }

      await new Promise(r => setTimeout(r, 500))
    }

    await browser.close()

    // Queue bottom 15 for rebuild
    scored.sort((a, b) => a.score - b.score)
    const toQueue = scored.slice(0, 15)
    let queued = 0

    for (const { id } of toQueue) {
      await supabaseAdmin.from('businesses').update({ status: 'queued_for_rebuild' }).eq('id', id)
      await supabaseAdmin.from('rebuilds').upsert({
        business_id: id,
        status: 'queued',
      }, { onConflict: 'business_id' })
      queued++
    }

    return NextResponse.json({
      ok: true,
      scored: totalScored,
      skipped,
      queued,
      message: `Scored ${totalScored} businesses, ${queued} queued for rebuild`,
    })
  } catch (err) {
    console.error('[score]', err)
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 })
  }
}
