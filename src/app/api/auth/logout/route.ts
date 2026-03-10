import { NextResponse } from 'next/server'
import { COOKIE_CONFIG } from '@/lib/auth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({ ...COOKIE_CONFIG, value: '', maxAge: 0 })
  return res
}
