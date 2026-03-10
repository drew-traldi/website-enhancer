/**
 * Screenshot Capture
 *
 * Takes 1-3 targeted viewport screenshots per site (NOT full-page dumps):
 *   1. Hero / top-of-page  (always)
 *   2. Mid-page content    (if page is tall enough)
 *   3. Footer              (if page is tall enough)
 *
 * Uploads to Supabase Storage bucket "screenshots".
 * Returns an array of 1-3 public URLs.
 */

import type { Page } from 'puppeteer'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'screenshots'
const VIEWPORT = { width: 1280, height: 800 }

/**
 * Capture 1-3 viewport screenshots of a page already loaded in Puppeteer.
 * Returns array of Supabase Storage public URLs.
 */
export async function captureScreenshots(
  page: Page,
  slug: string,       // e.g. "roswell-ga-joes-pizza"
  prefix: 'before' | 'after'
): Promise<string[]> {
  const urls: string[] = []

  // Get total page height
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)

  // Determine how many shots to take (1-3)
  const shots: Array<{ name: string; scrollY: number }> = [
    { name: 'top', scrollY: 0 },
  ]

  if (pageHeight > VIEWPORT.height * 1.5) {
    shots.push({ name: 'mid', scrollY: Math.floor(pageHeight / 2 - VIEWPORT.height / 2) })
  }
  if (pageHeight > VIEWPORT.height * 2.5) {
    shots.push({ name: 'footer', scrollY: Math.max(0, pageHeight - VIEWPORT.height) })
  }

  for (const shot of shots) {
    try {
      // Scroll to position
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), shot.scrollY)
      await new Promise((r) => setTimeout(r, 300)) // brief settle

      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: 70,           // balance quality vs storage
        clip: {
          x: 0,
          y: 0,
          width: VIEWPORT.width,
          height: VIEWPORT.height,
        },
      })

      const path = `${slug}/${prefix}-${shot.name}.jpg`
      const url = await uploadToSupabase(Buffer.from(buffer), path)
      if (url) urls.push(url)
    } catch {
      // Non-fatal — skip this shot if it fails
    }
  }

  return urls
}

/**
 * Upload a screenshot buffer to Supabase Storage.
 * Returns the public URL or null on failure.
 */
async function uploadToSupabase(buffer: Buffer, path: string): Promise<string | null> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (error) {
    console.warn(`  ⚠ Screenshot upload failed for ${path}: ${error.message}`)
    return null
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Build a URL-safe slug from a business name + city
 * e.g. "Joe's Pizza" + "Roswell, GA" → "roswell-ga-joes-pizza"
 */
export function buildSlug(businessName: string, city: string): string {
  return [city, businessName]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80)
}
