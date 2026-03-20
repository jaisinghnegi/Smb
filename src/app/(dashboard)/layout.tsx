import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/shared/Navbar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Belt-and-suspenders auth check — middleware handles it too
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
