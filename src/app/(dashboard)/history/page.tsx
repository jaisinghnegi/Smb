import { createClient } from '@/lib/supabase/server'
import { getQuestionHistory } from '@/lib/db/queries'
import { Badge } from '@/components/ui/badge'
import type { VerificationStatus } from '@/lib/db/schema'

const STATUS_BADGE: Record<VerificationStatus, { label: string; className: string }> = {
  verified:      { label: '✓ Verified',  className: 'bg-green-100 text-green-800' },
  unverified:    { label: '⚠ Unverified',className: 'bg-amber-100 text-amber-800' },
  sql_rejected:  { label: '✗ Rejected',  className: 'bg-red-100 text-red-800' },
  empty_result:  { label: 'No Data',     className: 'bg-slate-100 text-slate-600' },
  sanity_failed: { label: '⚠ Uncertain', className: 'bg-amber-100 text-amber-800' },
  error:         { label: '✗ Error',     className: 'bg-red-100 text-red-800' },
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const questions = await getQuestionHistory(user.id, 50)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-muted-foreground">Your last {questions.length} questions.</p>
      </div>

      {questions.length === 0 ? (
        <p className="text-muted-foreground">No questions yet. Go ask something!</p>
      ) : (
        <div className="space-y-4">
          {questions.map(q => {
            const statusConfig =
              STATUS_BADGE[q.verification_status as VerificationStatus] ?? STATUS_BADGE['error']
            return (
              <div key={q.id} className="rounded-lg border bg-card p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    className={`text-xs ${statusConfig.className} hover:${statusConfig.className}`}
                  >
                    {statusConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(q.created_at).toLocaleString()}
                  </span>
                  {q.latency_ms && (
                    <span className="text-xs text-muted-foreground">{q.latency_ms}ms</span>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">{q.question}</p>
                <p className="mt-2 text-sm text-muted-foreground">{q.answer}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
