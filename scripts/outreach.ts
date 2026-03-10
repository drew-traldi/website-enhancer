#!/usr/bin/env tsx
/**
 * CLI: Run the outreach pipeline
 * Usage: npm run outreach -- --city "Roswell, GA"
 */
import 'dotenv/config'
import { runOutreachPipeline } from '@/pipeline/outreach-orchestrator'

const cityArg = process.argv.find((_, i) => process.argv[i - 1] === '--city')

runOutreachPipeline(cityArg || undefined)
  .then(result => {
    process.exit(result.emailsSent > 0 || result.manualRequired > 0 ? 0 : 1)
  })
  .catch(err => {
    console.error('❌ Fatal error:', err.message)
    process.exit(1)
  })
