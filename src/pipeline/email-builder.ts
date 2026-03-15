/**
 * Email Builder
 *
 * Generates personalized HTML email content for outreach.
 * Features:
 *  - AI subject line generation
 *  - {{company_owner}} — researched from Claude's knowledge
 *  - {{personalized_modernity_narrative}} — score-based opening paragraph
 *  - Short, punchy email with meeting CTA and one-time fee mention
 */

import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import * as fs from 'fs'
import * as path from 'path'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface EmailContent {
  subject:  string
  htmlBody: string
  textBody: string
}

interface ScoreDetails {
  responsive_score:      number
  visual_era_score:      number
  performance_score:     number
  security_score:        number
  accessibility_score:   number
  tech_stack_score:      number
  content_quality_score: number
  ux_score:              number
  overall_score:         number
}

export interface EmailContext {
  businessName:        string
  city:                string
  state:               string
  score:               number
  demoUrl:             string
  executiveName:       string
  executiveEmail:      string
  beforeScreenshotUrl: string | null
  afterScreenshotUrl:  string | null
  scoreDetails?:       ScoreDetails
}

// ─────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────

export async function buildEmail(ctx: EmailContext): Promise<EmailContent> {
  // Run AI tasks in parallel
  const [subject, ownerName, modernityNarrative] = await Promise.all([
    generateSubjectLine(ctx),
    researchOwner(ctx.businessName, ctx.city, ctx.state),
    generateModernityNarrative(ctx),
  ])

  const template      = await loadTemplate()
  const textBody      = fillTemplate(template, ctx, ownerName, modernityNarrative)
  const htmlBody      = buildHtmlEmail(textBody, ctx, ownerName, modernityNarrative)

  return { subject, htmlBody, textBody }
}

// ─────────────────────────────────────────────────────────────────
// AI: Subject line
// ─────────────────────────────────────────────────────────────────

async function generateSubjectLine(ctx: EmailContext): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{
        role:    'user',
        content: `Generate a short, compelling email subject line for a sales outreach email.
The email is from HAI Custom Solutions to ${ctx.businessName} in ${ctx.city}, ${ctx.state}.
We built a free demo of their redesigned website (their current site scored ${ctx.score.toFixed(1)}/10).
The subject should be personalized, professional, under 60 chars, and create curiosity.
Return ONLY the subject line text, nothing else.`,
      }],
    })
    const raw = message.content[0]
    if (raw.type === 'text') return raw.text.trim().replace(/^["']|["']$/g, '')
  } catch (err) {
    console.warn(`  [email-builder] AI subject failed, using fallback: ${(err as Error).message}`)
  }
  return `We built a modern demo of ${ctx.businessName}'s website — take a look`
}

// ─────────────────────────────────────────────────────────────────
// AI: Owner / executive name research
// ─────────────────────────────────────────────────────────────────

async function researchOwner(
  businessName: string,
  city: string,
  state: string
): Promise<string | null> {
  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 80,
      messages: [{
        role:    'user',
        content: `What is the name of the primary owner, founder, or senior executive at "${businessName}" in ${city}, ${state}?

Return ONLY valid JSON: { "ownerName": "First Last" } — or { "ownerName": null } if you are not confident.
Do not guess. Only return a name if you have reasonable confidence based on your training data.`,
      }],
    })
    const raw = message.content[0]
    if (raw.type === 'text') {
      const match  = raw.text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match?.[0] ?? '{}')
      return parsed.ownerName ?? null
    }
  } catch (err) {
    console.warn(`  [email-builder] Owner research failed: ${(err as Error).message}`)
  }
  return null
}

// ─────────────────────────────────────────────────────────────────
// AI: Personalized modernity narrative
// ─────────────────────────────────────────────────────────────────

export async function generateModernityNarrative(ctx: EmailContext): Promise<string> {
  const scores = ctx.scoreDetails
  if (!scores) {
    // Fallback: generic observation based on overall score
    return `I took a look at your website and noticed there's a real opportunity to better reflect the quality of what you offer — your current site scored ${ctx.score.toFixed(1)}/10 on our modern web standards audit.`
  }

  const scoreEntries = [
    { label: 'Mobile Responsive', value: scores.responsive_score },
    { label: 'Visual Era',        value: scores.visual_era_score },
    { label: 'Performance',       value: scores.performance_score },
    { label: 'Security',          value: scores.security_score },
    { label: 'Accessibility',     value: scores.accessibility_score },
    { label: 'Tech Stack',        value: scores.tech_stack_score },
    { label: 'Content Quality',   value: scores.content_quality_score },
    { label: 'UX',                value: scores.ux_score },
  ].sort((a, b) => a.value - b.value)

  const lowest  = scoreEntries.slice(0, 2)
  const highest = scoreEntries.slice(-2).reverse()

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role:    'user',
        content: `You are writing a personalized, warm 1-2 sentence observation about a business's website for a sales email.

Business: ${ctx.businessName} — ${ctx.city}, ${ctx.state}
Overall Score: ${ctx.score.toFixed(1)}/10
Weakest areas: ${lowest.map(e => `${e.label} (${e.value.toFixed(1)}/10)`).join(', ')}
Strongest areas: ${highest.map(e => `${e.label} (${e.value.toFixed(1)}/10)`).join(', ')}

Write 1-2 sentences that go right after "Hi [Name]," in a sales email. Reference what you actually found on their site — make it feel genuine and specific. Don't be condescending. Don't start with "I" — start with an observation about the business or their site. No greeting, no subject line, just the observation sentences.

Return ONLY the sentences, nothing else.`,
      }],
    })
    const raw = message.content[0]
    if (raw.type === 'text') return raw.text.trim()
  } catch (err) {
    console.warn(`  [email-builder] Narrative generation failed: ${(err as Error).message}`)
  }

  // Fallback
  const drag = lowest[0]
  return `Your site's ${drag.label.toLowerCase()} (${drag.value.toFixed(1)}/10) is holding back the impression your business makes before a potential client even picks up the phone.`
}

// ─────────────────────────────────────────────────────────────────
// Template loading + filling
// ─────────────────────────────────────────────────────────────────

async function loadTemplate(): Promise<string> {
  const templatePath = path.join(process.cwd(), 'data', 'email-template.txt')
  try {
    return fs.readFileSync(templatePath, 'utf-8')
  } catch {
    return DEFAULT_TEMPLATE
  }
}

function fillTemplate(
  template: string,
  ctx: EmailContext,
  ownerName: string | null,
  modernityNarrative: string
): string {
  const greeting = ownerName ? ownerName : ''

  let body = template
    .replace(/\{\{business_name\}\}/g,                 ctx.businessName)
    .replace(/\{\{demo_url\}\}/g,                      ctx.demoUrl)
    .replace(/\{\{executive_name\}\}/g,                ctx.executiveName)
    .replace(/\{\{score\}\}/g,                         ctx.score.toFixed(1))
    .replace(/\{\{city\}\}/g,                          ctx.city)
    .replace(/\{\{state\}\}/g,                         ctx.state)
    .replace(/\{\{company_owner\}\}/g,                 greeting)
    .replace(/\{\{personalized_modernity_narrative\}\}/g, modernityNarrative)

  // Remove the "Subject:" line if it appears at the top
  body = body.replace(/^Subject:.*\n\n?/i, '')
  return body.trim()
}

// ─────────────────────────────────────────────────────────────────
// HTML email builder
// ─────────────────────────────────────────────────────────────────

function buildHtmlEmail(
  textBody: string,
  ctx: EmailContext,
  ownerName: string | null,
  modernityNarrative: string
): string {
  const greeting = ownerName ? `Hi ${ownerName},` : 'Hello,'

  const escapedNarrative = modernityNarrative
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Build before/after screenshot section
  let screenshotSection = ''
  if (ctx.beforeScreenshotUrl || ctx.afterScreenshotUrl) {
    screenshotSection = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        ${ctx.beforeScreenshotUrl ? `
        <td width="48%" valign="top">
          <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Their Current Site</p>
          <img src="${ctx.beforeScreenshotUrl}" alt="Current website" style="width:100%;border-radius:8px;border:1px solid #e5e7eb;" />
        </td>
        <td width="4%"></td>
        ` : ''}
        ${ctx.afterScreenshotUrl ? `
        <td width="48%" valign="top">
          <p style="margin:0 0 8px 0;font-size:12px;color:#059669;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">The HAI Demo ✨</p>
          <img src="${ctx.afterScreenshotUrl}" alt="HAI redesigned demo" style="width:100%;border-radius:8px;border:1px solid #059669;" />
        </td>
        ` : ''}
      </tr>
    </table>`
  }

  const ctaUrl = 'https://www.haiconsultingservices.com/contact'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#1f2937;background:#ffffff;padding:20px;max-width:600px;margin:0 auto;">

  <!-- Greeting -->
  <p style="margin:0 0 16px 0;line-height:1.6;">${greeting}</p>

  <!-- Personalized modernity narrative -->
  <p style="margin:0 0 20px 0;line-height:1.6;">${escapedNarrative}</p>

  <!-- Main pitch -->
  <p style="margin:0 0 16px 0;line-height:1.6;">
    My name is <strong>${ctx.executiveName}</strong> from <strong>HAI Custom Solutions</strong> — we use people-centered AI to help local businesses build a web presence that actually matches their reputation.
  </p>

  <p style="margin:0 0 16px 0;line-height:1.6;">
    We took a look at <strong>${ctx.businessName}</strong>'s site and went ahead and built you a free, fully functional modern demo — no strings attached.
  </p>

  <!-- Demo CTA -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td align="center">
        <a href="${ctx.demoUrl}" style="display:inline-block;background:linear-gradient(135deg,#5D3FA3,#3BC9B5);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.3px;">
          👉 View Your Free Demo
        </a>
      </td>
    </tr>
  </table>

  ${screenshotSection}

  <!-- Offer details -->
  <p style="margin:0 0 16px 0;line-height:1.6;">
    Here's the thing — <strong>this demo can be yours.</strong> We offer a straightforward one-time build fee and an optional support plan starting at just <strong>$25/month</strong>. No long-term contracts, no surprises.
  </p>

  <p style="margin:0 0 24px 0;line-height:1.6;">
    I'd love to walk you through what we built and show you how a modern site could transform how customers find and trust <strong>${ctx.businessName}</strong>. Would you be open to a free 15-minute discovery call?
  </p>

  <!-- Meeting CTA -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
    <tr>
      <td align="center">
        <a href="${ctaUrl}" style="display:inline-block;background:#1f2937;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:600;font-size:14px;">
          Accept a Free 15-Min Discovery Call →
        </a>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 4px 0;line-height:1.6;">Best,</p>
  <p style="margin:0 0 4px 0;line-height:1.6;font-weight:600;">${ctx.executiveName}</p>
  <p style="margin:0 0 16px 0;line-height:1.6;color:#6b7280;font-size:13px;">
    HAI Custom Solutions LLC<br>
    <a href="https://www.haiconsultingservices.com" style="color:#6b7280;">haiconsultingservices.com</a>
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
  <p style="font-size:11px;color:#9ca3af;margin:0;line-height:1.5;">
    Sent by HAI Custom Solutions LLC ·
    <a href="https://www.haiconsultingservices.com" style="color:#9ca3af;">haiconsultingservices.com</a><br>
    You received this because your business matched our modernity audit criteria.
  </p>

</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────
// Suppress unused import warning (supabaseAdmin kept for future use)
// ─────────────────────────────────────────────────────────────────
void supabaseAdmin

// ─────────────────────────────────────────────────────────────────
// Default template (used when data/email-template.txt is missing)
// ─────────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE = `Hi {{company_owner}},

{{personalized_modernity_narrative}}

My name is {{executive_name}} from HAI Custom Solutions — we use people-centered AI to help local businesses build a web presence that actually matches their reputation.

We took a look at {{business_name}}'s site and went ahead and built you a free, fully functional modern demo — no strings attached.

👉 View your free demo: {{demo_url}}

Here's the thing — this demo can be yours. We offer a straightforward one-time build fee and an optional support plan starting at just $25/month. No long-term contracts, no surprises.

I'd love to walk you through what we built and show you how a modern site could transform how customers find and trust {{business_name}}. Would you be open to a free 15-minute discovery call?

Best,
{{executive_name}}
HAI Custom Solutions LLC
haiconsultingservices.com`
