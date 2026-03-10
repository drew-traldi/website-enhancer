import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data: rows, error } = await supabaseAdmin
    .from('outreach')
    .select(`
      status, sent_at, opened_at, clicked_at, contact_email, email_subject,
      businesses ( name )
    `)
    .order('sent_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total_sent    = rows?.filter(r => r.sent_at).length ?? 0
  const total_opened  = rows?.filter(r => r.opened_at).length ?? 0
  const total_clicked = rows?.filter(r => r.clicked_at).length ?? 0
  // "replied" is tracked via status field
  const total_replied = rows?.filter(r => r.status === 'replied' || r.status === 'converted').length ?? 0

  const pct = (n: number) => total_sent > 0 ? Math.round((n / total_sent) * 100) : 0

  const recent = (rows ?? []).slice(0, 20).map(r => ({
    business_name: (r.businesses as unknown as { name: string } | null)?.name ?? 'Unknown',
    email_used:    r.contact_email ?? '—',
    status:        r.status,
    sent_at:       r.sent_at,
    opened_at:     r.opened_at,
    replied_at:    r.status === 'replied' ? r.opened_at : null, // best proxy
  }))

  return NextResponse.json({
    total_sent,
    total_opened,
    total_clicked,
    total_replied,
    open_rate:   pct(total_opened),
    click_rate:  pct(total_clicked),
    reply_rate:  pct(total_replied),
    recent,
  })
}
