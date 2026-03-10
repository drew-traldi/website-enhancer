import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'
import { supabaseAdmin } from '@/lib/supabase'
import { buildEmail } from '@/pipeline/email-builder'

/**
 * Manual Outreach Actions API
 *
 * POST body actions:
 *   - send:       Send/resend email for a business (requires email in body or existing outreach)
 *   - set_email:  Update the contact email for an outreach record
 *   - skip:       Mark business as skipped
 *   - mark_replied: Mark as replied/converted
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, businessId, email, outreachId, executiveId, notes } = body

    if (!action || !businessId) {
      return NextResponse.json({ error: 'action and businessId required' }, { status: 400 })
    }

    switch (action) {
      case 'send':
        return await handleSend(businessId, email, executiveId)
      case 'set_email':
        return await handleSetEmail(businessId, outreachId, email)
      case 'skip':
        return await handleSkip(businessId, outreachId, notes)
      case 'mark_replied':
        return await handleMarkReplied(businessId, outreachId)
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

async function handleSend(businessId: string, email?: string, executiveId?: string) {
  // Load business + rebuild info
  const { data: biz } = await supabaseAdmin
    .from('businesses')
    .select(`
      id, name, website,
      cities ( name, state ),
      website_scores ( overall_score, screenshot_before_url ),
      rebuilds ( id, live_demo_url, screenshot_after_url ),
      outreach ( id, contact_email, executive_id )
    `)
    .eq('id', businessId)
    .single()

  if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const city = biz.cities as unknown as { name: string; state: string } | null
  const rebuild = Array.isArray(biz.rebuilds) ? biz.rebuilds[0] : biz.rebuilds
  const score = Array.isArray(biz.website_scores) ? biz.website_scores[0] : biz.website_scores
  const existingOutreach = Array.isArray(biz.outreach) ? biz.outreach[0] : biz.outreach

  if (!rebuild?.live_demo_url) {
    return NextResponse.json({ error: 'No rebuild demo available' }, { status: 400 })
  }

  const contactEmail = email || (existingOutreach as Record<string, unknown>)?.contact_email as string | null
  if (!contactEmail) {
    return NextResponse.json({ error: 'No email provided or found' }, { status: 400 })
  }

  // Get executive
  const execId = executiveId || (existingOutreach as Record<string, unknown>)?.executive_id as string | null
  const { data: exec } = await supabaseAdmin
    .from('executives')
    .select('id, full_name, email')
    .eq('id', execId ?? 'D')
    .single()

  if (!exec) return NextResponse.json({ error: 'Executive not found' }, { status: 404 })

  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'it@haiconsultingservices.com'
  const sendgridKey = process.env.SENDGRID_API_KEY
  if (!sendgridKey) return NextResponse.json({ error: 'SENDGRID_API_KEY not configured' }, { status: 500 })
  sgMail.setApiKey(sendgridKey)

  // Parse screenshot URLs
  const parseUrl = (url: string | null): string | null => {
    if (!url) return null
    try { const p = JSON.parse(url); return Array.isArray(p) ? p[0] : url } catch { return url }
  }

  const emailContent = await buildEmail({
    businessName: biz.name,
    city: city?.name ?? '',
    state: city?.state ?? '',
    score: score?.overall_score ?? 5,
    demoUrl: rebuild.live_demo_url,
    executiveName: exec.full_name,
    executiveEmail: exec.email,
    beforeScreenshotUrl: score?.screenshot_before_url ?? null,
    afterScreenshotUrl: parseUrl(rebuild.screenshot_after_url),
  })

  let sendgridMessageId: string | null = null
  try {
    const [response] = await sgMail.send({
      to: contactEmail,
      from: { email: fromEmail, name: `${exec.full_name} — HAI Custom Solutions` },
      replyTo: { email: exec.email, name: exec.full_name },
      subject: emailContent.subject,
      text: emailContent.textBody,
      html: emailContent.htmlBody,
      trackingSettings: {
        clickTracking: { enable: true, enableText: false },
        openTracking: { enable: true },
      },
      customArgs: { business_id: businessId },
    })
    sendgridMessageId = response?.headers?.['x-message-id'] ?? null
  } catch (sgErr) {
    return NextResponse.json({ error: `SendGrid: ${(sgErr as Error).message}` }, { status: 502 })
  }

  // Upsert outreach record
  if (existingOutreach) {
    await supabaseAdmin.from('outreach').update({
      contact_email: contactEmail,
      email_subject: emailContent.subject,
      email_body: emailContent.htmlBody,
      sendgrid_message_id: sendgridMessageId,
      sent_at: new Date().toISOString(),
      status: 'sent',
      executive_id: exec.id,
    }).eq('id', (existingOutreach as Record<string, unknown>).id)
  } else {
    await supabaseAdmin.from('outreach').insert({
      business_id: businessId,
      rebuild_id: rebuild.id,
      executive_id: exec.id,
      contact_email: contactEmail,
      contact_method: 'manual_email',
      email_subject: emailContent.subject,
      email_body: emailContent.htmlBody,
      sendgrid_message_id: sendgridMessageId,
      sent_at: new Date().toISOString(),
      status: 'sent',
    } as Record<string, unknown>)
  }

  await supabaseAdmin
    .from('businesses')
    .update({ status: 'email_sent', assigned_executive: exec.id })
    .eq('id', businessId)

  return NextResponse.json({ ok: true, email: contactEmail, messageId: sendgridMessageId })
}

async function handleSetEmail(businessId: string, outreachId?: string, email?: string) {
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  if (outreachId) {
    await supabaseAdmin.from('outreach').update({ contact_email: email }).eq('id', outreachId)
  } else {
    // Find or create outreach row
    const { data: existing } = await supabaseAdmin
      .from('outreach')
      .select('id')
      .eq('business_id', businessId)
      .limit(1)

    if (existing?.length) {
      await supabaseAdmin.from('outreach').update({ contact_email: email }).eq('id', existing[0].id)
    } else {
      await supabaseAdmin.from('outreach').insert({
        business_id: businessId,
        contact_email: email,
        contact_method: 'manual_email',
        status: 'draft',
      } as Record<string, unknown>)
    }
  }

  return NextResponse.json({ ok: true })
}

async function handleSkip(businessId: string, outreachId?: string, notes?: string) {
  if (outreachId) {
    await supabaseAdmin.from('outreach').update({
      status: 'skipped',
      contact_method: 'skipped',
      notes: notes ?? null,
    }).eq('id', outreachId)
  }

  await supabaseAdmin
    .from('businesses')
    .update({ status: 'skipped' })
    .eq('id', businessId)

  return NextResponse.json({ ok: true })
}

async function handleMarkReplied(businessId: string, outreachId?: string) {
  if (outreachId) {
    await supabaseAdmin.from('outreach').update({
      status: 'replied',
    }).eq('id', outreachId)
  }

  await supabaseAdmin
    .from('businesses')
    .update({ status: 'responded' })
    .eq('id', businessId)

  return NextResponse.json({ ok: true })
}
