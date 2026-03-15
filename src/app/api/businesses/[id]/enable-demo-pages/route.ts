/**
 * Enable GitHub Pages on an existing repo and link it to this business.
 * Use when the repo was already created (e.g. by a previous rebuild that timed out
 * before DB update). Body: { slug: string } e.g. "hai-demo-monge-associates-injury-and-ac-roswell"
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { enablePagesOnExistingRepo } from '@/pipeline/deployer'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const slug = typeof (body as { slug?: string }).slug === 'string'
      ? (body as { slug: string }).slug.trim()
      : null

    if (!slug) {
      return NextResponse.json(
        { error: 'Request body must include { "slug": "hai-demo-..." }' },
        { status: 400 }
      )
    }

    const { data: biz, error: fetchErr } = await supabaseAdmin
      .from('businesses')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchErr || !biz) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const deploy = await enablePagesOnExistingRepo(slug)

    if (!deploy.deployed) {
      return NextResponse.json(
        { ok: false, error: deploy.error ?? 'Failed to enable GitHub Pages' },
        { status: 502 }
      )
    }

    const { data: existingRebuilds } = await supabaseAdmin
      .from('rebuilds')
      .select('id')
      .eq('business_id', id)
      .limit(1)

    const rebuildId = existingRebuilds?.[0]?.id

    if (rebuildId) {
      await supabaseAdmin
        .from('rebuilds')
        .update({
          status:           'deployed',
          live_demo_url:     deploy.pagesUrl,
          github_repo_url:   deploy.repoUrl,
          built_at:          new Date().toISOString(),
        })
        .eq('id', rebuildId)
    } else {
      await supabaseAdmin
        .from('rebuilds')
        .insert({
          business_id:     id,
          status:          'deployed',
          live_demo_url:   deploy.pagesUrl,
          github_repo_url: deploy.repoUrl,
          built_at:        new Date().toISOString(),
        })
    }

    await supabaseAdmin
      .from('businesses')
      .update({ status: 'rebuilt' })
      .eq('id', id)

    return NextResponse.json({
      ok:       true,
      pagesUrl: deploy.pagesUrl,
      repoUrl:  deploy.repoUrl,
    })
  } catch (err) {
    console.error('[enable-demo-pages]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
