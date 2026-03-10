import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const [
    { count: discovered },
    { count: filtered },
    { count: scored },
    { count: rebuilt },
    { count: emailed },
    { data: cities },
    { data: recentBusinesses },
  ] = await Promise.all([
    supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'filtered'),
    supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'scored'),
    supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'rebuilt'),
    supabaseAdmin.from('outreach').select('*', { count: 'exact', head: true }).in('status', ['sent', 'opened', 'clicked', 'replied', 'converted']),
    supabaseAdmin.from('cities').select('id, name, state, last_run_at, total_businesses_found, batches_completed').order('last_run_at', { ascending: false }).limit(10),
    supabaseAdmin.from('businesses').select('status').in('status', ['queued_for_rebuild', 'rebuilding', 'rebuilt']),
  ])

  const queued = (recentBusinesses ?? []).filter(b => b.status === 'queued_for_rebuild').length
  const rebuilding = (recentBusinesses ?? []).filter(b => b.status === 'rebuilding').length
  const deployedRebuilds = (recentBusinesses ?? []).filter(b => b.status === 'rebuilt').length

  return NextResponse.json({
    funnel: {
      discovered: discovered ?? 0,
      filtered: filtered ?? 0,
      scored: scored ?? 0,
      queued,
      rebuilding,
      rebuilt: (rebuilt ?? 0) + deployedRebuilds,
      emailed: emailed ?? 0,
    },
    cities: cities ?? [],
  })
}
