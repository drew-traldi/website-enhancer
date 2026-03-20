/**
 * Outreach Orchestrator
 *
 * For each rebuilt business in a city:
 *   1. Discover contact email (scrape or pattern-based)
 *   2. Generate personalized email (AI subject + template body)
 *   3. Send via SendGrid
 *   4. Create outreach record in Supabase
 *   5. Update business status
 *
 * Businesses without a discoverable email are marked 'manual_required'.
 */

import 'dotenv/config'
import { launchBrowser } from '@/lib/browser'
import sgMail from '@sendgrid/mail'
import { supabaseAdmin } from '@/lib/supabase'
import { discoverEmail } from './email-discovery'
import { buildEmail } from './email-builder'
import { pickBestRebuild, parseAfterScreenshotUrl } from '@/lib/rebuild-utils'

export interface OutreachResult {
  businessId: string
  businessName: string
  email: string | null
  sent: boolean
  manualRequired: boolean
  error: string | null
}

export interface OutreachRunResult {
  city: string
  totalProcessed: number
  emailsSent: number
  manualRequired: number
  errors: number
  results: OutreachResult[]
}

interface RebuiltBusiness {
  id: string
  name: string
  website: string | null
  city_id: string
  cities: { name: string; state: string } | null
  website_scores: Array<{
    overall_score: number | null
    screenshot_before_url: string | null
    details: Record<string, unknown> | null
    responsive_score: number | null
    visual_era_score: number | null
    performance_score: number | null
    security_score: number | null
    accessibility_score: number | null
    tech_stack_score: number | null
    content_quality_score: number | null
    ux_score: number | null
  }>
  rebuilds: Array<{ id: string; live_demo_url: string | null; screenshot_after_url: string | null }>
  outreach: Array<{ id: string }>
}

export async function runOutreachPipeline(cityInput?: string): Promise<OutreachRunResult> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Website Enhancer — Outreach Pipeline`)
  if (cityInput) console.log(`  City: ${cityInput}`)
  console.log(`${'='.repeat(60)}`)

  // Configure SendGrid
  const sendgridKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'it@haiconsultingservices.com'
  if (!sendgridKey) throw new Error('SENDGRID_API_KEY not set in environment')
  sgMail.setApiKey(sendgridKey)

  // Load an executive to use as sender (round-robin by first available)
  const { data: executives } = await supabaseAdmin
    .from('executives')
    .select('id, full_name, email')
    .limit(4)

  if (!executives?.length) throw new Error('No executives found. Run seed:executives first.')

  // Build query for rebuilt businesses
  let query = supabaseAdmin
    .from('businesses')
    .select(`
      id, name, website, city_id,
      cities ( name, state ),
      website_scores (
        overall_score, screenshot_before_url, details,
        responsive_score, visual_era_score, performance_score,
        security_score, accessibility_score, tech_stack_score,
        content_quality_score, ux_score
      ),
      rebuilds ( id, live_demo_url, screenshot_after_url, status ),
      outreach ( id )
    `)
    .eq('status', 'rebuilt')
    .limit(50)

  if (cityInput) {
    const cityName = cityInput.split(',')[0].trim()
    const cityState = cityInput.split(',')[1]?.trim() ?? ''

    const { data: city } = await supabaseAdmin
      .from('cities')
      .select('id')
      .ilike('name', cityName)
      .ilike('state', cityState)
      .single()

    if (!city) throw new Error(`City not found: "${cityInput}". Run discover first.`)
    query = query.eq('city_id', city.id)
  }

  const { data: businesses, error: loadErr } = await query

  if (loadErr) throw new Error(`Failed to load rebuilt businesses: ${loadErr.message}`)
  if (!businesses?.length) {
    console.log('  No rebuilt businesses ready for outreach.')
    return { city: cityInput ?? 'all', totalProcessed: 0, emailsSent: 0, manualRequired: 0, errors: 0, results: [] }
  }

  const typed = businesses as unknown as RebuiltBusiness[]
  // Filter out businesses that already have outreach records
  const pending = typed.filter(b => !b.outreach?.length)

  if (!pending.length) {
    console.log('  All rebuilt businesses already have outreach records.')
    return { city: cityInput ?? 'all', totalProcessed: 0, emailsSent: 0, manualRequired: 0, errors: 0, results: [] }
  }

  console.log(`\n  ${pending.length} businesses ready for outreach.\n`)

  // Launch browser for email discovery
  const browser = await launchBrowser()

  const results: OutreachResult[] = []
  let emailsSent = 0
  let manualCount = 0
  let errorCount = 0

  for (let i = 0; i < pending.length; i++) {
    const biz = pending[i]
    const cityObj = biz.cities as { name: string; state: string } | null
    const cityName = cityObj?.name ?? ''
    const cityState = cityObj?.state ?? ''
    const rebuild = pickBestRebuild(biz.rebuilds) as
      | { id: string; live_demo_url: string | null; screenshot_after_url: string | null }
      | null
    const score = biz.website_scores?.[0]
    const scoreDetailsJson = score?.details ?? null
    const storedNarrative =
      scoreDetailsJson && typeof scoreDetailsJson.email_opening === 'string' && scoreDetailsJson.email_opening.trim()
        ? scoreDetailsJson.email_opening
        : scoreDetailsJson && typeof scoreDetailsJson.narrative_summary === 'string'
          ? scoreDetailsJson.narrative_summary
          : null

    // Round-robin executive assignment
    const exec = executives[i % executives.length]

    console.log(`\n  [${i + 1}/${pending.length}] ${biz.name}`)

    const result: OutreachResult = {
      businessId: biz.id,
      businessName: biz.name,
      email: null,
      sent: false,
      manualRequired: false,
      error: null,
    }

    try {
      if (!rebuild?.live_demo_url) {
        result.error = 'No live demo URL'
        result.manualRequired = true
        manualCount++
        console.log(`    ⚠ No demo URL — marked manual`)
        await markManual(biz.id, rebuild?.id, exec.id)
        results.push(result)
        continue
      }

      // Step 1: Discover email
      let contactEmail: string | null = null
      let emailSource = 'none'

      if (biz.website) {
        console.log(`    [1/3] Discovering email from ${biz.website}…`)
        const page = await browser.newPage()
        await page.setViewport({ width: 1280, height: 800 })
        const discovery = await discoverEmail(biz.website, page)
        await page.close()

        contactEmail = discovery.email
        emailSource = discovery.source
        console.log(`    → Found: ${contactEmail ?? 'none'} (${emailSource})`)
      }

      if (!contactEmail) {
        result.manualRequired = true
        manualCount++
        console.log(`    ⚠ No email found — marked manual`)
        await markManual(biz.id, rebuild?.id, exec.id)
        results.push(result)
        continue
      }

      result.email = contactEmail

      // Step 2: Build email content
      console.log(`    [2/3] Generating email content…`)
      const emailContent = await buildEmail({
        businessName: biz.name,
        city: cityName,
        state: cityState,
        score: score?.overall_score ?? 5,
        demoUrl: rebuild.live_demo_url,
        executiveName: exec.full_name,
        executiveEmail: exec.email,
        beforeScreenshotUrl: score?.screenshot_before_url ?? null,
        afterScreenshotUrl: parseAfterScreenshotUrl(rebuild.screenshot_after_url),
        storedNarrativeSummary: storedNarrative,
        scoreDetails: score
          ? {
              responsive_score: score.responsive_score ?? 5,
              visual_era_score: score.visual_era_score ?? 5,
              performance_score: score.performance_score ?? 5,
              security_score: score.security_score ?? 5,
              accessibility_score: score.accessibility_score ?? 5,
              tech_stack_score: score.tech_stack_score ?? 5,
              content_quality_score: score.content_quality_score ?? 5,
              ux_score: score.ux_score ?? 5,
              overall_score: score.overall_score ?? 5,
            }
          : undefined,
      })

      // Step 3: Send via SendGrid
      console.log(`    [3/3] Sending to ${contactEmail}…`)
      let sendgridMessageId: string | null = null
      try {
        const [response] = await sgMail.send({
          to: contactEmail,
          from: { email: fromEmail, name: `${exec.full_name} — HAI Custom Solutions` },
          replyTo: { email: exec.email, name: exec.full_name },
          subject: emailContent.subject,
          text: emailContent.textBody,
          html: emailContent.htmlBody,
          attachments: emailContent.attachments,
          trackingSettings: {
            clickTracking: { enable: true, enableText: false },
            openTracking: { enable: true },
          },
          customArgs: {
            business_id: biz.id,
          },
        })
        sendgridMessageId = response?.headers?.['x-message-id'] ?? null
        result.sent = true
        emailsSent++
        console.log(`    ✓ Email sent (msgId: ${sendgridMessageId ?? 'unknown'})`)
      } catch (sgErr) {
        const msg = (sgErr as Error).message
        console.error(`    ✗ SendGrid error: ${msg}`)
        result.error = `SendGrid: ${msg}`
        errorCount++
      }

      // Step 4: Create outreach record
      await supabaseAdmin.from('outreach').insert({
        business_id: biz.id,
        rebuild_id: rebuild.id,
        executive_id: exec.id,
        contact_email: contactEmail,
        contact_method: emailSource === 'pattern_guess' ? 'manual_email' : 'email',
        email_subject: emailContent.subject,
        email_body: emailContent.htmlBody,
        sendgrid_message_id: sendgridMessageId,
        sent_at: result.sent ? new Date().toISOString() : null,
        status: result.sent ? 'sent' : 'draft',
      } as Record<string, unknown>)

      // Update business status
      if (result.sent) {
        await supabaseAdmin
          .from('businesses')
          .update({ status: 'email_sent', assigned_executive: exec.id })
          .eq('id', biz.id)
      }

    } catch (err) {
      result.error = (err as Error).message
      errorCount++
      console.error(`    ✗ Error: ${result.error}`)
    }

    results.push(result)
  }

  await browser.close()

  // Summary
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  OUTREACH COMPLETE`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  Processed:       ${pending.length}`)
  console.log(`  Emails sent:     ${emailsSent}`)
  console.log(`  Manual required: ${manualCount}`)
  console.log(`  Errors:          ${errorCount}`)
  results.forEach(r => {
    const icon = r.sent ? '✅' : r.manualRequired ? '📋' : '❌'
    const info = r.sent ? r.email : r.manualRequired ? 'manual outreach' : r.error
    console.log(`  ${icon} ${r.businessName}: ${info}`)
  })
  console.log(`${'='.repeat(60)}\n`)

  return {
    city: cityInput ?? 'all',
    totalProcessed: pending.length,
    emailsSent,
    manualRequired: manualCount,
    errors: errorCount,
    results,
  }
}

// Helpers

async function markManual(businessId: string, rebuildId: string | undefined, execId: string) {
  await supabaseAdmin
    .from('businesses')
    .update({ status: 'manual_required', assigned_executive: execId })
    .eq('id', businessId)

  await supabaseAdmin.from('outreach').insert({
    business_id: businessId,
    rebuild_id: rebuildId ?? null,
    executive_id: execId,
    contact_method: 'manual_email',
    status: 'draft',
  } as Record<string, unknown>)
}

