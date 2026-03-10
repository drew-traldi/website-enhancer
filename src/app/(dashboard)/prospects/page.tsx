'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
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
  Building2, Search, ChevronRight, Star, Globe,
  Phone, MapPin, RefreshCw
} from 'lucide-react'

type BusinessStatus = 'discovered' | 'filtered' | 'scored' | 'queued_for_rebuild' | 'rebuilding' | 'rebuilt' | 'emailed' | 'skipped' | 'failed'

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
  status: BusinessStatus
  score: number | null
}

interface Page {
  businesses: Business[]
  total: number
  page: number
  per_page: number
}

const STATUS_COLORS: Record<string, string> = {
  discovered:         'bg-[#5D3FA3]/10 text-[#7A4EB8] border-[#5D3FA3]/20',
  filtered:           'bg-[#7A4EB8]/10 text-[#C7A8E4] border-[#7A4EB8]/20',
  scored:             'bg-[#3BC9B5]/10 text-[#3BC9B5] border-[#3BC9B5]/20',
  queued_for_rebuild: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  rebuilding:         'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rebuilt:            'bg-green-500/10 text-green-400 border-green-500/20',
  email_sent:         'bg-blue-500/10 text-blue-400 border-blue-500/20',
  manual_required:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  responded:          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  converted:          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  skipped:            'bg-muted/50 text-muted-foreground border-border/30',
  failed:             'bg-red-500/10 text-red-400 border-red-500/20',
}

const STATUS_LABELS: Record<string, string> = {
  discovered:         'Discovered',
  filtered:           'Filtered',
  scored:             'Scored',
  queued_for_rebuild: 'Queued',
  rebuilding:         'Rebuilding',
  rebuilt:            'Rebuilt',
  email_sent:         'Email Sent',
  manual_required:    'Manual Required',
  responded:          'Responded',
  converted:          'Converted',
  skipped:            'Skipped',
  failed:             'Failed',
}

function ScoreBar({ score }: { score: number }) {
  const color = score < 4 ? 'bg-red-500' : score < 6 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${(score / 10) * 100}%` }} />
      </div>
      <span className="text-xs tabular-nums font-medium">{score.toFixed(1)}</span>
    </div>
  )
}

export default function ProspectsPage() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || 'all'

  const [data, setData] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(initialStatus)
  const [page, setPage] = useState(1)

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), per_page: '25' })
    if (search) params.set('search', search)
    if (status !== 'all') params.set('status', status)
    fetch(`/api/businesses?${params}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [search, status, page])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, status])

  const totalPages = data ? Math.ceil(data.total / (data.per_page || 25)) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prospects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data ? `${data.total.toLocaleString()} businesses` : 'Loading…'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v ?? 'all')}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="discovered">Discovered</SelectItem>
            <SelectItem value="filtered">Filtered</SelectItem>
            <SelectItem value="scored">Scored</SelectItem>
            <SelectItem value="queued_for_rebuild">Queued</SelectItem>
            <SelectItem value="rebuilding">Rebuilding</SelectItem>
            <SelectItem value="rebuilt">Rebuilt</SelectItem>
            <SelectItem value="email_sent">Email Sent</SelectItem>
            <SelectItem value="manual_required">Manual Required</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2 animate-pulse">
                  <div className="h-4 w-48 bg-muted rounded" />
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="ml-auto h-5 w-16 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : !data?.businesses?.length ? (
            <div className="py-16 text-center">
              <Building2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No businesses found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 px-4 py-2 border-b border-border/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Business</span>
                <span className="text-right">Score</span>
                <span className="text-right hidden md:block">Rating</span>
                <span className="text-right">Status</span>
                <span />
              </div>

              {data.businesses.map(biz => (
                <Link
                  key={biz.id}
                  href={`/prospects/${biz.id}`}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 px-4 py-3.5 border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors items-center group"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {biz.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {biz.city_name}, {biz.state}
                      </span>
                      {biz.website_url && (
                        <span className="text-xs text-muted-foreground/60 flex items-center gap-1 hidden lg:flex">
                          <Globe className="w-3 h-3" />
                          {biz.website_url.replace(/^https?:\/\//, '').split('/')[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {biz.score != null ? <ScoreBar score={biz.score} /> : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </div>

                  <div className="text-right hidden md:flex items-center justify-end gap-1">
                    {biz.rating ? (
                      <>
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs tabular-nums">{biz.rating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground/60">({biz.review_count})</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </div>

                  <div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[biz.status] ?? ''}`}
                    >
                      {STATUS_LABELS[biz.status] ?? biz.status}
                    </Badge>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </Link>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
