/**
 * GitHub Pages Deployer
 *
 * Creates a GitHub repo under the haiconsulting org, pushes index.html,
 * enables GitHub Pages, and returns the live URL.
 *
 * Live URL format: https://haiconsulting.github.io/{repo-name}/
 */

const GITHUB_API = 'https://api.github.com'

function headers(): Record<string, string> {
  return {
    Authorization:          `Bearer ${process.env.GITHUB_PAT}`,
    Accept:                 'application/vnd.github+json',
    'Content-Type':         'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export interface DeployResult {
  repoUrl:    string          // https://github.com/haiconsulting/{slug}
  pagesUrl:   string          // https://haiconsulting.github.io/{slug}/
  deployed:   boolean
  error:      string | null
}

/**
 * Full deploy: create repo → push index.html → enable Pages → return URL
 */
export async function deployToGitHubPages(
  slug: string,
  html: string,
  businessName: string
): Promise<DeployResult> {
  const org = process.env.GITHUB_ORG ?? 'haiconsulting'

  const result: DeployResult = {
    repoUrl:  `https://github.com/${org}/${slug}`,
    pagesUrl: `https://${org}.github.io/${slug}/`,
    deployed: false,
    error:    null,
  }

  try {
    // ── Step 1: Create repo (delete first if it already exists) ────────────
    console.log(`  [deployer] Creating repo ${org}/${slug}…`)
    await ensureRepoDeleted(org, slug)

    const createRes = await fetch(`${GITHUB_API}/orgs/${org}/repos`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name:        slug,
        description: `HAI Custom Solutions — Demo site for ${businessName}`,
        private:     false,
        auto_init:   false,
        has_pages:   true,
      }),
    })

    if (!createRes.ok) {
      const body = await createRes.json()
      throw new Error(`Create repo failed: ${createRes.status} — ${JSON.stringify(body.errors ?? body.message)}`)
    }
    console.log(`  [deployer] Repo created.`)

    // ── Step 2: Push index.html via contents API ───────────────────────────
    console.log(`  [deployer] Pushing index.html…`)
    const content = Buffer.from(html, 'utf-8').toString('base64')

    const pushRes = await fetch(
      `${GITHUB_API}/repos/${org}/${slug}/contents/index.html`,
      {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          message: 'Initial commit — HAI demo site',
          content,
        }),
      }
    )

    if (!pushRes.ok) {
      const body = await pushRes.json()
      throw new Error(`Push file failed: ${pushRes.status} — ${body.message}`)
    }
    console.log(`  [deployer] index.html pushed.`)

    // ── Step 3: Enable GitHub Pages ────────────────────────────────────────
    console.log(`  [deployer] Enabling GitHub Pages…`)
    const pagesRes = await fetch(`${GITHUB_API}/repos/${org}/${slug}/pages`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        source: { branch: 'main', path: '/' },
      }),
    })

    // 409 = Pages already enabled — that's fine
    if (!pagesRes.ok && pagesRes.status !== 409) {
      const body = await pagesRes.json()
      console.warn(`  [deployer] Pages enable warning: ${body.message}`)
      // Don't throw — repo is still accessible, Pages may auto-enable
    }

    console.log(`  [deployer] GitHub Pages enabled. URL: ${result.pagesUrl}`)
    result.deployed = true

  } catch (err) {
    result.error   = (err as Error).message
    result.deployed = false
    console.error(`  [deployer] Error: ${result.error}`)
  }

  return result
}

/**
 * Wait for GitHub Pages to become available (polls up to maxWaitMs).
 */
export async function waitForPages(
  url: string,
  maxWaitMs = 120_000,
  intervalMs = 8_000
): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs
  console.log(`  [deployer] Waiting for Pages to go live at ${url}…`)

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok || res.status === 304) {
        console.log(`  [deployer] Pages live! (${res.status})`)
        return true
      }
    } catch {
      // not yet live
    }
    console.log(`  [deployer] Not live yet — waiting ${intervalMs / 1000}s…`)
    await sleep(intervalMs)
  }
  console.warn(`  [deployer] Pages did not become live within ${maxWaitMs / 1000}s. Continuing.`)
  return false
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function ensureRepoDeleted(org: string, slug: string): Promise<void> {
  const checkRes = await fetch(`${GITHUB_API}/repos/${org}/${slug}`, {
    headers: headers(),
  })
  if (checkRes.status === 200) {
    console.log(`  [deployer] Existing repo found — deleting…`)
    const delRes = await fetch(`${GITHUB_API}/repos/${org}/${slug}`, {
      method: 'DELETE',
      headers: headers(),
    })
    if (!delRes.ok && delRes.status !== 404) {
      const b = await delRes.json()
      throw new Error(`Failed to delete existing repo: ${b.message}`)
    }
    // GitHub needs a moment after deletion
    await sleep(3000)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Build a URL-safe slug from business name + city.
 * e.g. "POSH Nails", "Roswell" → "posh-nails-roswell"
 */
export function buildSlug(businessName: string, city: string): string {
  const clean = (s: string) =>
    s.toLowerCase()
     .replace(/[^a-z0-9\s-]/g, '')
     .trim()
     .replace(/\s+/g, '-')
     .replace(/-+/g, '-')
     .slice(0, 30)

  return `hai-demo-${clean(businessName)}-${clean(city)}`
}
