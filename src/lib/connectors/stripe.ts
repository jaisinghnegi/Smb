/**
 * Stripe Connect connector — OAuth + data sync + disconnect.
 * Normalizes Stripe charges → orders table, products → products table.
 *
 * Never call this from client components. Server/API routes only.
 */

import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { buildSchemaSnapshot } from '@/lib/ai/schema-builder'

// Platform Stripe client (uses our secret key, not the connected account's)
function getPlatformStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-02-25.clover' })
}

// Connected account Stripe client (uses the user's access_token)
function getConnectedStripe(accessToken: string): Stripe {
  return new Stripe(accessToken, { apiVersion: '2026-02-25.clover' })
}

// ── Connect ────────────────────────────────────────────────────────────────

/**
 * Exchanges the OAuth auth code for an access token and creates the connector row.
 * Fires syncStripeData in the background (fire-and-forget).
 */
export async function connectStripe(userId: string, authCode: string): Promise<void> {
  const platformStripe = getPlatformStripe()

  const tokenResponse = await platformStripe.oauth.token({
    grant_type: 'authorization_code',
    code: authCode,
  })

  const accessToken = tokenResponse.access_token
  const stripeUserId = tokenResponse.stripe_user_id

  if (!accessToken || !stripeUserId) {
    throw new Error('Stripe OAuth did not return access_token or stripe_user_id')
  }

  const supabase = await createClient()

  const { data: connector, error } = await supabase
    .from('connectors')
    .upsert(
      {
        user_id: userId,
        provider: 'stripe',
        access_token: accessToken,
        sync_status: 'pending',
        sync_error: null,
      },
      { onConflict: 'user_id,provider' }
    )
    .select('id')
    .single()

  if (error ?? !connector) {
    throw new Error(`Failed to save Stripe connector: ${error?.message ?? 'unknown'}`)
  }

  // Fire and forget — sync runs in background
  void syncStripeData(connector.id, userId).catch(err => {
    console.error('[stripe] Background sync failed:', err)
  })
}

// ── Sync ───────────────────────────────────────────────────────────────────

/**
 * Fetches charges + products from Stripe and upserts into orders/products tables.
 * Updates sync_status: pending → syncing → ready (or error).
 */
export async function syncStripeData(connectorId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  // Mark as syncing
  await supabase
    .from('connectors')
    .update({ sync_status: 'syncing', sync_error: null })
    .eq('id', connectorId)
    .eq('user_id', userId)

  try {
    // Get the access token
    const { data: connector, error: connError } = await supabase
      .from('connectors')
      .select('access_token')
      .eq('id', connectorId)
      .eq('user_id', userId)
      .single()

    if (connError ?? !connector?.access_token) {
      throw new Error('Connector not found or missing access_token')
    }

    const stripe = getConnectedStripe(connector.access_token)

    // ── Sync charges → orders ──────────────────────────────────────────────
    const chargeRows: Record<string, unknown>[] = []

    for await (const charge of stripe.charges.list({ limit: 100 })) {
      if (charge.status !== 'succeeded') continue

      chargeRows.push({
        user_id: userId,
        connector_id: connectorId,
        external_id: charge.id,
        amount: charge.amount / 100,         // Stripe stores cents
        currency: charge.currency.toUpperCase(),
        amount_usd: charge.currency.toLowerCase() === 'usd' ? charge.amount / 100 : null,
        status: charge.status,
        customer_id: typeof charge.customer === 'string' ? charge.customer : (charge.customer?.id ?? null),
        customer_email: charge.billing_details?.email ?? null,
        product_id: null,   // populated from invoice line items when available
        product_name: charge.description ?? null,
        ordered_at: new Date(charge.created * 1000).toISOString(),
      })
    }

    if (chargeRows.length > 0) {
      const { error: ordersError } = await supabase
        .from('orders')
        .upsert(chargeRows, { onConflict: 'connector_id,external_id' })

      if (ordersError) throw new Error(`Orders upsert failed: ${ordersError.message}`)
    }

    // ── Sync products ──────────────────────────────────────────────────────
    const productRows: Record<string, unknown>[] = []

    for await (const product of stripe.products.list({ limit: 100, active: true })) {
      // Fetch default price if available
      let price: number | null = null
      let currency = 'USD'

      if (product.default_price) {
        try {
          const priceId =
            typeof product.default_price === 'string'
              ? product.default_price
              : product.default_price.id
          const priceObj = await stripe.prices.retrieve(priceId)
          if (priceObj.unit_amount != null) {
            price = priceObj.unit_amount / 100
            currency = priceObj.currency.toUpperCase()
          }
        } catch {
          // Non-fatal — product still worth storing without price
        }
      }

      productRows.push({
        user_id: userId,
        connector_id: connectorId,
        external_id: product.id,
        name: product.name ?? null,
        price,
        cost: null,   // Stripe doesn't expose cost
        currency,
        category: product.metadata?.['category'] ?? null,
      })
    }

    if (productRows.length > 0) {
      const { error: productsError } = await supabase
        .from('products')
        .upsert(productRows, { onConflict: 'connector_id,external_id' })

      if (productsError) throw new Error(`Products upsert failed: ${productsError.message}`)
    }

    // ── Build schema snapshot for AI context ──────────────────────────────
    await buildSchemaSnapshot(userId, connectorId)

    // Mark as ready
    await supabase
      .from('connectors')
      .update({ sync_status: 'ready', last_synced_at: new Date().toISOString() })
      .eq('id', connectorId)
      .eq('user_id', userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('connectors')
      .update({ sync_status: 'error', sync_error: message })
      .eq('id', connectorId)
      .eq('user_id', userId)
    throw err
  }
}

// ── Disconnect ─────────────────────────────────────────────────────────────

/**
 * Revokes the Stripe OAuth grant and deletes the connector row.
 * Cascade deletes all orders + products for this connector via FK.
 */
export async function disconnectStripe(connectorId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  const { data: connector } = await supabase
    .from('connectors')
    .select('access_token')
    .eq('id', connectorId)
    .eq('user_id', userId)
    .single()

  // Best-effort deauthorize — don't block deletion if this fails
  if (connector?.access_token) {
    try {
      const platformStripe = getPlatformStripe()
      const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
      if (clientId) {
        // Retrieve the stripe_user_id from the token first
        const connectedStripe = getConnectedStripe(connector.access_token)
        const account = await connectedStripe.accounts.retrieve()
        await platformStripe.oauth.deauthorize({
          client_id: clientId,
          stripe_user_id: account.id,
        })
      }
    } catch (err) {
      console.warn('[stripe] Deauthorize failed (non-fatal):', err)
    }
  }

  // Delete connector row — CASCADE removes orders + products
  await supabase
    .from('connectors')
    .delete()
    .eq('id', connectorId)
    .eq('user_id', userId)
}
