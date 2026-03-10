import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * SendGrid Event Webhook Handler
 *
 * Receives event notifications from SendGrid (delivered, opened, clicked, bounced, etc.)
 * and updates the outreach table accordingly.
 *
 * Configure in SendGrid: Settings → Mail Settings → Event Webhook
 * POST URL: https://your-domain.com/api/webhooks/sendgrid
 */

interface SendGridEvent {
  event: 'delivered' | 'open' | 'click' | 'bounce' | 'dropped' | 'spamreport' | 'unsubscribe' | 'deferred'
  sg_message_id?: string
  email?: string
  timestamp?: number
  url?: string
  business_id?: string  // from customArgs
}

export async function POST(req: NextRequest) {
  try {
    const events: SendGridEvent[] = await req.json()

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'Expected array of events' }, { status: 400 })
    }

    let processed = 0
    let skipped = 0

    for (const event of events) {
      const messageId = event.sg_message_id?.split('.')[0]
      if (!messageId && !event.business_id) {
        skipped++
        continue
      }

      // Find the outreach record
      let query = supabaseAdmin.from('outreach').select('id, status')

      if (messageId) {
        query = query.eq('sendgrid_message_id', messageId)
      } else if (event.business_id) {
        query = query.eq('business_id', event.business_id).order('created_at', { ascending: false })
      }

      const { data: rows } = await query.limit(1)
      const outreach = rows?.[0]
      if (!outreach) {
        skipped++
        continue
      }

      const now = event.timestamp
        ? new Date(event.timestamp * 1000).toISOString()
        : new Date().toISOString()

      const updates: Record<string, unknown> = {}

      switch (event.event) {
        case 'open':
          updates.opened_at = now
          if (shouldUpgradeStatus(outreach.status, 'opened')) {
            updates.status = 'opened'
          }
          break

        case 'click':
          updates.clicked_at = now
          if (shouldUpgradeStatus(outreach.status, 'clicked')) {
            updates.status = 'clicked'
          }
          break

        case 'bounce':
        case 'dropped':
          updates.bounced = true
          updates.status = 'skipped'
          break

        case 'delivered':
          if (outreach.status === 'draft') {
            updates.status = 'sent'
            updates.sent_at = now
          }
          break

        default:
          skipped++
          continue
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('outreach')
          .update(updates)
          .eq('id', outreach.id)
        processed++

        // Also update business status for clicks (high-value signal)
        if (event.event === 'click' && event.business_id) {
          await supabaseAdmin
            .from('businesses')
            .update({ status: 'responded' })
            .eq('id', event.business_id)
            .in('status', ['email_sent'])
        }
      }
    }

    return NextResponse.json({ processed, skipped })
  } catch (err) {
    console.error('[webhook/sendgrid]', (err as Error).message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

const STATUS_ORDER = ['draft', 'sent', 'opened', 'clicked', 'replied', 'converted']

function shouldUpgradeStatus(current: string, proposed: string): boolean {
  const currentIdx = STATUS_ORDER.indexOf(current)
  const proposedIdx = STATUS_ORDER.indexOf(proposed)
  return proposedIdx > currentIdx
}
