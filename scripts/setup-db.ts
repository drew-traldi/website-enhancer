#!/usr/bin/env tsx
/**
 * CLI: Database Setup Verification
 * Usage: npm run setup:db
 *
 * Verifies the Supabase connection and checks that all tables exist.
 * Prints a summary of what's in the DB.
 */

import 'dotenv/config'
import { supabaseAdmin } from '../src/lib/supabase'

const TABLES = ['executives', 'cities', 'businesses', 'website_scores', 'rebuilds', 'outreach']

async function main() {
  console.log('\n🔍 Checking Supabase connection and schema...')
  console.log(`   URL: ${process.env.SUPABASE_URL}`)

  let allGood = true

  for (const table of TABLES) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error(`  ❌ Table "${table}": ${error.message}`)
      allGood = false
    } else {
      console.log(`  ✓ Table "${table}": ${count ?? 0} rows`)
    }
  }

  if (allGood) {
    console.log('\n✅ All tables are accessible!')
  } else {
    console.log('\n⚠  Some tables are missing. Run the schema.sql in the Supabase SQL Editor first.')
    console.log('   File: supabase/schema.sql')
  }

  process.exit(allGood ? 0 : 1)
}

main().catch((err) => {
  console.error('❌ DB check failed:', err.message)
  process.exit(1)
})
