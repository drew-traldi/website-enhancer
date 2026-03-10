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
  Send, UserX, CheckCircle2, AlertCircle, MailPlus
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

      {/* After screenshots (rebuilt demo) */}
      {rebuild && rebuild.after_screenshot_urls?.length > 0 && (
        <Card className="border-border/50 border-green-500/20">
          <CardHeader
            className="pb-3 cursor-pointer"
            onClick={() => setShowAfter(p => !p)}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hammer className="w-4 h-4 text-green-400" />
                <span>Rebuilt Demo</span>
                {rebuild.deployed_url && (
                  <a
                    href={rebuild.deployed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-green-400 hover:underline flex items-center gap-1"
                  >
                    Live <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {showAfter ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          {showAfter && (
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {rebuild.after_screenshot_urls.map((url, i) => (
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
            </CardContent>
          )}
        </Card>
      )}

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
