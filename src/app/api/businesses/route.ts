import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/** Supabase returns 1:1 embed as object OR array depending on version/config */
function firstWebsiteScore(ws: unknown): { overall_score: number | null } | null {
  if (ws == null) return null
  if (Array.isArray(ws)) {
    const row = ws[0] as { overall_score?: number | null } | undefined
    return row ? { overall_score: row.overall_score ?? null } : null
  }
  if (typeof ws === 'object' && ws !== null && 'overall_score' in ws) {
    const row = ws as { overall_score: number | null }
    return { overall_score: row.overall_score ?? null }
  }
  return null
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const cityId = searchParams.get('city_id')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const passedFilter = searchParams.get('passed_filter')
  const hasScore = searchParams.get('has_score')
  const rebuiltStage = searchParams.get('rebuilt_stage')
  const sort = searchParams.get('sort')
  const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const perPage = Math.min(100, parseInt(searchParams.get('per_page') ?? '25'))

  const sortByScore = sort === 'overall_score'
  const requireScore = sortByScore || hasScore === '1' || hasScore === 'true'

  const selectCols = requireScore
    ? `
      id, name, address, phone, website, google_rating, google_review_count, status, discovered_at,
      cities ( name, state ),
      website_scores!inner ( overall_score )
    `
    : `
      id, name, address, phone, website, google_rating, google_review_count, status, discovered_at,
      cities ( name, state ),
      website_scores ( overall_score )
    `

  let query = supabaseAdmin
    .from('businesses')
    .select(selectCols, { count: 'exact' })
    .range((page - 1) * perPage, page * perPage - 1)

  if (cityId) query = query.eq('city_id', cityId)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (passedFilter === '1' || passedFilter === 'true') {
    query = query.neq('status', 'discovered')
  }

  if (rebuiltStage === '1' || rebuiltStage === 'true') {
    query = query.in('status', ['rebuilt', 'email_sent', 'manual_required', 'responded'])
  }

  if (search?.trim()) {
    const q = search.trim().replace(/%/g, '\\%').replace(/,/g, '\\,')
    query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`)
  }

  if (sortByScore) {
    query = query.order('overall_score', {
      ascending: order === 'asc',
      foreignTable: 'website_scores',
    })
  } else {
    query = query.order('discovered_at', { ascending: false })
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const businesses = (data ?? []).map((b: Record<string, unknown>) => {
    const city = b.cities as { name: string; state: string } | null
    const scoreRow = firstWebsiteScore(b.website_scores)
    return {
      id: b.id,
      name: b.name,
      address: b.address,
      city_name: city?.name ?? '',
      state: city?.state ?? '',
      rating: b.google_rating,
      review_count: b.google_review_count,
      website_url: b.website,
      phone: b.phone,
      status: b.status,
      score: scoreRow?.overall_score ?? null,
    }
  })

  return NextResponse.json({ businesses, total: count ?? 0, page, per_page: perPage })
}
