import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Pipeline funnel counts (mutually consistent definitions):
 * - total:        all business rows in DB
 * - discovered:   still status=discovered (failed filter or not yet re-run)
 * - filtered:     passed activity filter (any status beyond discovered)
 * - scored:       has a website_scores row (modernity audit done)
 * - rebuilt:      demo deployed / past rebuild (rebuilt + downstream statuses)
 * - emailed:      outreach sent (or equivalent)
 * - queued / rebuilding: current rebuild queue
 */
export async function GET() {
  const [
    { count: total },
    { count: stillDiscovered },
    { count: passedFilter },
    { count: scoredRows },
    { data: narrativeRows },
    { count: rebuiltStage },
    { count: queued },
    { count: rebuilding },
    { count: emailed },
    { data: cities },
  ] = await Promise.all([
    supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'discovered'),
    supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }).neq('status', 'discovered'),
    supabaseAdmin.from('website_scores').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('website_scores').select('details'),
    supabaseAdmin
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .in('status', ['rebuilt', 'email_sent', 'manual_required', 'responded']),
    supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'queued_for_rebuild'),
    supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'rebuilding'),
    supabaseAdmin
      .from('outreach')
      .select('*', { count: 'exact', head: true })
      .in('status', ['sent', 'opened', 'clicked', 'replied', 'converted']),
    supabaseAdmin
      .from('cities')
      .select('id, name, state, last_run_at, total_businesses_found, batches_completed')
      .order('last_run_at', { ascending: false })
      .limit(10),
  ])

  const narrativeCrafted = (narrativeRows ?? []).reduce((acc, row: { details: unknown }) => {
    const details = row.details as Record<string, unknown> | null
    const hasOpening =
      typeof details?.email_opening === 'string' && details.email_opening.trim().length > 0
    const hasExtended =
      typeof details?.narrative_extended === 'string' && details.narrative_extended.trim().length > 0
    return hasOpening || hasExtended ? acc + 1 : acc
  }, 0)

  return NextResponse.json({
    funnel: {
      total: total ?? 0,
      discovered: total ?? 0,
      filtered: passedFilter ?? 0,
      scored: scoredRows ?? 0,
      narrative_crafted: narrativeCrafted,
      queued: queued ?? 0,
      rebuilding: rebuilding ?? 0,
      rebuilt: rebuiltStage ?? 0,
      emailed: emailed ?? 0,
      still_discovered: stillDiscovered ?? 0,
    },
    cities: cities ?? [],
  })
}
