/**
 * Auth utilities — PIN-based auth for 4 HAI executives
 * Session stored as an HTTP-only cookie containing the executive ID
 */

import { createHash } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'hai_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function hashPin(pin: string): string {
  return createHash('sha256').update(pin + 'hai-salt-2026').digest('hex')
}

export async function getSession(): Promise<{ id: string; name: string } | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get(COOKIE_NAME)
  if (!session?.value) return null

  try {
    const parsed = JSON.parse(Buffer.from(session.value, 'base64').toString('utf8'))
    if (!parsed?.id) return null
    return parsed
  } catch {
    return null
  }
}

export function createSessionToken(id: string, name: string): string {
  return Buffer.from(JSON.stringify({ id, name })).toString('base64')
}

export const COOKIE_CONFIG = {
  name: COOKIE_NAME,
  maxAge: COOKIE_MAX_AGE,
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
}
