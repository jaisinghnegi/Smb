import { createClient } from '@/lib/supabase/server'
import { ConnectorCard } from '@/components/connectors/ConnectorCard'
import type { SyncStatus } from '@/lib/db/schema'

const PROVIDERS = ['stripe', 'shopify', 'razorpay', 'zoho'] as const

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: connectors } = await supabase
    .from('connectors')
    .select('id, provider, sync_status, last_synced_at, sync_error')
    .eq('user_id', user.id)

  const connectorMap = new Map(
    (connectors ?? []).map(c => [c.provider as string, c])
  )

  const connectedProvider = params['connected']
  const errorMessage = params['error']

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connectors</h1>
        <p className="mt-1 text-muted-foreground">
          Connect your business tools to start asking questions about your data.
        </p>
      </div>

      {connectedProvider && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Successfully connected {connectedProvider}. Syncing your data now — this may take a
          minute.
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {decodeURIComponent(errorMessage)}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map(provider => {
          const connector = connectorMap.get(provider)
          return (
            <ConnectorCard
              key={provider}
              provider={provider}
              connectorId={connector?.id}
              isConnected={!!connector}
              syncStatus={connector?.sync_status as SyncStatus | undefined}
              lastSyncedAt={connector?.last_synced_at}
              syncError={connector?.sync_error}
            />
          )
        })}
      </div>
    </div>
  )
}
