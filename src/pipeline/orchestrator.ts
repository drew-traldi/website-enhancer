/**
 * Discovery Orchestrator
 *
 * Ties together: geocoding → discovery → enrichment → filtering → Supabase persistence
 * This is called by the CLI script `npm run discover`
 */

import 'dotenv/config'
import { supabaseAdmin } from '@/lib/supabase'
import { geocodeCity, discoverBusinesses, enrichWithDetails } from './discover'
import { filterBusinesses } from './filter'
import type { PlaceResult, DiscoveryResult } from '@/types/database'

export async function runDiscovery(cityInput: string): Promise<DiscoveryResult> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Website Enhancer — Discovery Pipeline`)
  console.log(`  City: ${cityInput}`)
  console.log(`${'='.repeat(60)}`)

  // ── Step 1: Geocode the city ──────────────────────────────────
  console.log('\n[1/5] Geocoding city...')
  const city = await geocodeCity(cityInput)
  console.log(`  ✓ ${city.name}, ${city.state} → (${city.lat.toFixed(4)}, ${city.lng.toFixed(4)})`)

  // ── Step 2: Upsert city record & get current batch number ─────
  console.log('\n[2/5] Setting up city record in database...')
  const { data: existingCity } = await supabaseAdmin
    .from('cities')
    .select('*')
    .eq('name', city.name)
    .eq('state', city.state)
    .single()

  const batchNumber = (existingCity?.batches_completed ?? 0) + 1

  let cityId: string
  if (existingCity) {
    cityId = existingCity.id
    console.log(`  ✓ City exists (ID: ${cityId}), batch #${batchNumber}`)
  } else {
    const { data: newCity, error } = await supabaseAdmin
      .from('cities')
      .insert({ name: city.name, state: city.state, lat: city.lat, lng: city.lng })
      .select()
      .single()
    if (error || !newCity) throw new Error(`Failed to create city: ${error?.message}`)
    cityId = newCity.id
    console.log(`  ✓ New city created (ID: ${cityId}), batch #1`)
  }

  // ── Step 3: Load already-processed place_ids for this city ────
  console.log('\n[3/5] Loading previously processed businesses...')
  const { data: existingBusinesses } = await supabaseAdmin
    .from('businesses')
    .select('place_id')
    .eq('city_id', cityId)

  const processedPlaceIds = new Set<string>(
    (existingBusinesses ?? []).map((b) => b.place_id)
  )
  console.log(`  ✓ ${processedPlaceIds.size} already processed`)

  // ── Step 4: Discover businesses ───────────────────────────────
  console.log('\n[4/5] Running Google Places discovery...')
  const rawPlaces = await discoverBusinesses(city)

  // Enrich with details (website, phone, reviews, hours)
  const enriched = await enrichWithDetails(rawPlaces)

  // ── Step 5: Filter businesses ─────────────────────────────────
  console.log('\n[5/5] Applying filters...')
  const filterResults = await filterBusinesses(
    enriched,
    city.lat,
    city.lng,
    processedPlaceIds
  )

  // ── Step 6: Save all businesses to Supabase ───────────────────
  console.log('\n💾 Saving to database...')
  let savedCount = 0
  let passedCount = 0

  for (const { place, result } of filterResults) {
    if (result.passed) passedCount++

    // Build the latest_review_date from reviews
    const latestReviewDate = result.latestReviewDate ?? getLatestReviewDateFromPlace(place)

    const businessRow = {
      city_id: cityId,
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address ?? place.vicinity ?? null,
      phone: place.formatted_phone_number ?? place.international_phone_number ?? null,
      website: place.website ?? null,
      google_rating: place.rating ?? null,
      google_review_count: place.user_ratings_total ?? 0,
      latest_review_date: latestReviewDate,
      business_types: place.types ?? null,
      photos: place.photos ? JSON.parse(JSON.stringify(place.photos)) : null,
      hours: place.opening_hours ? JSON.parse(JSON.stringify(place.opening_hours)) : null,
      is_chain: result.isChain ?? false,
      chain_location_count: result.chainLocationCount ?? null,
      is_active: result.passed,
      filter_status: result.reason,
      status: result.passed ? 'filtered' : 'discovered',
      batch_number: batchNumber,
    }

    const { error } = await supabaseAdmin
      .from('businesses')
      .upsert(businessRow, { onConflict: 'place_id', ignoreDuplicates: false })

    if (error) {
      console.warn(`  ⚠ Failed to save "${place.name}": ${error.message}`)
    } else {
      savedCount++
    }
  }

  // ── Step 7: Update city stats ─────────────────────────────────
  await supabaseAdmin
    .from('cities')
    .update({
      last_run_at: new Date().toISOString(),
      total_businesses_found: (existingCity?.total_businesses_found ?? 0) + enriched.length,
      batches_completed: batchNumber,
    })
    .eq('id', cityId)

  // ── Summary ───────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  DISCOVERY COMPLETE`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  City:               ${city.name}, ${city.state}`)
  console.log(`  Batch:              #${batchNumber}`)
  console.log(`  Businesses found:   ${enriched.length}`)
  console.log(`  Passed filters:     ${passedCount}`)
  console.log(`  Saved to DB:        ${savedCount}`)
  console.log(`  Previously known:   ${processedPlaceIds.size}`)
  console.log(`${'='.repeat(60)}\n`)

  return {
    businessesFound: enriched.length,
    businessesFiltered: passedCount,
    businessesSaved: savedCount,
    city: city.name,
    state: city.state,
    batchNumber,
  }
}

function getLatestReviewDateFromPlace(place: PlaceResult): string | null {
  if (!place.reviews?.length) return null
  const sorted = [...place.reviews].sort((a, b) => b.time - a.time)
  return new Date(sorted[0].time * 1000).toISOString().split('T')[0]
}
