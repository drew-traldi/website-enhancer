import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const cityId  = searchParams.get('city_id')
  const status  = searchParams.get('status')
  const search  = searchParams.get('search')
  const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const perPage = Math.min(100, parseInt(searchParams.get('per_page') ?? '25'))

  let query = supabaseAdmin
    .from('businesses')
    .select(`
      id, name, address, phone, website, google_rating, google_review_count, status,
      cities ( name, state ),
      website_scores ( overall_score )
    `, { count: 'exact' })
    .order('discovered_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (cityId) query = query.eq('city_id', cityId)
  if (status) query = query.eq('status', status)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Normalize to the shape pages expect
  const businesses = (data ?? []).map((b: Record<string, unknown>) => {
    const city   = b.cities as { name: string; state: string } | null
    const scores = b.website_scores as Array<{ overall_score: number }> | null
    return {
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
      score:        scores?.[0]?.overall_score ?? null,
    }
  })

  return NextResponse.json({ businesses, total: count ?? 0, page, per_page: perPage })
}
