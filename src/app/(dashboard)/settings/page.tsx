import { createClient } from '@/lib/supabase/server'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, region, plan, questions_today')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Your account details and plan.</p>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
          <p className="mt-1 text-sm">{profile?.email ?? user.email}</p>
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plan</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              className={
                profile?.plan === 'paid'
                  ? 'bg-green-100 text-green-800 hover:bg-green-100'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-100'
              }
            >
              {profile?.plan === 'paid' ? 'Paid' : 'Free'}
            </Badge>
            {profile?.plan === 'free' && (
              <span className="text-xs text-muted-foreground">
                {profile.questions_today ?? 0}/5 questions used today
              </span>
            )}
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Region
          </p>
          <p className="mt-1 text-sm">{profile?.region ?? 'US'}</p>
        </div>

        {profile?.plan === 'free' && (
          <>
            <Separator />
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">Upgrade to paid</p>
              <p className="mt-1 text-xs text-blue-700">
                Get unlimited questions and priority support. Billing coming soon.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
