import { createClient } from '@/lib/supabase/server'
import type { SchemaSnapshot } from '@/lib/db/schema'

/**
 * Reads the cached schema_snapshot from all ready connectors for a user
 * and formats it as a compact string for the AI system prompt.
 *
 * Returns null if the user has no connectors in 'ready' state.
 * NEVER rebuilds the snapshot from raw DB on every question — that's expensive.
 * The snapshot is rebuilt only after each sync via buildSchemaSnapshot().
 */
export async function buildSchemaContext(userId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data: connectors } = await supabase
    .from('connectors')
    .select('provider, schema_snapshot, last_synced_at')
    .eq('user_id', userId)
    .eq('sync_status', 'ready')

  if (!connectors || connectors.length === 0) return null

  const sections: string[] = []

  for (const connector of connectors) {
    const snapshot = connector.schema_snapshot as SchemaSnapshot | null
    if (!snapshot?.tables || snapshot.tables.length === 0) continue

    sections.push(`## Data from ${connector.provider} (last synced: ${connector.last_synced_at ?? 'unknown'})`)

    for (const table of snapshot.tables) {
      const colLines = table.columns
        .map(c => `  - ${c.name} (${c.type}): ${c.description}`)
        .join('\n')

      const dateRangeStr = table.date_range
        ? ` | date range: ${table.date_range.min} to ${table.date_range.max}`
        : ''

      sections.push(
        `### Table: ${table.name} (${table.row_count.toLocaleString()} rows${dateRangeStr})\n${colLines}`
      )
    }
  }

  if (sections.length === 0) return null

  return sections.join('\n\n')
}

/**
 * Queries the live orders and products tables to build a fresh SchemaSnapshot.
 * Called after each connector sync — NOT on every question.
 * Stores the result in the connector's schema_snapshot column.
 */
export async function buildSchemaSnapshot(
  userId: string,
  connectorId: string
): Promise<void> {
  const supabase = await createClient()

  // ── Orders ───────────────────────────────────────────────────────────────
  const { count: orderCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('connector_id', connectorId)

  const { data: orderDates } = await supabase
    .from('orders')
    .select('ordered_at')
    .eq('user_id', userId)
    .eq('connector_id', connectorId)
    .not('ordered_at', 'is', null)
    .order('ordered_at', { ascending: true })
    .limit(1)

  const { data: orderDatesMax } = await supabase
    .from('orders')
    .select('ordered_at')
    .eq('user_id', userId)
    .eq('connector_id', connectorId)
    .not('ordered_at', 'is', null)
    .order('ordered_at', { ascending: false })
    .limit(1)

  const orderDateRange =
    orderDates?.[0]?.ordered_at && orderDatesMax?.[0]?.ordered_at
      ? { min: orderDates[0].ordered_at as string, max: orderDatesMax[0].ordered_at as string }
      : null

  // ── Products ─────────────────────────────────────────────────────────────
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('connector_id', connectorId)

  // ── Assemble snapshot ────────────────────────────────────────────────────
  const snapshot: SchemaSnapshot = {
    generated_at: new Date().toISOString(),
    tables: [
      {
        name: 'orders',
        row_count: orderCount ?? 0,
        date_range: orderDateRange,
        columns: [
          { name: 'id', type: 'uuid', description: 'Unique order identifier' },
          { name: 'external_id', type: 'text', description: 'Original order ID from the source system' },
          { name: 'amount', type: 'numeric', description: 'Order total in original currency' },
          { name: 'currency', type: 'text', description: 'Three-letter currency code (e.g. USD, INR)' },
          { name: 'amount_usd', type: 'numeric', description: 'Order total normalized to USD for cross-currency comparison' },
          { name: 'status', type: 'text', description: 'Order status (succeeded, pending, failed, refunded)' },
          { name: 'customer_id', type: 'text', description: 'Customer identifier from the source system' },
          { name: 'customer_email', type: 'text', description: 'Customer email address' },
          { name: 'product_id', type: 'text', description: 'Product identifier from the source system' },
          { name: 'product_name', type: 'text', description: 'Human-readable product name' },
          { name: 'ordered_at', type: 'timestamptz', description: 'When the order was placed (UTC)' },
          { name: 'created_at', type: 'timestamptz', description: 'When this record was imported' },
        ],
      },
      {
        name: 'products',
        row_count: productCount ?? 0,
        date_range: null,
        columns: [
          { name: 'id', type: 'uuid', description: 'Unique product identifier' },
          { name: 'external_id', type: 'text', description: 'Original product ID from the source system' },
          { name: 'name', type: 'text', description: 'Product name' },
          { name: 'price', type: 'numeric', description: 'Product selling price in original currency' },
          { name: 'cost', type: 'numeric', description: 'Product cost (if available)' },
          { name: 'currency', type: 'text', description: 'Three-letter currency code' },
          { name: 'category', type: 'text', description: 'Product category (if available)' },
          { name: 'created_at', type: 'timestamptz', description: 'When this record was imported' },
        ],
      },
    ],
  }

  await supabase
    .from('connectors')
    .update({ schema_snapshot: snapshot })
    .eq('id', connectorId)
    .eq('user_id', userId)
}
