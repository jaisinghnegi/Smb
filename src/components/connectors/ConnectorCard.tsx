'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SyncStatus } from '@/lib/db/schema'

interface ProviderMeta {
  name: string
  description: string
  available: boolean
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  stripe: {
    name: 'Stripe',
    description: 'Credit card payments and charges',
    available: true,
  },
  shopify: {
    name: 'Shopify',
    description: 'E-commerce orders and products',
    available: false,
  },
  razorpay: {
    name: 'Razorpay',
    description: 'Indian payments (UPI and cards)',
    available: false,
  },
  zoho: {
    name: 'Zoho Books',
    description: 'Accounting and invoices',
    available: false,
  },
}

const SYNC_STATUS_BADGE: Record<SyncStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-600' },
  syncing: { label: 'Syncing...', className: 'bg-blue-100 text-blue-700' },
  ready: { label: 'Ready', className: 'bg-green-100 text-green-700' },
  error: { label: 'Error', className: 'bg-red-100 text-red-700' },
}

interface ConnectorCardProps {
  provider: string
  connectorId?: string
  isConnected: boolean
  syncStatus?: SyncStatus
  lastSyncedAt?: string | null
  syncError?: string | null
}

export function ConnectorCard({
  provider,
  connectorId,
  isConnected,
  syncStatus,
  lastSyncedAt,
  syncError,
}: ConnectorCardProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const meta = PROVIDER_META[provider]
  if (!meta) return null

  const statusBadge = syncStatus ? SYNC_STATUS_BADGE[syncStatus] : null

  async function handleSync() {
    setIsSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/sync/stripe', { method: 'POST' })
      if (res.ok) {
        setSyncMsg('Sync started. This may take a moment.')
      } else {
        setSyncMsg('Sync failed. Please try again.')
      }
    } catch {
      setSyncMsg('Network error. Please try again.')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Card className={isConnected ? 'border-green-300' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{meta.name}</CardTitle>
            <CardDescription className="mt-0.5 text-sm">{meta.description}</CardDescription>
          </div>
          {isConnected && statusBadge && (
            <Badge className={`text-xs ${statusBadge.className} hover:${statusBadge.className}`}>
              {statusBadge.label}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isConnected ? (
          <div className="space-y-3">
            {lastSyncedAt && (
              <p className="text-xs text-muted-foreground">
                Last synced: {new Date(lastSyncedAt).toLocaleString()}
              </p>
            )}
            {syncError && (
              <p className="text-xs text-destructive">Error: {syncError}</p>
            )}
            {syncMsg && (
              <p className="text-xs text-muted-foreground">{syncMsg}</p>
            )}
            <div className="flex gap-2">
              {provider === 'stripe' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleSync()}
                  disabled={isSyncing || syncStatus === 'syncing'}
                >
                  {isSyncing ? 'Starting...' : 'Sync now'}
                </Button>
              )}
              <a
                href={`/api/connectors/${provider}/disconnect?id=${connectorId ?? ''}`}
                className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Disconnect
              </a>
            </div>
          </div>
        ) : meta.available ? (
          <a
            href={`/api/connectors/${provider}/connect`}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Connect {meta.name}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">Coming soon</p>
        )}
      </CardContent>
    </Card>
  )
}
