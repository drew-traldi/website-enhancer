import { NextRequest, NextResponse } from 'next/server'
import { runOutreachPipeline } from '@/pipeline/outreach-orchestrator'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const city = body.city && body.state ? `${body.city}, ${body.state}` : undefined
    const result = await runOutreachPipeline(city)
    return NextResponse.json({
      ok: true,
      emailsSent: result.emailsSent,
      manualRequired: result.manualRequired,
      errors: result.errors,
      total: result.totalProcessed,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 500 })
  }
}
