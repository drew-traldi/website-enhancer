/**
 * AI-generated narrative summaries for website scores (dashboard + outreach emails).
 * Stored in website_scores.details as narrative_summary + category_notes.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ScoringDetails } from '@/pipeline/score'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ScoreNarrativePayload {
  narrative_summary: string
  category_notes: Record<string, string>
}

const CATEGORY_KEYS = [
  'responsive',
  'visualEra',
  'performance',
  'security',
  'accessibility',
  'techStack',
  'contentQuality',
  'ux',
] as const

function truncateJson(obj: unknown, maxLen = 400): string {
  const s = JSON.stringify(obj)
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '…'
}

/**
 * Generate narratives from a live scoring run (pipeline / API score route).
 */
export async function generateScoreNarrativesFromScoring(
  businessName: string,
  city: string,
  state: string,
  scoring: ScoringDetails
): Promise<ScoreNarrativePayload> {
  const breakdown = CATEGORY_KEYS.map((key) => {
    const cat = scoring[key]
    return {
      category: key,
      score: cat.score,
      signals: truncateJson(cat.details),
    }
  })

  return callClaudeForNarrative(businessName, city, state, scoring.overall, breakdown)
}

/**
 * Regenerate from an existing DB row (numeric columns + details JSON).
 */
export async function generateScoreNarrativesFromStoredRow(
  businessName: string,
  city: string,
  state: string,
  row: {
    overall_score: number | null
    responsive_score: number | null
    visual_era_score: number | null
    performance_score: number | null
    security_score: number | null
    accessibility_score: number | null
    tech_stack_score: number | null
    content_quality_score: number | null
    ux_score: number | null
    details: Record<string, unknown> | null
  }
): Promise<ScoreNarrativePayload> {
  const d = row.details ?? {}
  const scores: Record<string, number> = {
    responsive: row.responsive_score ?? 5,
    visualEra: row.visual_era_score ?? 5,
    performance: row.performance_score ?? 5,
    security: row.security_score ?? 5,
    accessibility: row.accessibility_score ?? 5,
    techStack: row.tech_stack_score ?? 5,
    contentQuality: row.content_quality_score ?? 5,
    ux: row.ux_score ?? 5,
  }

  const breakdown = CATEGORY_KEYS.map((key) => ({
    category: key,
    score: scores[key],
    signals: truncateJson((d as Record<string, unknown>)[key] ?? {}),
  }))

  const overall = row.overall_score ?? 5
  return callClaudeForNarrative(businessName, city, state, overall, breakdown)
}

async function callClaudeForNarrative(
  businessName: string,
  city: string,
  state: string,
  overall: number,
  breakdown: Array<{ category: string; score: number; signals: string }>
): Promise<ScoreNarrativePayload> {
  const loc =
    businessName.trim() && city.trim()
      ? `Business: ${businessName} in ${city}, ${state}`
      : 'Business context: local service business (name/location generic if missing).'

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      messages: [
        {
          role: 'user',
          content: `You are helping a B2B sales team explain a "website modernity" audit to a local business owner.

${loc}
Overall score: ${overall.toFixed(1)} / 10 (10 = state-of-the-art).

Per-category scores and automated signals (JSON fragments):
${JSON.stringify(breakdown, null, 2)}

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "narrative_summary": "2-3 sentences. Professional, specific, not condescending. Mention 1-2 weakest areas and one strength. Suitable for an email after 'Hello,'.",
  "category_notes": {
    "responsive": "one short sentence",
    "visualEra": "one short sentence",
    "performance": "one short sentence",
    "security": "one short sentence",
    "accessibility": "one short sentence",
    "techStack": "one short sentence",
    "contentQuality": "one short sentence",
    "ux": "one short sentence"
  }
}

Each category_notes value must reference that category only (15 words max). Use plain language.`,
        },
      ],
    })
    const raw = message.content[0]
    if (raw.type === 'text') {
      const match = raw.text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match?.[0] ?? '{}') as {
        narrative_summary?: string
        category_notes?: Record<string, string>
      }
      const narrative_summary =
        typeof parsed.narrative_summary === 'string' && parsed.narrative_summary.trim()
          ? parsed.narrative_summary.trim()
          : fallbackSummary(overall, breakdown)
      const category_notes =
        parsed.category_notes && typeof parsed.category_notes === 'object'
          ? parsed.category_notes
          : {}
      for (const key of CATEGORY_KEYS) {
        if (!category_notes[key] || typeof category_notes[key] !== 'string') {
          category_notes[key] = `Scored ${scoresFromBreakdown(breakdown, key).toFixed(1)}/10 based on automated checks.`
        }
      }
      return { narrative_summary, category_notes }
    }
  } catch (err) {
    console.warn(`[score-narrative] AI failed: ${(err as Error).message}`)
  }

  return {
    narrative_summary: fallbackSummary(overall, breakdown),
    category_notes: Object.fromEntries(
      CATEGORY_KEYS.map((k) => [k, `Rated ${scoresFromBreakdown(breakdown, k).toFixed(1)}/10 from our automated audit.`])
    ) as Record<string, string>,
  }
}

function scoresFromBreakdown(
  breakdown: Array<{ category: string; score: number }>,
  key: string
): number {
  return breakdown.find((b) => b.category === key)?.score ?? 5
}

function fallbackSummary(
  overall: number,
  breakdown: Array<{ category: string; score: number }>
): string {
  const sorted = [...breakdown].sort((a, b) => a.score - b.score)
  const worst = sorted[0]
  const best = sorted[sorted.length - 1]
  const label = (k: string) =>
    ({
      responsive: 'mobile layout',
      visualEra: 'visual design era',
      performance: 'page speed',
      security: 'security basics',
      accessibility: 'accessibility',
      techStack: 'underlying technology',
      contentQuality: 'content presentation',
      ux: 'user experience patterns',
    })[k] ?? k

  return `Your site scores ${overall.toFixed(1)}/10 on our modern web audit — strongest in ${label(best.category)}, with the biggest opportunity in ${label(worst.category)}.`
}
