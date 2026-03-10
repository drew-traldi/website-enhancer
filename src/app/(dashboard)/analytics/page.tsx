'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, MousePointerClick, Reply, Send, TrendingUp, AlertCircle } from 'lucide-react'

interface OutreachStats {
  total_sent: number
  total_opened: number
  total_clicked: number
  total_replied: number
  open_rate: number
  click_rate: number
  reply_rate: number
  recent: Array<{
    business_name: string
    email_used: string
    status: string
    sent_at: string
    opened_at: string | null
    replied_at: string | null
  }>
}

function StatCard({
  icon: Icon, label, value, sub, color
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/60 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<OutreachStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Email Analytics</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="h-4 w-4 bg-muted rounded" />
                <div className="h-7 w-16 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // No data yet (Phase 5 prerequisite)
  if (!stats || stats.total_sent === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Email Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">SendGrid outreach performance</p>
        </div>

        <Card className="border-border/50 border-yellow-500/20">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
            <p className="font-medium">No emails sent yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Analytics will appear here once the outreach pipeline runs. Make sure your SendGrid API key is configured in Settings.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const STATUS_COLORS: Record<string, string> = {
    sent:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    opened:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    clicked: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    replied: 'bg-green-500/10 text-green-400 border-green-500/20',
    bounced: 'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">SendGrid outreach performance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Send}             label="Emails Sent"    value={stats.total_sent.toLocaleString()} color="text-blue-400" />
        <StatCard icon={Mail}             label="Opened"         value={`${stats.open_rate}%`}  sub={`${stats.total_opened} opens`}    color="text-yellow-400" />
        <StatCard icon={MousePointerClick} label="Clicked"       value={`${stats.click_rate}%`} sub={`${stats.total_clicked} clicks`}  color="text-purple-400" />
        <StatCard icon={Reply}            label="Replied"        value={`${stats.reply_rate}%`} sub={`${stats.total_replied} replies`} color="text-green-400" />
      </div>

      {/* Funnel bar */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Engagement Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Sent',    count: stats.total_sent,    pct: 100 },
            { label: 'Opened',  count: stats.total_opened,  pct: stats.open_rate },
            { label: 'Clicked', count: stats.total_clicked, pct: stats.click_rate },
            { label: 'Replied', count: stats.total_replied, pct: stats.reply_rate },
          ].map(({ label, count, pct }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-16 text-sm text-muted-foreground">{label}</div>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="w-24 text-right text-xs text-muted-foreground tabular-nums">
                {count.toLocaleString()} ({pct}%)
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent outreach */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Outreach</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.recent.map((item, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 border-b border-border/20 last:border-0 items-center"
            >
              <div>
                <p className="font-medium text-sm">{item.business_name}</p>
                <p className="text-xs text-muted-foreground">{item.email_used}</p>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {new Date(item.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <Badge
                variant="outline"
                className={`text-xs ${STATUS_COLORS[item.status] ?? ''}`}
              >
                {item.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
