import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data: rebuild, error } = await supabaseAdmin
    .from('rebuilds')
    .select('demo_html, demo_kind, live_demo_url')
    .eq('demo_slug', slug)
    .order('built_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !rebuild) {
    return new Response('Demo not found.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }

  if (rebuild.demo_kind === 'app_hosted' && rebuild.demo_html) {
    return new Response(rebuild.demo_html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    })
  }

  if (rebuild.live_demo_url && /^https?:\/\//i.test(rebuild.live_demo_url)) {
    return Response.redirect(rebuild.live_demo_url, 307)
  }

  return new Response('Demo content unavailable.', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
