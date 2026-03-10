#!/usr/bin/env tsx
/**
 * Add unique constraints needed for upserts (safe via DO block)
 */
import 'dotenv/config'
import { Client } from 'pg'

async function main() {
  const projectRef = process.env.SUPABASE_URL!.replace('https://', '').replace('.supabase.co', '')
  const dbPass = process.env.SUPABASE_DB_PASSWORD!
  const client = new Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(dbPass)}@db.${projectRef}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const patches = [
    {
      name: 'website_scores_business_id_unique',
      type: 'constraint',
      sql: `ALTER TABLE website_scores ADD CONSTRAINT website_scores_business_id_unique UNIQUE (business_id)`,
    },
    {
      name: 'rebuilds_business_id_unique',
      type: 'constraint',
      sql: `ALTER TABLE rebuilds ADD CONSTRAINT rebuilds_business_id_unique UNIQUE (business_id)`,
    },
    {
      name: 'businesses.notes',
      type: 'column',
      checkSql: `SELECT 1 FROM information_schema.columns WHERE table_name='businesses' AND column_name='notes'`,
      sql: `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notes TEXT`,
    },
  ]

  for (const patch of patches) {
    if (patch.type === 'constraint') {
      // Check if constraint already exists first
      const { rows } = await client.query(
        `SELECT 1 FROM pg_constraint WHERE conname = $1`,
        [patch.name]
      )
      if (rows.length > 0) {
        console.log(`  ~ Already exists: ${patch.name}`)
      } else {
        await client.query(patch.sql!)
        console.log(`  ✓ Added: ${patch.name}`)
      }
    } else if (patch.type === 'column') {
      const { rows } = await client.query(patch.checkSql!)
      if (rows.length > 0) {
        console.log(`  ~ Column already exists: ${patch.name}`)
      } else {
        await client.query(patch.sql!)
        console.log(`  ✓ Added column: ${patch.name}`)
      }
    }
  }

  await client.end()
  console.log('\n✅ Patch complete')
  process.exit(0)
}

main().catch((err) => { console.error('❌', err.message); process.exit(1) })
