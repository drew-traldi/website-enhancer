import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Sidebar } from '@/components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { data: exec } = await supabaseAdmin
    .from('executives')
    .select('full_name, title')
    .eq('id', session.id)
    .single()

  return (
    <div className="flex min-h-screen">
      <Sidebar executiveId={session.id} executiveName={exec?.full_name ?? session.name} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
