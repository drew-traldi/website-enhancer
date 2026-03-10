import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPin, createSessionToken, COOKIE_CONFIG } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { id, pin } = await req.json()

  if (!id || !pin) {
    return NextResponse.json({ error: 'ID and PIN required' }, { status: 400 })
  }

  const { data: exec, error } = await supabaseAdmin
    .from('executives')
    .select('id, full_name, pin_hash')
    .eq('id', id)
    .single()

  if (error || !exec) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const pinHash = hashPin(pin)
  if (pinHash !== exec.pin_hash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = createSessionToken(exec.id, exec.full_name)
  const res = NextResponse.json({ ok: true, id: exec.id, name: exec.full_name })
  res.cookies.set({ ...COOKIE_CONFIG, value: token })
  return res
}
