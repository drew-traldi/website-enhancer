'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Settings, Users, FileText, CheckCircle2,
  Loader2, Shield
} from 'lucide-react'

interface Executive {
  id: string
  full_name: string
  title: string
  email: string | null
}

export default function SettingsPage() {
  const [executives, setExecutives] = useState<Executive[]>([])
  const [loadingExecs, setLoadingExecs] = useState(true)

  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)

  useEffect(() => {
    fetch('/api/executives')
      .then(r => r.json())
      .then(d => setExecutives(d.executives ?? []))
      .finally(() => setLoadingExecs(false))

    fetch('/api/settings/template')
      .then(r => r.json())
      .then(d => { if (d.template) setTemplate(d.template) })
  }, [])

  const saveTemplate = async () => {
    setSavingTemplate(true)
    await fetch('/api/settings/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template }),
    })
    setSavingTemplate(false)
    setTemplateSaved(true)
    setTimeout(() => setTemplateSaved(false), 3000)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#7A4EB8]" />
          Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Platform configuration and preferences</p>
      </div>

      {/* Executives */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-[#5D3FA3]" />
            Executives
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingExecs ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-4 w-24 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : executives.length === 0 ? (
            <p className="text-sm text-muted-foreground">No executives found. Run <code className="bg-muted px-1 rounded text-xs">npm run seed:executives</code> to populate.</p>
          ) : (
            <div className="space-y-1">
              {executives.map(exec => (
                <div key={exec.id} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full hai-accent-gradient flex items-center justify-center text-xs font-bold text-white shadow-md shadow-[#5D3FA3]/15">
                      {exec.id}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{exec.full_name}</p>
                      <p className="text-xs text-muted-foreground">{exec.email ?? 'No email set'}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs bg-[#5D3FA3]/10 text-[#C7A8E4] border-[#5D3FA3]/20">{exec.title}</Badge>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            To add or remove executives, update <code className="bg-muted px-1 rounded">scripts/seed-executives.ts</code> and re-run the seed script.
          </p>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#3BC9B5]" />
            API Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            All API keys are managed via environment variables. On Vercel, configure these in your project settings. Locally, add them to <code className="bg-muted px-1 rounded text-xs">.env.local</code>.
          </p>
          <div className="space-y-2">
            {[
              { name: 'GOOGLE_PLACES_API_KEY', label: 'Google Places', status: 'configured' },
              { name: 'SUPABASE_URL', label: 'Supabase', status: 'configured' },
              { name: 'SENDGRID_API_KEY', label: 'SendGrid', status: 'configured' },
              { name: 'ANTHROPIC_API_KEY', label: 'Anthropic (Claude)', status: 'configured' },
              { name: 'GITHUB_PAT', label: 'GitHub Pages', status: 'configured' },
            ].map(({ name, label, status }) => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{name}</p>
                </div>
                <Badge variant="outline" className="text-xs bg-[#3BC9B5]/10 text-[#3BC9B5] border-[#3BC9B5]/20">
                  {status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Template */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#7A4EB8]" />
            Email Template
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Use <code className="bg-muted px-1 rounded">{'{{business_name}}'}</code>, <code className="bg-muted px-1 rounded">{'{{demo_url}}'}</code>, <code className="bg-muted px-1 rounded">{'{{executive_name}}'}</code>, <code className="bg-muted px-1 rounded">{'{{score}}'}</code> as placeholders.
          </p>
          <Textarea
            value={template}
            onChange={e => setTemplate(e.target.value)}
            className="min-h-[280px] font-mono text-xs resize-none"
          />
          <div className="flex items-center justify-between mt-3">
            <Button variant="outline" size="sm" onClick={() => setTemplate(DEFAULT_TEMPLATE)}>
              Reset to default
            </Button>
            <Button size="sm" onClick={saveTemplate} disabled={savingTemplate}
                    style={{ background: 'linear-gradient(135deg, #5D3FA3, #7A4EB8)', border: 'none' }}>
              {savingTemplate ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> :
               templateSaved  ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> :
               null}
              {templateSaved ? 'Saved!' : 'Save Template'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline config */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: 'Batch size (rebuild queue)',  value: '15', note: 'Bottom 15 businesses by score are queued for rebuild' },
              { label: 'Min rating filter',           value: '2.5', note: 'Businesses below this rating are excluded' },
              { label: 'Min review count',            value: '5',   note: 'Businesses with fewer reviews are excluded' },
              { label: 'Screenshot quality',          value: '70%', note: 'JPEG quality for before/after screenshots' },
            ].map(({ label, value, note }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
                </div>
                <Badge variant="outline" className="text-xs font-mono shrink-0">{value}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const DEFAULT_TEMPLATE = `Subject: We built a modern demo of {{business_name}}'s website — take a look

Hi there,

My name is {{executive_name}} from HAI Custom Solutions. I was browsing local businesses in your area and noticed {{business_name}}'s website scored {{score}}/10 on our modern web standards audit.

We went ahead and built you a free, fully functional demo of what your site could look like with a modern redesign — no strings attached.

👉 View your demo: {{demo_url}}

The demo includes:
• Mobile-first responsive design
• Fast load times (optimized for Google rankings)
• Modern, professional look that builds trust

If you'd like to discuss turning this demo into your real site, I'd love to connect. We work with local businesses throughout the area and our pricing is straightforward.

Feel free to reply here or call us anytime.

Best,
{{executive_name}}
HAI Custom Solutions LLC
`
