/**
 * Pick the best rebuild row when multiple exist (failed retries + successful deploy).
 */
export function pickBestRebuild(
  rebuilds: unknown
): Record<string, unknown> | null {
  const arr = Array.isArray(rebuilds) ? rebuilds : rebuilds ? [rebuilds] : []
  if (!arr.length) return null
  return (
    (arr.find((r) => (r as Record<string, unknown>).status === 'deployed') as
      | Record<string, unknown>
      | undefined) ??
    (arr.find((r) => (r as Record<string, unknown>).live_demo_url) as
      | Record<string, unknown>
      | undefined) ??
    (arr[0] as Record<string, unknown>)
  )
}

/** First after-screenshot URL (JSON array or single URL). */
export function parseAfterScreenshotUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = JSON.parse(url) as unknown
    if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'string') return parsed[0]
    return typeof parsed === 'string' ? parsed : url
  } catch {
    return url
  }
}
