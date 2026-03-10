#!/usr/bin/env tsx
/**
 * CLI: Run the schema.sql against Supabase via direct Postgres connection
 * Usage: npm run db:migrate
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Client } from 'pg'

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL!
  // Extract project ref from URL: https://{ref}.supabase.co
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
  const dbPass = process.env.SUPABASE_DB_PASSWORD!

  // Supabase direct connection (non-pooled, IPv4)
  const connectionString = `postgresql://postgres:${encodeURIComponent(dbPass)}@db.${projectRef}.supabase.co:5432/postgres`

  console.log('\n🗄  Running schema migration...')
  console.log(`   Project: ${projectRef}`)

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    console.log('   ✓ Connected to Postgres')

    const schemaPath = join(process.cwd(), 'supabase', 'schema.sql')
    const sql = readFileSync(schemaPath, 'utf-8')

    await client.query(sql)
    console.log('   ✓ Schema applied successfully')

    // Verify tables exist
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `)

    console.log('\n✅ Tables in public schema:')
    for (const row of res.rows) {
      console.log(`   - ${row.table_name}`)
    }
  } finally {
    await client.end()
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Migration failed:', err.message)
  process.exit(1)
})
