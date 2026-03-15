/**
 * HAIG Summary API
 *
 * Generates a 3-part AI analysis for a prospect:
 *   1. scoreNarrative  — WHY the score is what it is
 *   2. opportunitySummary — what a rebuild achieves for this business
 *   3. emailNarrative — the {{personalized_modernity_narrative}} for outreach emails
 *   4. ownerName — researched business owner / primary executive
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SCORE_LABELS: Record<string, string> = {
  responsive_score:      'Mobile Responsive',
  visual_era_score:      'Visual Era',
  performance_score:     'Performance',
  security_score:        'Security',
  accessibility_score:   'Accessibility',
  tech_stack_score:      'Tech Stack',
  content_quality_score: 'Content Quality',
  ux_score:              'UX',
}

const SCORE_WEIGHTS: Record<string, number> = {
  responsive_score: 20, visual_era_score: 20, performance_score: 15,
  security_score: 10, accessibility_score: 10, tech_stack_score: 10,
  content_quality_score: 10, ux_score: 5,
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: b, error } = await supabaseAdmin
    .from('businesses')
    .select(`
      id, name, website, address,
      cities ( name, state ),
      website_scores (
        overall_score,
        responsive_score, visual_era_score, performance_score,
        security_score, accessibility_score, tech_stack_score,
        content_quality_score, ux_score,
        scored_at
      )
    `)
    .eq('id', id)
    .single()

  if (error || !b) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const city  = b.cities as unknown as { name: string; state: string } | null
  const score = Array.isArray(b.website_scores) ? b.website_scores[0] : b.website_scores
  if (!score) {
    return NextResponse.json({ error: 'No score data available — score this business first.' }, { status: 400 })
  }

  // Build sorted score list for narrative context
  const scoreEntries = Object.entries(SCORE_LABELS).map(([key, label]) => ({
    key,
    label,
    value: (score as Record<string, number>)[key] ?? 0,
    weight: SCORE_WEIGHTS[key] ?? 0,
  })).sort((a, b) => a.value - b.value)

  const lowest  = scoreEntries.slice(0, 3)
  const highest = scoreEntries.slice(-2).reverse()
  const overall = (score.overall_score as number) ?? 0

  const businessType = b.name.toLowerCase().includes('attorney') || b.name.toLowerCase().includes('law')
    ? 'law firm'
    : b.name.toLowerCase().includes('dental') ? 'dental practice'
    : b.name.toLowerCase().includes('restaurant') || b.name.toLowerCase().includes('grill') ? 'restaurant'
    : 'local business'

  // ── 1. Generate HAIG narrative + email narrative ────────────────────────────
  const summaryPrompt = `You are a senior web strategist at HAI Custom Solutions writing an internal analysis brief for a prospect.

Business: ${b.name}
Type: ${businessType}
Location: ${city?.name ?? ''}, ${city?.state ?? ''}
Website: ${b.website ?? 'not found'}
Overall Modernity Score: ${overall.toFixed(1)}/10

Score Breakdown (sorted lowest to highest):
${scoreEntries.map(e => `  - ${e.label}: ${e.value.toFixed(1)}/10 (${e.weight}% weight)`).join('\n')}

Biggest weaknesses: ${lowest.map(e => `${e.label} (${e.value.toFixed(1)})`).join(', ')}
Biggest strengths:  ${highest.map(e => `${e.label} (${e.value.toFixed(1)})`).join(', ')}

Write a HAIG Summary as JSON with exactly these three keys:

1. "scoreNarrative" (2-3 sentences): Explain WHY the overall score is ${overall.toFixed(1)}/10. Be specific — reference the exact category scores. Don't just say "the site is outdated." Tell the story of what's dragging it down and what's keeping it afloat.

2. "opportunitySummary" (2-3 sentences): Explain why rebuilding this specific ${businessType}'s site matters — connect their web weakness to real business impact (trust, leads, reputation). Be specific to their industry.

3. "emailNarrative" (1-2 sentences): A personalized, conversational opening observation for a sales email. This goes right after "Hi [Owner Name]," — so don't include a greeting. Reference a specific weakness without being condescending. Make it feel like a thoughtful observation from someone who genuinely looked at their site, not a template.

Return ONLY valid JSON, no markdown, no explanation.`

  // ── 2. Research owner name ──────────────────────────────────────────────────
  const ownerPrompt = `What is the name of the primary owner, founder, or senior executive at "${b.name}" in ${city?.name ?? ''}, ${city?.state ?? ''}?

Return ONLY valid JSON: { "ownerName": "First Last" } — or { "ownerName": null } if you are not confident.
Do not guess. Only return a name if you have reasonable confidence based on your training data.`

  // Run both in parallel
  const [summaryMsg, ownerMsg] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: summaryPrompt }],
    }),
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 80,
      messages: [{ role: 'user', content: ownerPrompt }],
    }),
  ])

  // Parse summary
  let scoreNarrative = ''
  let opportunitySummary = ''
  let emailNarrative = ''
  try {
    const raw = summaryMsg.content[0]
    if (raw.type === 'text') {
      const match = raw.text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match?.[0] ?? '{}')
      scoreNarrative    = parsed.scoreNarrative    ?? ''
      opportunitySummary = parsed.opportunitySummary ?? ''
      emailNarrative    = parsed.emailNarrative    ?? ''
    }
  } catch {
    const raw = summaryMsg.content[0]
    if (raw.type === 'text') scoreNarrative = raw.text
  }

  // Parse owner
  let ownerName: string | null = null
  try {
    const raw = ownerMsg.content[0]
    if (raw.type === 'text') {
      const match = raw.text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match?.[0] ?? '{}')
      ownerName = parsed.ownerName ?? null
    }
  } catch {
    ownerName = null
  }

  return NextResponse.json({
    ok:                 true,
    businessName:       b.name,
    overallScore:       overall,
    scoreNarrative,
    opportunitySummary,
    emailNarrative,
    ownerName,
    scores: scoreEntries,
  })
}
