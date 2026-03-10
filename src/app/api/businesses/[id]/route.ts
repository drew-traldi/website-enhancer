import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: b, error } = await supabaseAdmin
    .from('businesses')
    .select(`
      id, name, address, phone, website, google_rating, google_review_count,
      status, notes,
      cities ( name, state ),
      website_scores (
        overall_score,
        responsive_score, visual_era_score, performance_score,
        security_score, accessibility_score, tech_stack_score,
        content_quality_score, ux_score,
        screenshot_before_url, scored_at
      ),
      rebuilds ( status, live_demo_url, built_at, screenshot_after_url ),
      outreach (
        id, status, sent_at, opened_at, clicked_at, contact_email,
        email_subject
      )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Flatten joined relations (Supabase returns arrays for 1:many even with 1 row)
  const city       = (b.cities as unknown as { name: string; state: string } | null)
  const rawScore   = Array.isArray(b.website_scores)  ? b.website_scores[0]  : b.website_scores
  const rawRebuild = Array.isArray(b.rebuilds)         ? b.rebuilds[0]        : b.rebuilds
  const rawOutreach = Array.isArray(b.outreach)        ? b.outreach[0]        : b.outreach

  // Parse screenshot URL(s) — stored as JSON array string or plain URL
  const parseScreenshots = (url: string | null): string[] => {
    if (!url) return []
    try { return JSON.parse(url) } catch { return [url] }
  }

  const normalized = {
    id:           b.id,
    name:         b.name,
    address:      b.address,
    city_name:    city?.name ?? '',
    state:        city?.state ?? '',
    rating:       b.google_rating,
    review_count: b.google_review_count,
    website_url:  b.website,
    phone:        b.phone,
    status:       b.status,
    notes:        (b as Record<string, unknown>).notes ?? null,

    website_score: rawScore ? {
      overall_score:   rawScore.overall_score,
      score_details: {
        responsive:     rawScore.responsive_score,
        visualEra:      rawScore.visual_era_score,
        performance:    rawScore.performance_score,
        security:       rawScore.security_score,
        accessibility:  rawScore.accessibility_score,
        techStack:      rawScore.tech_stack_score,
        contentQuality: rawScore.content_quality_score,
        ux:             rawScore.ux_score,
      },
      screenshot_urls: parseScreenshots(rawScore.screenshot_before_url),
      scored_at:       rawScore.scored_at,
    } : null,

    rebuild: rawRebuild ? {
      status:                rawRebuild.status,
      deployed_url:          rawRebuild.live_demo_url,
      deployed_at:           rawRebuild.built_at,
      after_screenshot_urls: parseScreenshots(rawRebuild.screenshot_after_url),
    } : null,

    outreach: rawOutreach ? {
      id:           rawOutreach.id,
      status:       rawOutreach.status,
      sent_at:      rawOutreach.sent_at,
      opened_at:    rawOutreach.opened_at,
      replied_at:   null,
      email_used:   rawOutreach.contact_email,
      subject_line: rawOutreach.email_subject,
    } : null,
  }

  return NextResponse.json(normalized)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const allowed = ['status', 'assigned_executive', 'notes']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabaseAdmin
    .from('businesses')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
