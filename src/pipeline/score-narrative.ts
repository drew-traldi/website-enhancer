/**
 * AI-generated narrative summaries for website scores (dashboard + outreach emails).
 * Stored in website_scores.details: email_opening, narrative_extended,
 * narrative_summary (duplicate of email_opening for backward compatibility), category_notes.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ScoringDetails } from '@/pipeline/score'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/** Token counts returned by Anthropic on the Messages API response (billed usage). */
export interface NarrativeTokenUsage {
  input_tokens: number
  output_tokens: number
}

export interface ScoreNarrativePayload {
  /** 2–3 sentences — used as the email opening after “Hello,” */
  email_opening: string
  /** Multi-paragraph audit for the dashboard (plain text, \\n\\n between paragraphs) */
  narrative_extended: string
  category_notes: Record<string, string>
  /** Present when the Claude request completed; omitted on fallback or transport errors */
  usage?: NarrativeTokenUsage
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

/** Enough signal for Claude to write specifics without blowing the context window */
function truncateJson(obj: unknown, maxLen = 1400): string {
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

function parseClaudeJsonObject(text: string): Record<string, unknown> | null {
  let t = text.trim()
  if (t.startsWith('```')) {
    const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/im)
    if (m) t = m[1].trim()
  }
  try {
    return JSON.parse(t) as Record<string, unknown>
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        /* fall through */
      }
    }
  }
  return null
}

async function callClaudeForNarrative(
  businessName: string,
  city: string,
  state: string,
  overall: number,
  breakdown: Array<{ category: string; score: number; signals: string }>
): Promise<ScoreNarrativePayload> {
  let usage: NarrativeTokenUsage | undefined

  const loc =
    businessName.trim() && city.trim()
      ? `Business: ${businessName} in ${city}, ${state}`
      : 'Business context: local service business (name/location generic if missing).'

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are helping a B2B sales team explain a "website modernity" audit to a local business owner.

${loc}
Overall score: ${overall.toFixed(1)} / 10 (10 = state-of-the-art).

Below is EVERYTHING our automated audit captured (scores + raw signals per category). Use these specifics — name real patterns (e.g. table layouts, HTTPS, Lighthouse metrics, font stack) when the data supports it.

Per-category scores and signals:
${JSON.stringify(breakdown, null, 2)}

Return ONLY valid JSON (no markdown fences, no commentary). Escape newlines inside strings as \\n.

Required shape:
{
  "email_opening": "Exactly 2-3 sentences. Warm, professional, not condescending. Reference 1-2 concrete weaknesses and one strength from the signals above. This will appear right after 'Hello,' in an email.",
  "narrative_extended": "A comprehensive audit write-up: 4-6 short paragraphs separated by \\n\\n. Cover: (1) overall impression and what the score means for trust and conversions, (2) weakest 2-3 categories with specifics from the signals, (3) what is already working, (4) what a modern rebuild would improve (still grounded in the data). Write for an intelligent non-technical owner.",
  "category_notes": {
    "responsive": "2-3 sentences referencing viewport, layout, or mobile signals when present.",
    "visualEra": "2-3 sentences on visual/modernity signals (fonts, frameworks, dated patterns).",
    "performance": "2-3 sentences; cite Lighthouse or load signals if present in data.",
    "security": "2-3 sentences on HTTPS, mixed content, etc. if present.",
    "accessibility": "2-3 sentences on a11y heuristics from data.",
    "techStack": "2-3 sentences on CMS/framework/stack hints from data.",
    "contentQuality": "2-3 sentences on content structure/clarity from data.",
    "ux": "2-3 sentences on navigation/UX patterns from data."
  }
}`,
        },
      ],
    })
    if (message.usage) {
      usage = {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      }
    }
    const raw = message.content[0]
    if (raw.type === 'text') {
      const parsed = parseClaudeJsonObject(raw.text)
      if (!parsed) {
        console.warn('[score-narrative] Could not parse JSON from Claude response')
      } else {
        const email_opening =
          typeof parsed.email_opening === 'string' && parsed.email_opening.trim()
            ? parsed.email_opening.trim()
            : typeof parsed.narrative_summary === 'string' && parsed.narrative_summary.trim()
              ? parsed.narrative_summary.trim()
              : ''
        const narrative_extended =
          typeof parsed.narrative_extended === 'string' && parsed.narrative_extended.trim()
            ? parsed.narrative_extended.trim().replace(/\\n/g, '\n')
            : ''

        const category_notesRaw = parsed.category_notes
        const category_notes: Record<string, string> =
          category_notesRaw && typeof category_notesRaw === 'object' && !Array.isArray(category_notesRaw)
            ? (category_notesRaw as Record<string, string>)
            : {}

        for (const key of CATEGORY_KEYS) {
          if (!category_notes[key] || typeof category_notes[key] !== 'string') {
            category_notes[key] = `Scored ${scoresFromBreakdown(breakdown, key).toFixed(1)}/10 — see automated signals in the full audit.`
          }
        }

        if (email_opening && narrative_extended) {
          return { email_opening, narrative_extended, category_notes, usage }
        }
        if (email_opening || narrative_extended) {
          return {
            email_opening: email_opening || fallbackSummary(overall, breakdown),
            narrative_extended:
              narrative_extended ||
              `${email_opening || fallbackSummary(overall, breakdown)}\n\n${Object.entries(category_notes)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n\n')}`,
            category_notes,
            usage,
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[score-narrative] AI failed: ${(err as Error).message}`)
  }

  const fb = fallbackSummary(overall, breakdown)
  return {
    email_opening: fb,
    narrative_extended: fb,
    category_notes: Object.fromEntries(
      CATEGORY_KEYS.map((k) => [k, `Rated ${scoresFromBreakdown(breakdown, k).toFixed(1)}/10 from our automated audit.`])
    ) as Record<string, string>,
    usage,
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
