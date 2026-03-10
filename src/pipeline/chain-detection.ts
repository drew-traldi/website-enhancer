/**
 * Chain Detection Algorithm
 *
 * Rules:
 * - 11+ locations with the same name → chain → EXCLUDE
 * - 2-10 locations → small local chain → KEEP
 * - Known national chains list → instant EXCLUDE
 * - Business name appearing in known chains list → instant EXCLUDE
 */

import axios from 'axios'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

// ============================================================
// Known national/regional chains — instant exclusion list
// ============================================================
export const KNOWN_CHAINS = new Set([
  // Fast Food
  "mcdonald's", "burger king", "wendy's", "taco bell", "chick-fil-a", "subway",
  "arby's", "sonic", "popeyes", "raising cane's", "cook out", "whataburger",
  "jack in the box", "carl's jr", "hardee's", "white castle", "five guys",
  "shake shack", "in-n-out", "habit burger", "culver's", "steak 'n shake",
  // Pizza
  "domino's", "pizza hut", "papa john's", "little caesars", "papa murphy's",
  "mod pizza", "blaze pizza",
  // Coffee
  "starbucks", "dunkin'", "dunkin donuts", "tim hortons", "peet's coffee",
  "caribou coffee", "dutch bros", "scooter's coffee",
  // Casual Dining
  "applebee's", "chili's", "outback steakhouse", "olive garden", "red lobster",
  "buffalo wild wings", "ihop", "denny's", "waffle house", "cracker barrel",
  "red robin", "texas roadhouse", "longhorn steakhouse", "the cheesecake factory",
  "p.f. chang's", "panera bread", "chipotle", "moe's", "qdoba", "wingstop",
  "hooters", "friendly's", "ruby tuesday", "bob evans", "golden corral",
  // Retail
  "walmart", "target", "costco", "sam's club", "home depot", "lowe's", "menards",
  "best buy", "staples", "office depot", "michaels", "hobby lobby", "joann",
  "dollar general", "dollar tree", "family dollar", "five below", "big lots",
  "ross", "tj maxx", "marshalls", "burlington", "old navy", "gap", "banana republic",
  "h&m", "zara", "forever 21", "urban outfitters", "anthropologie", "victoria's secret",
  "bath & body works", "ulta", "sephora", "macy's", "nordstrom", "nordstrom rack",
  "jcpenney", "kohl's", "bed bath & beyond", "crate & barrel", "pottery barn",
  "williams-sonoma", "pier 1", "tuesday morning",
  // Grocery
  "kroger", "publix", "safeway", "albertsons", "aldi", "trader joe's",
  "whole foods", "sprouts", "harris teeter", "food lion", "meijer", "heb",
  "wegmans", "stop & shop", "giant", "winn-dixie", "piggly wiggly",
  // Pharmacy / Health
  "cvs", "walgreens", "rite aid", "duane reade",
  // Auto
  "jiffy lube", "midas", "meineke", "pep boys", "autozone", "o'reilly auto",
  "advance auto parts", "napa auto parts", "firestone", "goodyear", "mavis",
  "valvoline", "take 5 oil change", "precision tune",
  // Gyms / Wellness
  "planet fitness", "la fitness", "24 hour fitness", "anytime fitness",
  "gold's gym", "lifetime fitness", "equinox", "crunch fitness", "orangetheory",
  "f45", "crossfit", "barry's bootcamp", "pure barre", "solidcore",
  // Hotels
  "marriott", "hilton", "hyatt", "sheraton", "westin", "hampton inn",
  "holiday inn", "best western", "comfort inn", "quality inn", "days inn",
  "motel 6", "super 8", "la quinta", "doubletree", "embassy suites",
  // Banks
  "bank of america", "wells fargo", "chase", "citibank", "td bank",
  "us bank", "pnc bank", "suntrust", "truist", "regions bank", "fifth third",
  // Gas / Convenience
  "7-eleven", "circle k", "bp", "shell", "exxon", "mobil", "chevron",
  "speedway", "wawa", "sheetz", "quiktrip", "casey's",
  // Salons / Services
  "great clips", "supercuts", "sport clips", "fantastic sams", "hair cuttery",
  "first watch", "nothing bundt cakes", "baskin-robbins", "dairy queen",
  "cold stone creamery", "orange julius",
  // Moving / Storage
  "uhaul", "u-haul", "public storage", "extra space storage", "life storage",
  // Other
  "fedex", "ups", "usps", "amazon", "enterprise rent-a-car", "hertz", "avis",
  "budget car rental", "national car rental",
])

/**
 * Normalize a business name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if a business name matches any known chain (exact or substring match).
 */
export function isKnownChain(businessName: string): boolean {
  const normalized = normalizeName(businessName)

  // Exact match
  if (KNOWN_CHAINS.has(normalized)) return true

  // Check if any known chain name is contained in the business name
  for (const chain of KNOWN_CHAINS) {
    if (normalized.includes(chain)) return true
  }

  return false
}

/**
 * Count how many distinct locations exist for this business name
 * within a 50-mile radius of the given coordinates using Places Text Search.
 * Returns the count (capped at 20 to limit API spend).
 */
export async function countLocationsNearby(
  businessName: string,
  lat: number,
  lng: number
): Promise<number> {
  const radiusMeters = 80467 // 50 miles

  try {
    const res = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      {
        params: {
          query: businessName,
          location: `${lat},${lng}`,
          radius: radiusMeters,
          key: API_KEY,
        },
      }
    )

    if (res.data.status === 'ZERO_RESULTS') return 1
    if (res.data.status !== 'OK') return 1

    const results: Array<{ name: string }> = res.data.results ?? []

    // Count how many results have a name that closely matches
    const normalizedQuery = normalizeName(businessName)
    const matches = results.filter((r) => {
      const n = normalizeName(r.name)
      return n === normalizedQuery || n.startsWith(normalizedQuery) || normalizedQuery.startsWith(n)
    })

    return Math.max(1, matches.length)
  } catch {
    return 1 // Default to 1 on error — don't exclude on API failure
  }
}

export interface ChainCheckResult {
  isChain: boolean
  locationCount: number
  reason: 'known_chain' | 'too_many_locations' | 'ok'
}

/**
 * Full chain check for a business.
 * First checks the known-chains list (cheap), then does a proximity count (costs an API call).
 */
export async function checkIfChain(
  businessName: string,
  lat: number,
  lng: number
): Promise<ChainCheckResult> {
  // Fast check — known chains list
  if (isKnownChain(businessName)) {
    return { isChain: true, locationCount: 999, reason: 'known_chain' }
  }

  // API-based location count
  const locationCount = await countLocationsNearby(businessName, lat, lng)

  if (locationCount >= 11) {
    return { isChain: true, locationCount, reason: 'too_many_locations' }
  }

  return { isChain: false, locationCount, reason: 'ok' }
}
