/**
 * Stage 1: DISCOVER
 * Queries Google Places API (New) across multiple business categories.
 * Uses the NEW Places API: https://places.googleapis.com/v1/places:searchNearby
 */

import axios from 'axios'
import type { PlaceResult } from '@/types/database'

const PLACES_NEW_API = 'https://places.googleapis.com/v1'
const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

export const BUSINESS_CATEGORIES = [
  { label: 'Restaurants & Food', type: 'restaurant' },
  { label: 'Cafes', type: 'cafe' },
  { label: 'Bars', type: 'bar' },
  { label: 'Clothing Stores', type: 'clothing_store' },
  { label: 'Retail Shops', type: 'store' },
  { label: 'Lawyers', type: 'lawyer' },
  { label: 'Accountants', type: 'accounting' },
  { label: 'Dentists', type: 'dentist' },
  { label: 'Doctors', type: 'doctor' },
  { label: 'Gyms', type: 'gym' },
  { label: 'Beauty Salons', type: 'beauty_salon' },
  { label: 'Spas', type: 'spa' },
  { label: 'Plumbers', type: 'plumber' },
  { label: 'Electricians', type: 'electrician' },
  { label: 'Auto Services', type: 'car_repair' },
  { label: 'Florists', type: 'florist' },
  { label: 'Bakeries', type: 'bakery' },
  { label: 'Hardware Stores', type: 'hardware_store' },
  { label: 'Veterinary / Pet', type: 'veterinary_care' },
  { label: 'Real Estate', type: 'real_estate_agency' },
]

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.photos',
  'places.currentOpeningHours',
  'places.reviews',
  'places.businessStatus',
].join(',')

export interface GeocodedCity {
  name: string
  state: string
  lat: number
  lng: number
}

export async function geocodeCity(cityInput: string): Promise<GeocodedCity> {
  const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
    params: { address: cityInput, key: API_KEY },
  })

  if (res.data.status !== 'OK' || !res.data.results.length) {
    throw new Error(`Could not geocode city: "${cityInput}" — ${res.data.status}`)
  }

  const result = res.data.results[0]
  const { lat, lng } = result.geometry.location

  let name = cityInput.split(',')[0].trim()
  let state = cityInput.split(',')[1]?.trim() ?? ''

  for (const component of result.address_components) {
    if (component.types.includes('locality')) name = component.long_name
    if (component.types.includes('administrative_area_level_1')) state = component.short_name
  }

  return { name, state, lat, lng }
}

function normalizeNewPlace(place: Record<string, unknown>): PlaceResult {
  const loc = (place.location as { latitude: number; longitude: number }) ?? {}
  const displayName = (place.displayName as { text: string }) ?? {}

  return {
    place_id: (place.id as string) ?? '',
    name: displayName.text ?? '',
    formatted_address: (place.formattedAddress as string) ?? undefined,
    geometry: { location: { lat: loc.latitude ?? 0, lng: loc.longitude ?? 0 } },
    rating: (place.rating as number) ?? undefined,
    user_ratings_total: (place.userRatingCount as number) ?? undefined,
    types: (place.types as string[]) ?? undefined,
    website: (place.websiteUri as string) ?? undefined,
    formatted_phone_number: (place.nationalPhoneNumber as string) ?? undefined,
    international_phone_number: (place.internationalPhoneNumber as string) ?? undefined,
    photos: (place.photos as PlaceResult['photos']) ?? undefined,
    opening_hours: place.currentOpeningHours
      ? {
          open_now: (place.currentOpeningHours as { openNow?: boolean }).openNow,
          weekday_text: (place.currentOpeningHours as { weekdayDescriptions?: string[] }).weekdayDescriptions,
        }
      : undefined,
    reviews: Array.isArray(place.reviews)
      ? (place.reviews as Array<{ rating: number; publishTime: string; text: { text: string }; authorAttribution: { displayName: string } }>).map((r) => ({
          rating: r.rating,
          time: r.publishTime ? Math.floor(new Date(r.publishTime).getTime() / 1000) : 0,
          text: r.text?.text ?? '',
          author_name: r.authorAttribution?.displayName ?? '',
        }))
      : undefined,
  }
}

export async function fetchPlacesForType(
  lat: number,
  lng: number,
  type: string,
  radiusMeters = 15000
): Promise<PlaceResult[]> {
  const results: PlaceResult[] = []
  let pageToken: string | undefined

  do {
    const body: Record<string, unknown> = {
      includedTypes: [type],
      maxResultCount: 20,
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
      },
    }
    if (pageToken) body.pageToken = pageToken
    if (pageToken) await sleep(2000)

    try {
      const res = await axios.post(`${PLACES_NEW_API}/places:searchNearby`, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        },
      })
      const places: Record<string, unknown>[] = res.data.places ?? []
      results.push(...places.map(normalizeNewPlace))
      pageToken = res.data.nextPageToken
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.data?.error?.status ?? err.response?.status
        const msg = err.response?.data?.error?.message ?? err.message
        console.warn(`  ⚠ Places API error for type "${type}": ${status} — ${msg}`)
      } else {
        console.warn(`  ⚠ Error for type "${type}": ${(err as Error).message}`)
      }
      break
    }
  } while (pageToken)

  return results
}

export async function discoverBusinesses(
  city: GeocodedCity,
  onProgress?: (msg: string) => void
): Promise<PlaceResult[]> {
  const log = onProgress ?? console.log
  const seen = new Set<string>()
  const all: PlaceResult[] = []

  log(`\n🔍 Discovering businesses in ${city.name}, ${city.state}...`)

  for (const category of BUSINESS_CATEGORIES) {
    log(`  📍 Searching: ${category.label}`)
    try {
      const places = await fetchPlacesForType(city.lat, city.lng, category.type)
      let newCount = 0
      for (const place of places) {
        if (place.place_id && !seen.has(place.place_id)) {
          seen.add(place.place_id)
          all.push(place)
          newCount++
        }
      }
      log(`     Found ${places.length} results, ${newCount} new (total: ${all.length})`)
    } catch (err) {
      log(`     ❌ Error: ${(err as Error).message}`)
    }
    await sleep(300)
  }

  log(`\n✅ Discovery complete: ${all.length} unique businesses found`)
  return all
}

// The New Places API returns all fields in the initial search — no separate enrichment needed
export async function enrichWithDetails(
  places: PlaceResult[],
  onProgress?: (msg: string) => void
): Promise<PlaceResult[]> {
  const log = onProgress ?? console.log
  log(`\n📋 Data pre-enriched by Places API (New) for ${places.length} businesses`)
  return places
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}
