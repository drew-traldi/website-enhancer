/**
 * Stage 2: FILTER
 *
 * Applies 7 filters (in order):
 * 1. Has website
 * 2. Google rating >= 2.5
 * 3. Google review count >= 5
 * 4. Recent activity (review in last 12 months)
 * 5. Website is live (HTTP 200)
 * 6. Not previously processed in this city
 * 7. Not a chain
 */

import axios from 'axios'
import type { PlaceResult } from '@/types/database'
import { checkIfChain } from './chain-detection'

const MIN_RATING = 2.5
const MIN_REVIEWS = 5
const MONTHS_RECENT = 12

export interface FilterResult {
  passed: boolean
  reason: string
  website?: string
  latestReviewDate?: string | null
  isChain?: boolean
  chainLocationCount?: number
}

/**
 * Check if a website URL is live (returns HTTP 200).
 */
async function isWebsiteLive(url: string): Promise<boolean> {
  try {
    // Ensure protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    const res = await axios.head(fullUrl, {
      timeout: 8000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    })
    return res.status >= 200 && res.status < 400
  } catch {
    // Try again with GET if HEAD fails (some servers reject HEAD)
    try {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`
      const res = await axios.get(fullUrl, {
        timeout: 8000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
        // Don't download body
        responseType: 'stream',
      })
      res.data.destroy()
      return res.status >= 200 && res.status < 400
    } catch {
      return false
    }
  }
}

/**
 * Find the most recent review date from Google Places reviews array.
 */
function getLatestReviewDate(
  reviews?: PlaceResult['reviews']
): { date: string | null; isRecent: boolean } {
  if (!reviews || reviews.length === 0) {
    return { date: null, isRecent: false }
  }

  const sorted = [...reviews].sort((a, b) => b.time - a.time)
  const latestTimestamp = sorted[0].time * 1000 // convert seconds to ms
  const latestDate = new Date(latestTimestamp)

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - MONTHS_RECENT)

  return {
    date: latestDate.toISOString().split('T')[0],
    isRecent: latestDate >= cutoff,
  }
}

/**
 * Apply all 7 filters to a single business.
 * processedPlaceIds = Set of place_ids already in the DB for this city.
 */
export async function filterBusiness(
  place: PlaceResult,
  lat: number,
  lng: number,
  processedPlaceIds: Set<string>
): Promise<FilterResult> {
  // Filter 1: Has website
  if (!place.website) {
    return { passed: false, reason: 'fail:no_website' }
  }

  // Filter 2: Minimum rating
  const rating = place.rating ?? 0
  if (rating < MIN_RATING) {
    return { passed: false, reason: `fail:rating_too_low:${rating}` }
  }

  // Filter 3: Minimum reviews
  const reviewCount = place.user_ratings_total ?? 0
  if (reviewCount < MIN_REVIEWS) {
    return { passed: false, reason: `fail:too_few_reviews:${reviewCount}` }
  }

  // Filter 4: Recent activity
  const { date: latestReviewDate, isRecent } = getLatestReviewDate(place.reviews)
  if (!isRecent) {
    return {
      passed: false,
      reason: `fail:no_recent_reviews:${latestReviewDate ?? 'none'}`,
      latestReviewDate,
    }
  }

  // Filter 5: Website is live
  const live = await isWebsiteLive(place.website)
  if (!live) {
    return { passed: false, reason: 'fail:website_not_live', website: place.website }
  }

  // Filter 6: Not previously processed
  if (processedPlaceIds.has(place.place_id)) {
    return { passed: false, reason: 'fail:already_processed' }
  }

  // Filter 7: Not a chain
  const chainCheck = await checkIfChain(place.name, lat, lng)
  if (chainCheck.isChain) {
    return {
      passed: false,
      reason: `fail:chain:${chainCheck.reason}`,
      isChain: true,
      chainLocationCount: chainCheck.locationCount,
    }
  }

  return {
    passed: true,
    reason: 'pass',
    website: place.website,
    latestReviewDate,
    isChain: false,
    chainLocationCount: chainCheck.locationCount,
  }
}

/**
 * Filter an array of businesses in parallel (with concurrency limit).
 */
export async function filterBusinesses(
  places: PlaceResult[],
  lat: number,
  lng: number,
  processedPlaceIds: Set<string>,
  concurrency = 5,
  onProgress?: (msg: string) => void
): Promise<Array<{ place: PlaceResult; result: FilterResult }>> {
  const log = onProgress ?? console.log
  const results: Array<{ place: PlaceResult; result: FilterResult }> = []

  log(`\n🔎 Filtering ${places.length} businesses...`)

  // Process in batches to respect API rate limits
  for (let i = 0; i < places.length; i += concurrency) {
    const batch = places.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (place) => {
        const result = await filterBusiness(place, lat, lng, processedPlaceIds)
        return { place, result }
      })
    )
    results.push(...batchResults)

    const passed = results.filter((r) => r.result.passed).length
    if ((i + concurrency) % 50 === 0 || i + concurrency >= places.length) {
      log(`  Processed ${Math.min(i + concurrency, places.length)}/${places.length} — ${passed} passing so far`)
    }
  }

  const passed = results.filter((r) => r.result.passed)
  const failed = results.filter((r) => !r.result.passed)

  // Count failure reasons
  const reasons: Record<string, number> = {}
  for (const f of failed) {
    const key = f.result.reason.split(':')[1] ?? f.result.reason
    reasons[key] = (reasons[key] ?? 0) + 1
  }

  log(`\n✅ Filter complete: ${passed.length} passed, ${failed.length} failed`)
  log(`   Failure breakdown:`)
  for (const [reason, count] of Object.entries(reasons)) {
    log(`     ${reason}: ${count}`)
  }

  return results
}
