'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Search,
  ListFilter,
  BarChart2,
  Settings,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const NAV = [
  { href: '/overview',   label: 'Pipeline Overview', icon: LayoutDashboard },
  { href: '/discovery',  label: 'Discovery Manager', icon: Search },
  { href: '/prospects',  label: 'Prospects',          icon: ListFilter },
  { href: '/analytics',  label: 'Email Analytics',    icon: BarChart2 },
  { href: '/settings',   label: 'Settings',            icon: Settings },
]

interface SidebarProps {
  executiveName: string
  executiveId: string
}

export function Sidebar({ executiveName, executiveId }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="w-60 flex-shrink-0 border-r border-white/[0.06] flex flex-col h-screen sticky top-0"
           style={{ background: 'linear-gradient(180deg, #162030 0%, #1E2A3A 40%, #1a2538 100%)' }}>
      {/* Logo */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center hai-accent-gradient shadow-lg shadow-[#5D3FA3]/20">
            <span className="text-[10px] font-black text-white tracking-wider">HAI</span>
          </div>
          <div>
            <p className="font-bold text-sm leading-none text-white">Website Enhancer</p>
            <p className="text-[11px] text-[#3BC9B5] mt-0.5 font-medium">HAI Custom Solutions</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                active
                  ? 'text-white shadow-md'
                  : 'text-[#A0B0C4] hover:text-white hover:bg-white/[0.04]'
              )}
              style={active ? {
                background: 'linear-gradient(135deg, #5D3FA3, #7A4EB8)',
                boxShadow: '0 4px 12px rgba(93, 63, 163, 0.35)',
              } : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white hai-accent-gradient shadow-md shadow-[#5D3FA3]/20">
            {executiveId}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate text-white">{executiveName}</p>
            <p className="text-[11px] text-[#A0B0C4]">HAI Executive</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-[#A0B0C4] hover:text-white hover:bg-white/[0.04] px-3"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
