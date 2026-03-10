#!/usr/bin/env tsx
/**
 * CLI: Discovery Pipeline
 * Usage: npm run discover -- --city "Roswell, GA"
 */

import 'dotenv/config'
import { runDiscovery } from '../src/pipeline/orchestrator'

async function main() {
  const args = process.argv.slice(2)
  const cityFlagIdx = args.indexOf('--city')

  if (cityFlagIdx === -1 || !args[cityFlagIdx + 1]) {
    console.error('\n❌ Usage: npm run discover -- --city "City, State"')
    console.error('   Example: npm run discover -- --city "Roswell, GA"\n')
    process.exit(1)
  }

  const cityInput = args[cityFlagIdx + 1]

  try {
    await runDiscovery(cityInput)
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Discovery failed:', (err as Error).message)
    console.error((err as Error).stack)
    process.exit(1)
  }
}

main()
