'use client'

import { useEffect, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MapPin, Play, Loader2, CheckCircle2, AlertCircle,
  Building2, Calendar, RefreshCw
} from 'lucide-react'

interface City {
  id: string
  name: string
  state: string
  last_run_at: string | null
  total_businesses_found: number
  batches_completed: number
}

interface RunResult {
  ok: boolean
  message?: string
  discovered?: number
  filtered?: number
  saved?: number
}

export default function DiscoveryPage() {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [cityInput, setCityInput] = useState('')
  const [stateInput, setStateInput] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const fetchCities = () => {
    setLoading(true)
    fetch('/api/cities')
      .then(r => r.json())
      .then(d => setCities(d.cities ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCities() }, [])

  const handleRun = () => {
    if (!cityInput.trim() || !stateInput.trim()) return
    setResult(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/pipeline/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city: cityInput.trim(), state: stateInput.trim() }),
        })
        const data = await res.json()
        setResult(data)
        if (data.ok) {
          setCityInput('')
          setStateInput('')
          fetchCities()
        }
      } catch {
        setResult({ ok: false, message: 'Network error — check the server logs.' })
      }
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Discovery Manager</h1>
        <p className="text-muted-foreground text-sm mt-1">Run the business discovery pipeline for a new city</p>
      </div>

      {/* Run form */}
      <Card className="border-border/50 mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="w-4 h-4" />
            Start Discovery Run
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 block">City</Label>
              <Input
                placeholder="e.g. Roswell"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRun()}
                disabled={isPending}
              />
            </div>
            <div className="w-full sm:w-32">
              <Label className="text-xs text-muted-foreground mb-1.5 block">State (abbr.)</Label>
              <Input
                placeholder="GA"
                value={stateInput}
                onChange={e => setStateInput(e.target.value.toUpperCase().slice(0, 2))}
                onKeyDown={e => e.key === 'Enter' && handleRun()}
                disabled={isPending}
                maxLength={2}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleRun}
                disabled={isPending || !cityInput.trim() || !stateInput.trim()}
                className="w-full sm:w-auto"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run
                  </>
                )}
              </Button>
            </div>
          </div>

          {isPending && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/30 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              Discovery running — this can take 2–5 minutes for a full city scan. Do not close this tab.
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-lg border text-sm flex items-start gap-2 ${
              result.ok
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {result.ok
                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <div>
                {result.ok ? (
                  <>
                    <p className="font-medium">Discovery complete!</p>
                    <p className="text-xs mt-0.5 opacity-80">
                      {result.discovered} discovered → {result.filtered} passed filters → {result.saved} saved
                    </p>
                  </>
                ) : (
                  <p>{result.message ?? 'An error occurred.'}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cities table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Scanned Cities
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchCities} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between py-3 animate-pulse">
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : cities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No cities discovered yet. Use the form above to start your first run.
            </p>
          ) : (
            <div className="space-y-1">
              {cities.map(city => (
                <div
                  key={city.id}
                  className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">{city.name}, {city.state}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {city.last_run_at
                          ? new Date(city.last_run_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric'
                            })
                          : 'Never run'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        {city.total_businesses_found.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">businesses</p>
                    </div>
                    <Badge variant="outline" className="text-xs tabular-nums">
                      Batch #{city.batches_completed}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
