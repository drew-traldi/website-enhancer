#!/usr/bin/env tsx
/**
 * CLI: Scoring Pipeline
 * Usage: npm run score -- --city "Roswell, GA"
 */

import 'dotenv/config'
import { runScoring } from '../src/pipeline/score-orchestrator'

async function main() {
  const args = process.argv.slice(2)
  const cityFlagIdx = args.indexOf('--city')

  if (cityFlagIdx === -1 || !args[cityFlagIdx + 1]) {
    console.error('\n❌ Usage: npm run score -- --city "City, State"')
    console.error('   Example: npm run score -- --city "Roswell, GA"\n')
    process.exit(1)
  }

  const cityInput = args[cityFlagIdx + 1]

  try {
    await runScoring(cityInput)
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Scoring failed:', (err as Error).message)
    console.error((err as Error).stack)
    process.exit(1)
  }
}

main()
