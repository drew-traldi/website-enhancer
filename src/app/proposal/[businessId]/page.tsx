import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'

function parseScreenshots(url: string | null): string[] {
  if (!url) return []
  try {
    const parsed = JSON.parse(url) as unknown
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
    if (typeof parsed === 'string') return [parsed]
  } catch {
    return [url]
  }
  return []
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params

  const { data, error } = await supabaseAdmin
    .from('businesses')
    .select(`
      id, name, status, website,
      cities ( name, state ),
      website_scores (
        overall_score, screenshot_before_url, details
      ),
      rebuilds (
        demo_slug, live_demo_url, proposal_url, screenshot_after_url, built_at, status
      )
    `)
    .eq('id', businessId)
    .single()

  if (error || !data) notFound()

  const cityRaw = data.cities as unknown
  const city = (Array.isArray(cityRaw) ? cityRaw[0] : cityRaw) as { name: string; state: string } | null
  const scoreRow = Array.isArray(data.website_scores) ? data.website_scores[0] : data.website_scores
  const rebuildRows = Array.isArray(data.rebuilds) ? data.rebuilds : data.rebuilds ? [data.rebuilds] : []
  const rebuild =
    rebuildRows.find((r: Record<string, unknown>) => r.status === 'deployed') ??
    rebuildRows[0] ??
    null

  const details = (scoreRow?.details as Record<string, unknown> | null) ?? null
  const narrative =
    (typeof details?.narrative_extended === 'string' && details.narrative_extended.trim()) ||
    (typeof details?.email_opening === 'string' && details.email_opening.trim()) ||
    (typeof details?.narrative_summary === 'string' && details.narrative_summary.trim()) ||
    'We reviewed your current website and prepared a modern, conversion-focused concept based on your existing brand and services.'

  const before = parseScreenshots(scoreRow?.screenshot_before_url ?? null)[0] ?? null
  const after = parseScreenshots(rebuild?.screenshot_after_url ?? null)[0] ?? null
  const demoUrl =
    rebuild?.demo_slug ? `/demos/${rebuild.demo_slug}` : rebuild?.live_demo_url ?? null

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/80">HAI Website Opportunity</p>
          <h1 className="mt-2 text-3xl font-semibold">{data.name}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {city?.name}, {city?.state} · Website audit score:{' '}
            <span className="font-semibold text-white">
              {(scoreRow?.overall_score ?? 0).toFixed(1)}/10
            </span>
          </p>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-medium">What we built for you</h2>
          <p className="mt-3 whitespace-pre-line text-slate-300">{narrative}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {demoUrl && (
              <Link
                href={demoUrl}
                className="rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
              >
                View Live Demo
              </Link>
            )}
            <a
              href="https://www.haiconsultingservices.com/contact"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500"
            >
              Talk with HAI
            </a>
          </div>
        </section>

        {(before || after) && (
          <section className="mt-8 grid gap-5 sm:grid-cols-2">
            {before && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Current Site</p>
                <img src={before} alt="Current website screenshot" className="w-full rounded-md" />
              </div>
            )}
            {after && (
              <div className="rounded-xl border border-cyan-700/50 bg-slate-900/60 p-3">
                <p className="mb-2 text-xs uppercase tracking-wider text-cyan-300">HAI Demo Preview</p>
                <img src={after} alt="Redesigned website screenshot" className="w-full rounded-md" />
              </div>
            )}
          </section>
        )}

        {demoUrl && (
          <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="mb-3 text-xs uppercase tracking-wider text-slate-400">Interactive Preview</p>
            <iframe
              src={demoUrl}
              title={`${data.name} demo`}
              className="h-[640px] w-full rounded-md border border-slate-800"
              sandbox="allow-scripts allow-forms allow-same-origin"
            />
          </section>
        )}

        <footer className="mt-10 text-xs text-slate-500">
          Demo prepared by HAI Custom Solutions. This preview is for review and strategy discussion.
        </footer>
      </div>
    </main>
  )
}
