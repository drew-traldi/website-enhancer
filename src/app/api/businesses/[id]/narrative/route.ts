import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateScoreNarrativesFromStoredRow } from '@/pipeline/score-narrative'

export const maxDuration = 300

/**
 * POST — Regenerate AI narrative for an existing score (e.g. Vincent Dental after launch).
 * Merges into website_scores.details without re-running the full score pipeline.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { data: b, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select(`id, name, cities ( name, state ), website_scores ( * )`)
      .eq('id', id)
      .single()

    if (bizErr || !b) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }

    const city = b.cities as unknown as { name: string; state: string } | null
    const ws = Array.isArray(b.website_scores) ? b.website_scores[0] : b.website_scores
    if (!ws) {
      return NextResponse.json({ ok: false, error: 'No website score for this business' }, { status: 400 })
    }

    const existingDetails = (ws.details as Record<string, unknown> | null) ?? {}

    const payload = await generateScoreNarrativesFromStoredRow(
      b.name,
      city?.name ?? '',
      city?.state ?? '',
      {
        overall_score: ws.overall_score,
        responsive_score: ws.responsive_score,
        visual_era_score: ws.visual_era_score,
        performance_score: ws.performance_score,
        security_score: ws.security_score,
        accessibility_score: ws.accessibility_score,
        tech_stack_score: ws.tech_stack_score,
        content_quality_score: ws.content_quality_score,
        ux_score: ws.ux_score,
        details: existingDetails,
      }
    )

    const mergedDetails = {
      ...existingDetails,
      email_opening: payload.email_opening,
      narrative_extended: payload.narrative_extended,
      narrative_summary: payload.email_opening,
      category_notes: payload.category_notes,
      narrative_generated_at: new Date().toISOString(),
    }

    const { error: upErr } = await supabaseAdmin
      .from('website_scores')
      .update({ details: mergedDetails })
      .eq('business_id', id)

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      email_opening: payload.email_opening,
      narrative_extended: payload.narrative_extended,
      category_notes: payload.category_notes,
    })
  } catch (err) {
    console.error('[narrative]', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
