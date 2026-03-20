import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncStripeData } from '@/lib/connectors/stripe'

/**
 * POST /api/sync/stripe
 * Manually triggers a Stripe data re-sync for the authenticated user.
 */
export async function POST(): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connector } = await supabase
    .from('connectors')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider', 'stripe')
    .single()

  if (!connector) {
    return NextResponse.json({ error: 'Stripe connector not found' }, { status: 404 })
  }

  try {
    await syncStripeData(connector.id, user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[sync/stripe] syncStripeData failed:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
