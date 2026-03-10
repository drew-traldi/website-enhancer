/**
 * Email Builder
 *
 * Generates personalized HTML email content for outreach,
 * using AI for subject lines and the configurable template for the body.
 */

import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import * as fs from 'fs'
import * as path from 'path'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface EmailContent {
  subject: string
  htmlBody: string
  textBody: string
}

interface EmailContext {
  businessName: string
  city: string
  state: string
  score: number
  demoUrl: string
  executiveName: string
  executiveEmail: string
  beforeScreenshotUrl: string | null
  afterScreenshotUrl: string | null
}

export async function buildEmail(ctx: EmailContext): Promise<EmailContent> {
  const subject = await generateSubjectLine(ctx)
  const template = await loadTemplate()
  const textBody = fillTemplate(template, ctx)
  const htmlBody = textToHtml(textBody, ctx)
  return { subject, htmlBody, textBody }
}

async function generateSubjectLine(ctx: EmailContext): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Generate a short, compelling email subject line for a sales outreach email. 
The email is from HAI Custom Solutions to ${ctx.businessName} in ${ctx.city}, ${ctx.state}. 
We built a free demo of their redesigned website (their current site scored ${ctx.score}/10).
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

async function loadTemplate(): Promise<string> {
  const templatePath = path.join(process.cwd(), 'data', 'email-template.txt')
  try {
    return fs.readFileSync(templatePath, 'utf-8')
  } catch {
    return DEFAULT_TEMPLATE
  }
}

function fillTemplate(template: string, ctx: EmailContext): string {
  let body = template
    .replace(/\{\{business_name\}\}/g, ctx.businessName)
    .replace(/\{\{demo_url\}\}/g, ctx.demoUrl)
    .replace(/\{\{executive_name\}\}/g, ctx.executiveName)
    .replace(/\{\{score\}\}/g, ctx.score.toFixed(1))
    .replace(/\{\{city\}\}/g, ctx.city)
    .replace(/\{\{state\}\}/g, ctx.state)

  // Remove the "Subject:" line if it appears at the top of the template
  body = body.replace(/^Subject:.*\n\n?/i, '')
  return body.trim()
}

function textToHtml(text: string, ctx: EmailContext): string {
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const linkedText = escapedText.replace(
    new RegExp(ctx.demoUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
    `<a href="${ctx.demoUrl}" style="color:#2563eb;text-decoration:underline;font-weight:600;">${ctx.demoUrl}</a>`
  )

  const paragraphs = linkedText.split('\n\n').map(p => {
    const lines = p.split('\n')
    if (lines.some(l => l.startsWith('•') || l.startsWith('- '))) {
      const items = lines
        .filter(l => l.startsWith('•') || l.startsWith('- '))
        .map(l => `<li style="margin-bottom:4px;">${l.replace(/^[•\-]\s*/, '')}</li>`)
        .join('')
      const pre = lines.filter(l => !l.startsWith('•') && !l.startsWith('- ')).join('<br>')
      return `${pre ? `<p style="margin:0 0 8px 0;">${pre}</p>` : ''}<ul style="margin:0 0 16px 20px;padding:0;">${items}</ul>`
    }
    return `<p style="margin:0 0 16px 0;line-height:1.6;">${lines.join('<br>')}</p>`
  })

  // Build before/after section if screenshots exist
  let screenshotSection = ''
  if (ctx.beforeScreenshotUrl || ctx.afterScreenshotUrl) {
    screenshotSection = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        ${ctx.beforeScreenshotUrl ? `
        <td width="48%" valign="top">
          <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Current Site</p>
          <img src="${ctx.beforeScreenshotUrl}" alt="Current website" style="width:100%;border-radius:8px;border:1px solid #e5e7eb;" />
        </td>
        <td width="4%"></td>
        ` : ''}
        ${ctx.afterScreenshotUrl ? `
        <td width="48%" valign="top">
          <p style="margin:0 0 8px 0;font-size:12px;color:#059669;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Your New Demo</p>
          <img src="${ctx.afterScreenshotUrl}" alt="Redesigned demo" style="width:100%;border-radius:8px;border:1px solid #059669;" />
        </td>
        ` : ''}
      </tr>
    </table>`
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#1f2937;background:#ffffff;padding:20px;max-width:600px;margin:0 auto;">
  ${paragraphs.join('\n  ')}
  ${screenshotSection}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td align="center">
        <a href="${ctx.demoUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px;">
          View Your Free Demo →
        </a>
      </td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
  <p style="font-size:12px;color:#9ca3af;margin:0;">
    Sent by HAI Custom Solutions LLC · 
    <a href="https://www.haiconsultingservices.com" style="color:#9ca3af;">haiconsultingservices.com</a>
  </p>
</body>
</html>`
}

const DEFAULT_TEMPLATE = `Hi there,

My name is {{executive_name}} from HAI Custom Solutions. I was browsing local businesses in your area and noticed {{business_name}}'s website scored {{score}}/10 on our modern web standards audit.

We went ahead and built you a free, fully functional demo of what your site could look like with a modern redesign — no strings attached.

👉 View your demo: {{demo_url}}

The demo includes:
• Mobile-first responsive design
• Fast load times (optimized for Google rankings)
• Modern, professional look that builds trust

If you'd like to discuss turning this demo into your real site, I'd love to connect. We work with local businesses throughout the area and our pricing is straightforward.

Feel free to reply here or call us anytime.

Best,
{{executive_name}}
HAI Custom Solutions LLC`
