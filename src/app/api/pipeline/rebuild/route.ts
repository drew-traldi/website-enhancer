import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const count = Math.min(Math.max(parseInt(body?.count) || 5, 1), 15)

    const { runRebuildPipeline } = await import('@/pipeline/rebuild-orchestrator')
    const results = await runRebuildPipeline(count)
    const succeeded = results.filter(r => r.success)
    const failed    = results.filter(r => !r.success)
    return NextResponse.json({
      ok:        true,
      total:     results.length,
      succeeded: succeeded.length,
      failed:    failed.length,
      results,
    })
  } catch (err) {
    console.error('[rebuild]', err)
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 })
  }
}
