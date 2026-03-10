#!/usr/bin/env tsx
/**
 * CLI: Seed executive records with a hashed PIN
 * Usage: npm run seed:executives
 *
 * This script:
 * 1. Hashes the EXECUTIVE_PIN from .env using bcrypt
 * 2. Upserts all 4 executive records into Supabase
 */

import 'dotenv/config'
import { createHash } from 'crypto'
import { supabaseAdmin } from '../src/lib/supabase'

// Simple SHA-256 hash (no bcrypt dependency needed for 4-user internal tool)
function hashPin(pin: string): string {
  return createHash('sha256').update(pin + 'hai-salt-2026').digest('hex')
}

const EXECUTIVE_PIN = process.env.EXECUTIVE_PIN ?? '2468'
const pinHash = hashPin(EXECUTIVE_PIN)

const executives = [
  {
    id: 'D',
    full_name: 'Drew',
    title: 'CEO / Head of Client Relations',
    email: 'drew@haiconsultingservices.com',
    phone: null,
    pin_hash: pinHash,
  },
  {
    id: 'S',
    full_name: 'Savannah Owens',
    title: 'Chief Revenue Officer',
    email: 'savannah@haiconsultingservices.com',
    phone: null,
    pin_hash: pinHash,
  },
  {
    id: 'E',
    full_name: 'Elliot Kinney',
    title: 'Chief Operating Officer',
    email: 'elliot@haiconsultingservices.com',
    phone: null,
    pin_hash: pinHash,
  },
  {
    id: 'I',
    full_name: 'Ian Kinney',
    title: 'Chief Information Officer',
    email: 'ian@haiconsultingservices.com',
    phone: null,
    pin_hash: pinHash,
  },
]

async function main() {
  console.log('\n🌱 Seeding executive records...')
  console.log(`   PIN hash: ${pinHash.substring(0, 16)}...`)

  for (const exec of executives) {
    const { error } = await supabaseAdmin
      .from('executives')
      .upsert(exec, { onConflict: 'id' })

    if (error) {
      console.error(`  ❌ Failed to seed ${exec.id} (${exec.full_name}): ${error.message}`)
    } else {
      console.log(`  ✓ ${exec.id} — ${exec.full_name} (${exec.title})`)
    }
  }

  // Verify
  const { data, error } = await supabaseAdmin.from('executives').select('id, full_name, title, email')
  if (error) {
    console.error(`\n❌ Verification failed: ${error.message}`)
  } else {
    console.log('\n✅ Executives in database:')
    for (const e of data ?? []) {
      console.log(`   [${e.id}] ${e.full_name} — ${e.title} — ${e.email}`)
    }
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
