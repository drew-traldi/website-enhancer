#!/usr/bin/env tsx
/**
 * CLI: Run the rebuild pipeline
 * Usage: npm run rebuild
 */
import 'dotenv/config'
import { runRebuildPipeline } from '@/pipeline/rebuild-orchestrator'

runRebuildPipeline()
  .then(results => {
    const succeeded = results.filter(r => r.success).length
    process.exit(succeeded > 0 ? 0 : 1)
  })
  .catch(err => {
    console.error('❌ Fatal error:', err.message)
    process.exit(1)
  })
