'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Globe, Phone, MapPin, Star, ExternalLink,
  Hammer, Mail, ChevronDown, ChevronUp, Save, Loader2,
  Send, UserX, CheckCircle2, AlertCircle, MailPlus,
  FileText, RefreshCw, Info,
} from 'lucide-react'

interface ScoreDetails {
  responsive: number
  visualEra: number
  performance: number
  security: number
  accessibility: number
  techStack: number
  contentQuality: number
  ux: number
}

interface Business {
  id: string
  name: string
  address: string
  city_name: string
  state: string
  rating: number | null
  review_count: number | null
  website_url: string | null
  phone: string | null
  status: string
  notes: string | null
  website_score: {
    overall_score: number
    score_details: ScoreDetails
    screenshot_urls: string[]
    scored_at: string
    narrative_summary: string | null
    narrative_email_opening: string | null
    narrative_extended: string | null
    category_notes: Record<string, string> | null
    narrative_generated_at: string | null
    narrative_usage: { input_tokens: number; output_tokens: number } | null
  } | null
  rebuild: {
    status: string
    deployed_url: string | null
    deployed_at: string | null
    after_screenshot_urls: string[]
  } | null
  outreach: {
    id: string
    status: string
    sent_at: string | null
    opened_at: string | null
    replied_at: string | null
    email_used: string | null
    subject_line: string | null
  } | null
}

const SCORE_LABELS: Record<string, string> = {
  responsive:     'Mobile Responsive',
  visualEra:      'Visual Era',
  performance:    'Performance',
  security:       'Security',
  accessibility:  'Accessibility',
  techStack:      'Tech Stack',
  contentQuality: 'Content Quality',
  ux:             'UX',
}

const SCORE_WEIGHTS: Record<string, number> = {
  responsive: 20, visualEra: 20, performance: 15,
  security: 10, accessibility: 10, techStack: 10,
  contentQuality: 10, ux: 5,
}

function NarrativeUsagePopover({
  usage,
}: {
  usage: { input_tokens: number; output_tokens: number }
}) {
  const [open, setOpen] = useState(false)
  const total = usage.input_tokens + usage.output_tokens
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Show Claude API token usage for the narrative call"
      >
        <Info className="w-3.5 h-3.5 shrink-0 opacity-80" />
        <span className="tabular-nums">{total.toLocaleString()} tokens</span>
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Dismiss"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 top-full z-50 mt-1.5 w-[min(100vw-2rem,240px)] rounded-md border border-border bg-card p-3 text-xs shadow-lg"
            role="dialog"
          >
            <p className="font-medium text-foreground mb-2">Narrative API usage</p>
            <p className="text-muted-foreground tabular-nums space-y-0.5">
              <span className="block">Input: {usage.input_tokens.toLocaleString()}</span>
              <span className="block">Output: {usage.output_tokens.toLocaleString()}</span>
            </p>
            <p className="text-muted-foreground/85 mt-2.5 text-[0.65rem] leading-relaxed">
              Reported by Anthropic on the Messages API response (billed tokens for that call).
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function ScoreRow({ label, value, weight }: { label: string; value: number; weight: number }) {
  const color = value < 4 ? 'bg-red-500' : value < 6 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-36 text-sm text-muted-foreground shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value * 10}%` }} />
      </div>
      <div className="w-8 text-right text-sm font-semibold tabular-nums">{value.toFixed(1)}</div>
      <div className="w-10 text-right text-xs text-muted-foreground/60">{weight}%</div>
    </div>
  )
}

function OutreachSection({ biz, onUpdate }: { biz: Business; onUpdate: () => void }) {
  const outreach = biz.outreach
  const rebuild = biz.rebuild
  const [manualEmail, setManualEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null)

  const hasDemo = rebuild?.deployed_url
  const canSend = hasDemo && (outreach?.email_used || manualEmail.includes('@'))

  const doAction = async (action: string, extra: Record<string, string> = {}) => {
    setSending(true)
    setActionResult(null)
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          businessId: biz.id,
          outreachId: outreach?.id,
          ...extra,
        }),
      })
      const data = await res.json()
      if (data.ok || data.email) {
        setActionResult({ ok: true, message: action === 'send' ? `Email sent to ${data.email}` : 'Updated' })
        setManualEmail('')
        onUpdate()
      } else {
        setActionResult({ ok: false, message: data.error ?? 'Failed' })
      }
    } catch {
      setActionResult({ ok: false, message: 'Network error' })
    }
    setSending(false)
  }

  const OUTREACH_COLORS: Record<string, string> = {
    draft:     'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    sent:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
    opened:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    clicked:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
    replied:   'bg-green-500/10 text-green-400 border-green-500/20',
    converted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    skipped:   'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Outreach
          </div>
          {outreach && (
            <Badge variant="outline" className={`text-xs ${OUTREACH_COLORS[outreach.status] ?? ''}`}>
              {outreach.status.replace(/_/g, ' ')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current status display */}
        {outreach && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Email',  value: outreach.email_used ?? '—' },
              { label: 'Sent',   value: outreach.sent_at ? new Date(outreach.sent_at).toLocaleDateString() : '—' },
              { label: 'Opened', value: outreach.opened_at ? new Date(outreach.opened_at).toLocaleDateString() : '—' },
              { label: 'Subject', value: outreach.subject_line ?? '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* No demo yet */}
        {!hasDemo && (
          <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Rebuild must be deployed before outreach. Run the rebuild pipeline first.
            </p>
          </div>
        )}

        {/* Actions */}
        {hasDemo && (
          <div className="space-y-3 pt-2 border-t border-border/30">
            {/* Email input + send */}
            <div className="flex gap-2">
              <Input
                placeholder={outreach?.email_used ? `Current: ${outreach.email_used}` : 'Enter contact email…'}
                value={manualEmail}
                onChange={e => setManualEmail(e.target.value)}
                type="email"
                className="flex-1"
              />
              <Button
                size="sm"
                disabled={sending || !canSend}
                onClick={() => doAction('send', manualEmail ? { email: manualEmail } : {})}
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                {outreach?.sent_at ? 'Resend' : 'Send Email'}
              </Button>
            </div>

            {/* Save email without sending */}
            {manualEmail.includes('@') && !outreach?.email_used && (
              <Button
                variant="outline"
                size="sm"
                disabled={sending}
                onClick={() => doAction('set_email', { email: manualEmail })}
              >
                <MailPlus className="w-3.5 h-3.5 mr-1.5" />
                Save Email (Don&apos;t Send Yet)
              </Button>
            )}

            {/* Secondary actions */}
            <div className="flex gap-2 flex-wrap">
              {outreach && outreach.status !== 'replied' && outreach.status !== 'converted' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sending}
                  onClick={() => doAction('mark_replied')}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-400" />
                  Mark Replied
                </Button>
              )}
              {outreach && outreach.status !== 'skipped' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sending}
                  onClick={() => doAction('skip', { notes: 'Manually skipped from dashboard' })}
                >
                  <UserX className="w-3.5 h-3.5 mr-1.5 text-red-400" />
                  Skip
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Action result feedback */}
        {actionResult && (
          <div className={`p-2.5 rounded-lg text-sm flex items-center gap-2 ${
            actionResult.ok
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {actionResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {actionResult.message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [biz, setBiz] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showBefore, setShowBefore] = useState(true)
  const [showAfter, setShowAfter] = useState(true)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeMsg, setNarrativeMsg] = useState<{
    ok: boolean
    text: string
    usage?: { input_tokens: number; output_tokens: number } | null
  } | null>(null)
  const [showCategoryNotes, setShowCategoryNotes] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildError, setRebuildError] = useState<string | null>(null)
  const [linkSlug, setLinkSlug] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const triggerRebuild = async () => {
    setRebuilding(true)
    setRebuildError(null)
    try {
      const res = await fetch(`/api/businesses/${id}/rebuild`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executiveNotes: notes || undefined }),
      })
      const data = await res.json()
      if (data.ok && data.pagesUrl) {
        // Refresh business data to show deployed URL
        const updated = await fetch(`/api/businesses/${id}`).then(r => r.json())
        setBiz(updated)
        setNotes(updated.notes ?? '')
      } else {
        setRebuildError(data.error ?? 'Rebuild failed')
      }
    } catch {
      setRebuildError('Network error — rebuild may still be running')
    } finally {
      setRebuilding(false)
    }
  }

  const triggerLinkRepo = async () => {
    const slug = linkSlug.trim()
    if (!slug) return
    setLinking(true)
    setLinkError(null)
    try {
      const res = await fetch(`/api/businesses/${id}/enable-demo-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      const data = await res.json()
      if (data.ok && data.pagesUrl) {
        const updated = await fetch(`/api/businesses/${id}`).then(r => r.json())
        setBiz(updated)
        setLinkSlug('')
      } else {
        setLinkError(data.error ?? 'Failed to enable GitHub Pages')
      }
    } catch {
      setLinkError('Network error')
    } finally {
      setLinking(false)
    }
  }

  useEffect(() => {
    fetch(`/api/businesses/${id}`)
      .then(r => r.json())
      .then(d => {
        setBiz(d)
        setNotes(d.notes ?? '')
      })
      .finally(() => setLoading(false))
  }, [id])

  const saveNotes = async () => {
    setSaving(true)
    await fetch(`/api/businesses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    setSaving(false)
  }

  const regenerateNarrative = async () => {
    setNarrativeLoading(true)
    setNarrativeMsg(null)
    try {
      const res = await fetch(`/api/businesses/${id}/narrative`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setNarrativeMsg({
          ok: true,
          text: 'Narrative updated. One Claude call.',
          usage: data.usage ?? null,
        })
        const r = await fetch(`/api/businesses/${id}`)
        const d = await r.json()
        setBiz(d)
        setNotes(d.notes ?? '')
      } else {
        setNarrativeMsg({ ok: false, text: data.error ?? 'Failed' })
      }
    } catch {
      setNarrativeMsg({ ok: false, text: 'Network error' })
    }
    setNarrativeLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-48 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  if (!biz) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Business not found.</p>
        <Button variant="link" className="pl-0 mt-2" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
    )
  }

  const score = biz.website_score
  const rebuild = biz.rebuild
  const outreach = biz.outreach
  const details = score?.score_details
  const narrativeUsageDisplay =
    narrativeMsg?.ok && narrativeMsg.usage
      ? narrativeMsg.usage
      : score?.narrative_usage ?? null

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/prospects" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3 w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Prospects
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{biz.name}</h1>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{biz.address}
              </span>
              {biz.phone && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />{biz.phone}
                </span>
              )}
              {biz.rating && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  {biz.rating.toFixed(1)} ({biz.review_count} reviews)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="text-xs" variant="outline">{biz.status.replace(/_/g, ' ')}</Badge>
            {biz.website_url && (
              <a
                href={biz.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-7 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted"
              >
                <Globe className="w-3.5 h-3.5" />
                Visit Site
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      {score && details && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Website Score</span>
              <span className="text-2xl font-bold tabular-nums">
                {score.overall_score.toFixed(1)}
                <span className="text-base font-normal text-muted-foreground">/10</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(Object.keys(SCORE_LABELS) as (keyof ScoreDetails)[]).map(key => (
              <ScoreRow
                key={key}
                label={SCORE_LABELS[key]}
                value={details[key] ?? 0}
                weight={SCORE_WEIGHTS[key]}
              />
            ))}
            <p className="text-xs text-muted-foreground mt-3">
              Scored {new Date(score.scored_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Narrative scoring (for dashboard + outreach emails) */}
      {score && details && (
        <Card className="border-border/50 border-[#5D3FA3]/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C7A8E4]" />
                <span>Audit narrative</span>
                <span className="text-xs font-normal text-muted-foreground">(email opening + category notes)</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={narrativeLoading}
                onClick={regenerateNarrative}
                className="shrink-0"
              >
                {narrativeLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span className="ml-1.5">
                  {score.narrative_extended || score.narrative_summary ? 'Regenerate' : 'Generate'}
                </span>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {narrativeMsg && (
              <p className={`text-sm ${narrativeMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                {narrativeMsg.text}
              </p>
            )}
            {score.narrative_extended || score.narrative_summary ? (
              <>
                {score.narrative_extended ? (
                  <div className="space-y-3 text-sm leading-relaxed text-foreground/90 border border-[#5D3FA3]/15 rounded-lg p-4 bg-muted/20">
                    {score.narrative_extended.split(/\n\n+/).map((para, i) => (
                      <p key={i}>{para.trim()}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-foreground/90 border-l-2 border-[#5D3FA3]/50 pl-3">
                    {score.narrative_summary}
                  </p>
                )}

                {(score.narrative_email_opening || score.narrative_summary) && (
                  <div className="rounded-md border border-border/60 bg-background/50 p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Email opening (after “Hello,”)
                    </p>
                    <p className="text-sm text-foreground/85">
                      {score.narrative_email_opening ?? score.narrative_summary}
                    </p>
                  </div>
                )}

                {score.narrative_generated_at && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Generated {new Date(score.narrative_generated_at).toLocaleString()}</span>
                    {narrativeUsageDisplay && <NarrativeUsagePopover usage={narrativeUsageDisplay} />}
                  </div>
                )}
                {score.category_notes && Object.keys(score.category_notes).length > 0 && (
                  <div>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
                      onClick={() => setShowCategoryNotes((v) => !v)}
                    >
                      Category notes
                      {showCategoryNotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showCategoryNotes && (
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {(Object.keys(SCORE_LABELS) as (keyof ScoreDetails)[]).map((key) => {
                          const note = score.category_notes?.[key]
                          if (!note) return null
                          return (
                            <li key={key}>
                              <span className="font-medium text-foreground/80">{SCORE_LABELS[key]}:</span>{' '}
                              {note}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Full audit uses your saved score signals — no re-scoring needed. Emails use the short opening above;
                  screenshots are embedded for Gmail/Outlook. When you run <strong className="font-medium text-foreground/80">Rebuild</strong>,
                  the generator also receives this narrative and category notes so the demo targets the same gaps (mobile, a11y, stack, etc.).
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No narrative yet. Click <strong>Generate</strong> to build a full audit from the data we already captured
                when this site was scored. New pipeline scores get narratives automatically.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Before screenshots */}
      {score?.screenshot_urls && score.screenshot_urls.length > 0 && (
        <Card className="border-border/50">
          <CardHeader
            className="pb-3 cursor-pointer"
            onClick={() => setShowBefore(p => !p)}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <span>Before Screenshots</span>
              {showBefore ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          {showBefore && (
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {score.screenshot_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group">
                    <div className="rounded-lg overflow-hidden border border-border/30 aspect-video bg-muted">
                      <img
                        src={url}
                        alt={`Before screenshot ${i + 1}`}
                        className="w-full h-full object-cover object-top group-hover:opacity-90 transition-opacity"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      {['Top', 'Mid', 'Footer'][i] ?? `Shot ${i + 1}`}
                    </p>
                  </a>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Rebuilt Demo */}
      <Card className="border-border/50 border-green-500/20">
        <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hammer className="w-4 h-4 text-green-400" />
                <span>Rebuilt Demo</span>
                {rebuild && (
                  <Badge variant="outline" className={`text-xs ${
                    rebuild.status === 'deployed' ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : rebuild.status === 'building' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                      : rebuild.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                  }`}>
                    {rebuild.status}
                  </Badge>
                )}
              </div>
              {rebuild?.deployed_at && (
                <span className="text-xs text-muted-foreground">
                  Built {new Date(rebuild.deployed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            {rebuild?.deployed_url ? (
              <div className="flex gap-2">
                <a
                  href={rebuild.deployed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #5D3FA3, #3BC9B5)' }}
                >
                  <Globe className="w-4 h-4" />
                  View Rebuilt Site
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {rebuild && rebuild.status === 'building' && (
                  <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-2">
                    <Loader2 className="w-4 h-4 mt-0.5 shrink-0 text-yellow-400 animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      Rebuild in progress. This may take a few minutes — refresh to check.
                    </p>
                  </div>
                )}
                {(!rebuild || rebuild.status === 'queued' || rebuild.status === 'failed') && !rebuilding && (
                  <>
                    <div className="p-3 rounded-lg bg-zinc-500/5 border border-zinc-500/20 flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {rebuild?.status === 'failed'
                          ? 'Previous rebuild failed. Ready to retry.'
                          : 'No deployed demo yet. Generate and publish the rebuilt site to GitHub Pages. The build prompt includes your audit narrative and category notes when available.'}
                      </p>
                      <Button
                        size="sm"
                        onClick={triggerRebuild}
                        disabled={rebuilding}
                        className="shrink-0"
                        style={{ background: 'linear-gradient(135deg, #5D3FA3, #3BC9B5)' }}
                      >
                        <Hammer className="w-3.5 h-3.5 mr-1.5" />
                        {rebuild?.status === 'failed' ? 'Retry Rebuild' : 'Rebuild Now'}
                      </Button>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Already have a repo on GitHub? Enable Pages and link it here.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          placeholder="Repo name or full GitHub URL"
                          value={linkSlug}
                          onChange={e => { setLinkSlug(e.target.value); setLinkError(null) }}
                          className="max-w-md h-8 text-sm font-mono"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={triggerLinkRepo}
                          disabled={linking || !linkSlug.trim()}
                        >
                          {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                          Enable Pages & link
                        </Button>
                      </div>
                      {linkError && (
                        <p className="text-xs text-red-400">{linkError}</p>
                      )}
                    </div>
                  </>
                )}
                {rebuilding && (
                  <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 shrink-0 text-purple-400 animate-spin" />
                    <div>
                      <p className="text-sm font-medium text-purple-300">Rebuild running…</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Scraping site, generating AI demo, deploying to GitHub Pages. This takes 1–3 minutes.
                      </p>
                    </div>
                  </div>
                )}
                {rebuildError && (
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                    <p className="text-sm text-red-400">{rebuildError}</p>
                  </div>
                )}
              </div>
            )}

            {rebuild?.deployed_url && (
              <div className="rounded-lg overflow-hidden border border-green-500/20 bg-muted">
                <iframe
                  src={rebuild.deployed_url}
                  title="Rebuilt site preview"
                  className="w-full border-0"
                  style={{ height: '500px' }}
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            )}

            {(rebuild?.after_screenshot_urls?.length ?? 0) > 0 && (
              <div>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3"
                  onClick={() => setShowAfter(p => !p)}
                >
                  After Screenshots
                  {showAfter ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showAfter && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {rebuild!.after_screenshot_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group">
                        <div className="rounded-lg overflow-hidden border border-green-500/20 aspect-video bg-muted">
                          <img
                            src={url}
                            alt={`After screenshot ${i + 1}`}
                            className="w-full h-full object-cover object-top group-hover:opacity-90 transition-opacity"
                            loading="lazy"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-center">
                          {['Top', 'Mid', 'Footer'][i] ?? `Shot ${i + 1}`}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
        </CardContent>
      </Card>

      {/* Outreach section */}
      <OutreachSection biz={biz} onUpdate={() => {
        fetch(`/api/businesses/${id}`).then(r => r.json()).then(d => { setBiz(d); setNotes(d.notes ?? '') })
      }} />

      {/* Notes */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Textarea
              placeholder="Add internal notes about this prospect…"
              className="min-h-[100px] resize-none"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <Button size="sm" onClick={saveNotes} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save Notes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
