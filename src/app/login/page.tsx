'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const EXECUTIVES = [
  { id: 'D', label: 'D — Drew', subtitle: 'CEO / Head of Client Relations' },
  { id: 'S', label: 'S — Savannah', subtitle: 'Chief Revenue Officer' },
  { id: 'E', label: 'E — Elliot', subtitle: 'Chief Operating Officer' },
  { id: 'I', label: 'I — Ian', subtitle: 'Chief Information Officer' },
]

export default function LoginPage() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) { setError('Select your identity'); return }
    if (!pin) { setError('Enter your PIN'); return }

    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedId, pin }),
    })

    const data = await res.json()
    if (res.ok) {
      router.push('/overview')
    } else {
      setError(data.error ?? 'Invalid credentials')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #1E2A3A 0%, #2a1e4a 40%, #1E2A3A 80%, #1a3040 100%)' }}>
      <div className="w-full max-w-md space-y-6">
        {/* HAI Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl hai-accent-gradient shadow-lg shadow-[#5D3FA3]/30 hai-float">
            <span className="text-xl font-black text-white tracking-wider">HAI</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Website Enhancer</h1>
          <p className="text-[#C7A8E4] text-sm">HAI Custom Solutions LLC — Internal Platform</p>
        </div>

        <Card className="border-[#5D3FA3]/20 bg-[#243347]/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-white">Sign In</CardTitle>
            <CardDescription className="text-[#A0B0C4]">Select your identity and enter your PIN</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[#A0B0C4]">Who are you?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EXECUTIVES.map((exec) => (
                    <button
                      key={exec.id}
                      type="button"
                      onClick={() => setSelectedId(exec.id)}
                      className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                        selectedId === exec.id
                          ? 'border-[#7A4EB8] bg-[#5D3FA3]/15 text-white shadow-md shadow-[#5D3FA3]/10'
                          : 'border-white/10 hover:border-[#5D3FA3]/40 hover:bg-white/[0.03] text-[#A0B0C4]'
                      }`}
                    >
                      <div className="font-semibold text-sm">{exec.label}</div>
                      <div className="text-xs text-[#A0B0C4] mt-0.5">{exec.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin" className="text-[#A0B0C4]">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder="Enter shared PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={10}
                  inputMode="numeric"
                  className="bg-white/5 border-white/10 text-white placeholder:text-[#A0B0C4]/50"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full text-white font-semibold" disabled={loading}
                      style={{ background: 'linear-gradient(135deg, #5D3FA3, #7A4EB8, #3BC9B5)', border: 'none' }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-[#A0B0C4]/60">
          Empowering your people through human-centered AI
        </p>
      </div>
    </div>
  )
}
