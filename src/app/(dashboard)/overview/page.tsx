'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2, Filter, Star, Hammer, Mail, MapPin,
  Play, Loader2, CheckCircle2, AlertCircle, Zap, Sparkles,
  ChevronRight
} from 'lucide-react'

interface Stats {
  funnel: {
    discovered: number
    filtered: number
    scored: number
    queued: number
    rebuilding: number
    rebuilt: number
    emailed: number
  }
  cities: Array<{
    id: string
    name: string
    state: string
    last_run_at: string | null
    total_businesses_found: number
    batches_completed: number
  }>
}

const FUNNEL_STEPS = [
  { key: 'discovered', label: 'Discovered', icon: Building2, color: '#5D3FA3', statusFilter: 'discovered' },
  { key: 'filtered',   label: 'Filtered',   icon: Filter,    color: '#7A4EB8', statusFilter: 'filtered' },
  { key: 'scored',     label: 'Scored',     icon: Star,      color: '#3BC9B5', statusFilter: 'scored' },
  { key: 'rebuilt',    label: 'Rebuilt',    icon: Hammer,    color: '#4ade80', statusFilter: 'rebuilt' },
  { key: 'emailed',    label: 'Emailed',    icon: Mail,      color: '#60a5fa', statusFilter: 'email_sent' },
]

const HAI_LOADING_PHRASES = [
  { text: 'The HAI Mind is on it!', emoji: '🧠' },
  { text: 'We are COOKING... check back soon', emoji: '🔥' },
  { text: 'AI engines warming up...', emoji: '⚡' },
  { text: 'Analyzing with precision...', emoji: '🎯' },
  { text: 'HAI is working its magic...', emoji: '✨' },
  { text: 'Crunching the numbers...', emoji: '📊' },
  { text: 'Almost there... stay tuned', emoji: '🚀' },
  { text: 'Building something beautiful...', emoji: '🎨' },
  { text: 'Innovation in progress...', emoji: '💡' },
  { text: 'Your results are brewing...', emoji: '☕' },
]

function HaiLoadingOverlay({ title, subtitle }: { title: string; subtitle: string }) {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [dots, setDots] = useState('')

  useEffect(() => {
    const phraseTimer = setInterval(() => {
      setPhraseIndex(i => (i + 1) % HAI_LOADING_PHRASES.length)
    }, 3500)
    const dotTimer = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 600)
    return () => { clearInterval(phraseTimer); clearInterval(dotTimer) }
  }, [])

  const phrase = HAI_LOADING_PHRASES[phraseIndex]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: 'linear-gradient(135deg, rgba(30,42,58,0.97) 0%, rgba(93,63,163,0.95) 50%, rgba(30,42,58,0.97) 100%)' }}>
      <div className="text-center max-w-md px-6">
        {/* Animated logo ring */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-[#3BC9B5]/30"
               style={{ animation: 'hai-spin-slow 8s linear infinite' }} />
          <div className="absolute inset-2 rounded-full border-2 border-[#7A4EB8]/40"
               style={{ animation: 'hai-spin-slow 6s linear infinite reverse' }} />
          <div className="absolute inset-4 rounded-full border-2 border-[#5D3FA3]/50"
               style={{ animation: 'hai-spin-slow 4s linear infinite' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-xl hai-accent-gradient flex items-center justify-center shadow-lg shadow-[#5D3FA3]/30 hai-float">
              <span className="text-[10px] font-black text-white tracking-widest">HAI</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
        <p className="text-sm text-[#C7A8E4] mb-8">{subtitle}{dots}</p>

        {/* Rotating phrase */}
        <div className="min-h-[48px] flex items-center justify-center transition-all duration-500">
          <p className="text-white/80 text-sm font-medium">
            <span className="mr-2 text-base">{phrase.emoji}</span>
            {phrase.text}
          </p>
        </div>

        {/* Progress shimmer bar */}
        <div className="mt-6 h-1 w-64 mx-auto bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-1/2 rounded-full hai-accent-gradient"
               style={{ animation: 'hai-shimmer 2s ease-in-out infinite' }} />
        </div>
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  // Score action state
  const [scoreCity, setScoreCity] = useState('')
  const [scoreState, setScoreState] = useState('')
  const [scoreCount, setScoreCount] = useState('5')
  const [customCount, setCustomCount] = useState('')
  const [scoring, setScoring] = useState(false)
  const [scoreResult, setScoreResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Rebuild action state
  const [rebuildCount, setRebuildCount] = useState('1')
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildResult, setRebuildResult] = useState<{ ok: boolean; message: string } | null>(null)

  const fetchStats = useCallback(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  // Auto-fill city from stats
  useEffect(() => {
    if (stats?.cities?.length && !scoreCity) {
      setScoreCity(stats.cities[0].name)
      setScoreState(stats.cities[0].state)
    }
  }, [stats, scoreCity])

  const handleScore = async () => {
    if (!scoreCity || !scoreState) return
    setScoring(true)
    setScoreResult(null)
    try {
      const count = scoreCount === 'custom' ? (parseInt(customCount) || 5) : scoreCount
      const res = await fetch('/api/pipeline/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: scoreCity, state: scoreState, count }),
      })
      const data = await res.json()
      setScoreResult({ ok: data.ok, message: data.message || data.error || 'Done' })
      if (data.ok) fetchStats()
    } catch {
      setScoreResult({ ok: false, message: 'Network error' })
    }
    setScoring(false)
  }

  const handleRebuild = async () => {
    setRebuilding(true)
    setRebuildResult(null)
    try {
      const res = await fetch('/api/pipeline/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: parseInt(rebuildCount) }),
      })
      const data = await res.json()
      const msg = data.ok
        ? `${data.succeeded} site${data.succeeded !== 1 ? 's' : ''} rebuilt, ${data.failed} failed`
        : data.message
      setRebuildResult({ ok: data.ok, message: msg })
      if (data.ok) fetchStats()
    } catch {
      setRebuildResult({ ok: false, message: 'Network error' })
    }
    setRebuilding(false)
  }

  if (loading) return <PageShell><LoadingCards /></PageShell>

  const funnel = stats?.funnel
  const cities = stats?.cities ?? []
  const discovered = funnel?.discovered ?? 0

  return (
    <>
      {scoring && <HaiLoadingOverlay title="Scoring Websites" subtitle="Analyzing design, performance & more" />}
      {rebuilding && <HaiLoadingOverlay title="Rebuilding Sites" subtitle="Claude is designing your new demos" />}

      <PageShell>
        {/* Funnel cards — clickable */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {FUNNEL_STEPS.map(({ key, label, icon: Icon, color, statusFilter }) => {
            const val = funnel?.[key as keyof typeof funnel] ?? 0
            const pct = discovered > 0 ? Math.round((val / discovered) * 100) : 0
            return (
              <Link key={key} href={`/prospects?status=${statusFilter}`}>
                <Card className="border-border/50 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
                      style={{ '--card-accent': color } as React.CSSProperties}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                           style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                    <p className="text-2xl font-bold">{val.toLocaleString()}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: `${color}15` }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Action panels — Score + Rebuild side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* Score Panel */}
          <Card className="border-[#3BC9B5]/20 bg-gradient-to-br from-card to-[#3BC9B5]/[0.03]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#3BC9B515', border: '1px solid #3BC9B530' }}>
                  <Zap className="w-3.5 h-3.5 text-[#3BC9B5]" />
                </div>
                Score Websites
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input placeholder="City" value={scoreCity} onChange={e => setScoreCity(e.target.value)} className="text-sm" />
                </div>
                <div className="w-20">
                  <Input placeholder="ST" value={scoreState} onChange={e => setScoreState(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="text-sm" />
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1.5">How many to score</p>
                  <Select value={scoreCount} onValueChange={v => setScoreCount(v ?? '5')}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 business</SelectItem>
                      <SelectItem value="5">5 businesses</SelectItem>
                      <SelectItem value="10">10 businesses</SelectItem>
                      <SelectItem value="all">All remaining</SelectItem>
                      <SelectItem value="custom">Custom amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {scoreCount === 'custom' && (
                  <div className="w-20">
                    <Input type="number" placeholder="#" value={customCount} onChange={e => setCustomCount(e.target.value)} min={1} className="text-sm" />
                  </div>
                )}
                <Button
                  onClick={handleScore}
                  disabled={scoring || !scoreCity || !scoreState}
                  className="shrink-0"
                  style={{ background: 'linear-gradient(135deg, #5D3FA3, #3BC9B5)', border: 'none' }}
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Score
                </Button>
              </div>

              {scoreResult && (
                <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  scoreResult.ok ? 'bg-[#3BC9B5]/10 border border-[#3BC9B5]/20 text-[#3BC9B5]' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                  {scoreResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {scoreResult.message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rebuild Panel */}
          <Card className="border-[#7A4EB8]/20 bg-gradient-to-br from-card to-[#7A4EB8]/[0.03]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#7A4EB815', border: '1px solid #7A4EB830' }}>
                  <Sparkles className="w-3.5 h-3.5 text-[#7A4EB8]" />
                </div>
                Rebuild Websites
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {(funnel?.queued ?? 0) > 0
                  ? `${funnel?.queued} site${(funnel?.queued ?? 0) !== 1 ? 's' : ''} queued for rebuild. Claude will generate modern demo sites and deploy to GitHub Pages.`
                  : 'No sites queued. Score some websites first — the lowest-scoring ones get queued automatically.'}
              </p>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1.5">Sites to rebuild</p>
                  <Select value={rebuildCount} onValueChange={v => setRebuildCount(v ?? '1')}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 site</SelectItem>
                      <SelectItem value="2">2 sites</SelectItem>
                      <SelectItem value="3">3 sites</SelectItem>
                      <SelectItem value="4">4 sites</SelectItem>
                      <SelectItem value="5">5 sites</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleRebuild}
                  disabled={rebuilding || (funnel?.queued ?? 0) === 0}
                  className="shrink-0"
                  style={{ background: 'linear-gradient(135deg, #5D3FA3, #7A4EB8)', border: 'none' }}
                >
                  <Hammer className="w-3.5 h-3.5 mr-1.5" />
                  Rebuild
                </Button>
              </div>

              {rebuildResult && (
                <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  rebuildResult.ok ? 'bg-[#7A4EB8]/10 border border-[#7A4EB8]/20 text-[#C7A8E4]' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                  {rebuildResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {rebuildResult.message}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Queued alert */}
        {(funnel?.queued ?? 0) > 0 && (
          <div className="mb-6 p-4 rounded-xl flex items-center gap-3"
               style={{ background: 'linear-gradient(135deg, rgba(93,63,163,0.08), rgba(59,201,181,0.05))', border: '1px solid rgba(93,63,163,0.15)' }}>
            <Hammer className="w-5 h-5 text-[#7A4EB8] flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">{funnel?.queued} site{(funnel?.queued ?? 0) !== 1 ? 's' : ''} queued for rebuild</p>
              <p className="text-xs text-muted-foreground">Use the Rebuild panel above or run <code className="bg-muted px-1 rounded text-xs">npm run rebuild</code></p>
            </div>
          </div>
        )}

        {/* Cities table */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#3BC9B5]" />
              Cities Scanned
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No cities discovered yet. Go to <strong>Discovery Manager</strong> to start a run.
              </p>
            ) : (
              <div className="space-y-2">
                {cities.map((city) => (
                  <div key={city.id} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{city.name}, {city.state}</p>
                      <p className="text-xs text-muted-foreground">
                        Last run: {city.last_run_at ? new Date(city.last_run_at).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-right">
                      <div>
                        <p className="font-semibold">{city.total_businesses_found.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">businesses</p>
                      </div>
                      <Badge variant="outline" className="text-xs">Batch #{city.batches_completed}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageShell>
    </>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pipeline Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time pipeline status across all cities</p>
      </div>
      {children}
    </div>
  )
}

function LoadingCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="border-border/50 animate-pulse">
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-7 w-16 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
