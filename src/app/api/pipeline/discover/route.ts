import { NextRequest, NextResponse } from 'next/server'

// Allow long-running discovery (up to 5 min in production)
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json()
  const city  = body.city?.trim()
  const state = body.state?.trim()

  if (!city)  return NextResponse.json({ error: 'city is required' }, { status: 400 })
  if (!state) return NextResponse.json({ error: 'state is required' }, { status: 400 })

  try {
    const { runDiscovery } = await import('@/pipeline/orchestrator')
    const result = await runDiscovery(`${city}, ${state}`)
    return NextResponse.json({
      ok:         true,
      discovered: result.businessesFound,
      filtered:   result.businessesFiltered,
      saved:      result.businessesSaved,
      message:    `Discovery complete for ${result.city}, ${result.state} (Batch #${result.batchNumber})`,
    })
  } catch (err) {
    console.error('[discover]', err)
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 })
  }
}
