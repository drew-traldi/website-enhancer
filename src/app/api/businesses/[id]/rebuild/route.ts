/**
 * Single-Business Rebuild Trigger
 *
 * Queues a specific business for rebuild and runs the pipeline immediately.
 * Accepts optional executiveNotes for personalized build context.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const { executiveNotes } = body as { executiveNotes?: string }

    // Verify business exists
    const { data: biz, error: fetchErr } = await supabaseAdmin
      .from('businesses')
      .select('id, name, status')
      .eq('id', id)
      .single()

    if (fetchErr || !biz) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Ensure there's no active rebuild already in progress
    if (biz.status === 'rebuilding') {
      return NextResponse.json({ error: 'A rebuild is already in progress for this business.' }, { status: 409 })
    }

    // Update status + save executive notes
    const updates: Record<string, unknown> = { status: 'queued_for_rebuild' }
    if (executiveNotes?.trim()) updates.notes = executiveNotes.trim()

    await supabaseAdmin
      .from('businesses')
      .update(updates)
      .eq('id', id)

    // Run rebuild pipeline targeting only this business
    const { runRebuildPipeline } = await import('@/pipeline/rebuild-orchestrator')
    const results = await runRebuildPipeline(1, id)

    const result = results[0]
    if (!result) {
      return NextResponse.json({ error: 'Rebuild pipeline returned no results.' }, { status: 500 })
    }

    return NextResponse.json({
      ok:       result.success,
      pagesUrl: result.pagesUrl,
      error:    result.error,
    })
  } catch (err) {
    console.error('[rebuild/id]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
