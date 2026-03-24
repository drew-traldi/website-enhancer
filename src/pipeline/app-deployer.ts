/**
 * App-hosted demo deployer.
 *
 * Stores generated HTML in the rebuild row and serves via dynamic app routes:
 * - /demos/[slug]
 * - /proposal/[businessId]
 */

import { supabaseAdmin } from '@/lib/supabase'

export interface AppDeployResult {
  pagesUrl: string
  proposalUrl: string
  deployed: boolean
  error: string | null
}

export function resolveAppBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL

  if (!fromEnv) return 'http://localhost:3000'

  if (/^https?:\/\//i.test(fromEnv)) return fromEnv.replace(/\/$/, '')
  return `https://${fromEnv.replace(/\/$/, '')}`
}

export async function deployToAppHostedDemo(
  businessId: string,
  slug: string,
  html: string
): Promise<AppDeployResult> {
  const baseUrl = resolveAppBaseUrl()
  const pagesUrl = `${baseUrl}/demos/${slug}`
  const proposalUrl = `${baseUrl}/proposal/${businessId}`

  try {
    const { data: existingRebuilds } = await supabaseAdmin
      .from('rebuilds')
      .select('id')
      .eq('business_id', businessId)
      .limit(1)

    const rebuildId = existingRebuilds?.[0]?.id

    if (rebuildId) {
      const { error } = await supabaseAdmin
        .from('rebuilds')
        .update({
          status: 'building',
          demo_kind: 'app_hosted',
          demo_slug: slug,
          demo_html: html,
          live_demo_url: pagesUrl,
          proposal_url: proposalUrl,
        })
        .eq('id', rebuildId)

      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('rebuilds')
        .insert({
          business_id: businessId,
          demo_kind: 'app_hosted',
          demo_slug: slug,
          demo_html: html,
          live_demo_url: pagesUrl,
          proposal_url: proposalUrl,
          status: 'building',
        })

      if (error) throw error
    }

    return {
      pagesUrl,
      proposalUrl,
      deployed: true,
      error: null,
    }
  } catch (err) {
    return {
      pagesUrl,
      proposalUrl,
      deployed: false,
      error: (err as Error).message,
    }
  }
}
