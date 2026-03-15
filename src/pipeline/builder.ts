/**
 * AI Site Builder
 *
 * Uses Claude claude-sonnet-4-6 to generate a complete, modern static HTML + Tailwind CDN
 * demo site based on scraped content from an existing business website.
 *
 * Output: single index.html file ready for GitHub Pages deployment.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ScrapedSite } from './scraper'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface BuildResult {
  html:      string
  slug:      string
  briefUsed: string
}

/**
 * Generate a modern demo site for the given business.
 */
export async function buildSite(
  scraped: ScrapedSite,
  businessName: string,
  city: string,
  state: string,
  originalScore: number,
  slug: string,
  executiveNotes?: string
): Promise<BuildResult> {

  const brief = buildBrief(scraped, businessName, city, state, originalScore, executiveNotes)

  console.log(`  [builder] Calling Claude for ${businessName}…`)

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [
      {
        role:    'user',
        content: brief,
      }
    ],
  })

  const rawContent = message.content[0]
  if (rawContent.type !== 'text') throw new Error('Claude returned non-text content')

  // Extract HTML — Claude may wrap in markdown code blocks
  let html = rawContent.text.trim()
  const codeBlockMatch = html.match(/```html\n([\s\S]*?)```/)
  if (codeBlockMatch) html = codeBlockMatch[1].trim()
  // Fallback: if it starts with <!DOCTYPE or <html, use as-is
  if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
    const htmlStart = html.indexOf('<!DOCTYPE')
    if (htmlStart !== -1) html = html.slice(htmlStart)
  }

  return { html, slug, briefUsed: brief }
}


// ─────────────────────────────────────────────────────────────────
// Build the prompt brief for Claude
// ─────────────────────────────────────────────────────────────────
function buildBrief(
  scraped: ScrapedSite,
  businessName: string,
  city: string,
  state: string,
  originalScore: number,
  executiveNotes?: string
): string {

  const services = scraped.services.length
    ? scraped.services.slice(0, 10).join(', ')
    : 'their services'

  const hours = scraped.hours.length
    ? scraped.hours.slice(0, 7).join(' | ')
    : ''

  const social = Object.entries(scraped.socialLinks)
    .map(([net, url]) => `${net}: ${url}`)
    .join(', ')

  const phone   = scraped.phone ?? 'not found'
  const email   = scraped.email ?? 'not found'
  const address = scraped.address ?? `${city}, ${state}`

  // Trim body text to stay within token budget
  const bodySnippet = scraped.allBodyText.slice(0, 3000)

  return `You are a professional web developer and designer creating a modern demo website for a local business.

## Business Information
- **Name:** ${businessName}
- **Location:** ${city}, ${state}
- **Phone:** ${phone}
- **Email:** ${email}
- **Address:** ${address}
- **Services:** ${services}
${hours ? `- **Hours:** ${hours}` : ''}
${social ? `- **Social:** ${social}` : ''}

## Existing Site Context (scraped content)
${bodySnippet}

## Task
Generate a complete, single-file \`index.html\` demo website for **${businessName}**.

The existing site scored **${originalScore.toFixed(1)}/10** on a modern web standards audit. Your demo should be dramatically better.

## Required Technical Specs
- Use **Tailwind CSS CDN** (v3): \`<script src="https://cdn.tailwindcss.com"></script>\`
- Single HTML file — no external JS files or build steps
- Mobile-first responsive design (hamburger nav on mobile)
- Dark hero section with a strong headline and CTA button
- Include these sections IN ORDER:
  1. **Navigation** — logo text left, nav links right, hamburger on mobile
  2. **Hero** — full-width, dark bg, headline, subheading, primary CTA button
  3. **Services/Offerings** — card grid (3 columns desktop, 1 mobile)
  4. **About** — brief paragraph about the business
  5. **Contact/Hours** — address, phone, email, hours if available
  6. **Footer** — copyright, links

## Design Guidelines
- Color palette: use a professional, modern palette appropriate for the business type
- Typography: clean sans-serif via Google Fonts (embed in <head>)
- Smooth scroll behavior
- Hover effects on cards and buttons
- All images: use professional placeholder images from https://picsum.photos/seed/{businessname}/800/600 — replace {businessname} with a URL-safe version of the business name

## HAI Branding Watermark (REQUIRED — do not omit)
Include this watermark badge in the bottom-right corner of the page, ALWAYS:
\`\`\`html
<div style="position:fixed;bottom:16px;right:16px;z-index:9999;background:rgba(0,0,0,0.8);color:white;padding:6px 12px;border-radius:6px;font-size:11px;font-family:sans-serif;letter-spacing:0.5px;">
  Demo by <a href="https://www.haiconsultingservices.com/contact" target="_blank" style="color:#60a5fa;text-decoration:none;font-weight:600;">HAI Custom Solutions</a>
</div>
\`\`\`

## CTA Links
- All primary CTA buttons should link to: **https://www.haiconsultingservices.com/contact**
- Contact form submissions should link to the same URL (no backend needed)

## Output Format
Return ONLY the complete HTML document starting with \`<!DOCTYPE html>\`. No explanations, no markdown fences, just pure HTML.
${executiveNotes ? `
## Additional Context from HAI Executive
${executiveNotes}

Use this context to guide emphasis, tone, and any personal touches in the design. This is the HAI executive's perspective on what this business needs.` : ''}`
}
