#!/usr/bin/env tsx
/**
 * CLI: Create Supabase Storage buckets
 * Usage: npm run setup:storage
 */

import 'dotenv/config'
import { supabaseAdmin } from '../src/lib/supabase'

const BUCKETS = [
  { name: 'screenshots', public: true },
]

async function main() {
  console.log('\n🗄  Setting up Supabase Storage buckets...')

  for (const bucket of BUCKETS) {
    // Check if bucket exists
    const { data: existing } = await supabaseAdmin.storage.getBucket(bucket.name)

    if (existing) {
      console.log(`  ✓ Bucket "${bucket.name}" already exists`)
      continue
    }

    const { error } = await supabaseAdmin.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: 5242880, // 5MB per screenshot
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })

    if (error) {
      console.error(`  ❌ Failed to create bucket "${bucket.name}": ${error.message}`)
    } else {
      console.log(`  ✓ Created bucket "${bucket.name}" (public: ${bucket.public})`)
    }
  }

  console.log('\n✅ Storage setup complete')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Storage setup failed:', err.message)
  process.exit(1)
})
