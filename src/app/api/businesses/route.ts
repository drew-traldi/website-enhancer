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

function firstBusiness(biz: unknown): Record<string, unknown> | null {
  if (biz == null) return null
  if (Array.isArray(biz)) return (biz[0] as Record<string, unknown>) ?? null
  if (typeof biz === 'object') return biz as Record<string, unknown>
  return null
}

/**
 * Sort by score: query website_scores first and ORDER BY overall_score.
 * PostgREST does not reliably sort parent businesses rows by an embedded
 * website_scores column — ordering the root table fixes numeric ASC/DESC.
 */
async function listSortedByScore(params: {
  cityId: string | null
  status: string | null
  passedFilter: boolean
  rebuiltStage: boolean
  search: string | null
  order: 'asc' | 'desc'
  page: number
  perPage: number
}) {
  const {
    cityId,
    status,
    passedFilter,
    rebuiltStage,
    search,
    order,
    page,
    perPage,
  } = params

  let query = supabaseAdmin
    .from('website_scores')
    .select(
      `
      overall_score,
      businesses!inner (
        id, name, address, phone, website, google_rating, google_review_count, status, discovered_at, city_id,
        cities ( name, state )
      )
    `,
      { count: 'exact' }
    )
    .order('overall_score', { ascending: order === 'asc' })
    .range((page - 1) * perPage, page * perPage - 1)

  if (cityId) query = query.eq('businesses.city_id', cityId)

  if (status && status !== 'all') {
    query = query.eq('businesses.status', status)
  }

  if (passedFilter) {
    query = query.neq('businesses.status', 'discovered')
  }

  if (rebuiltStage) {
    query = query.in('businesses.status', [
      'rebuilt',
      'email_sent',
      'manual_required',
      'responded',
    ])
  }

  if (search?.trim()) {
    const q = search.trim().replace(/%/g, '\\%').replace(/,/g, '\\,')
    query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`, {
      foreignTable: 'businesses',
    })
  }

  return query
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
  const requireScore =
    sortByScore || hasScore === '1' || hasScore === 'true'

  if (sortByScore) {
    const { data, error, count } = await listSortedByScore({
      cityId,
      status,
      passedFilter: passedFilter === '1' || passedFilter === 'true',
      rebuiltStage: rebuiltStage === '1' || rebuiltStage === 'true',
      search: search?.trim() ?? null,
      order,
      page,
      perPage,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const businesses = (data ?? []).map((row: Record<string, unknown>) => {
      const b = firstBusiness(row.businesses)
      if (!b) {
        return null
      }
      const city = b.cities as { name: string; state: string } | null
      const scoreVal = row.overall_score
      const score =
        typeof scoreVal === 'number' ? scoreVal : scoreVal != null ? Number(scoreVal) : null
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
        score: Number.isFinite(score as number) ? (score as number) : null,
      }
    }).filter(Boolean)

    return NextResponse.json({
      businesses,
      total: count ?? 0,
      page,
      per_page: perPage,
    })
  }

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
    query = query.in('status', [
      'rebuilt',
      'email_sent',
      'manual_required',
      'responded',
    ])
  }

  if (search?.trim()) {
    const q = search.trim().replace(/%/g, '\\%').replace(/,/g, '\\,')
    query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`)
  }

  query = query.order('discovered_at', { ascending: false })

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
