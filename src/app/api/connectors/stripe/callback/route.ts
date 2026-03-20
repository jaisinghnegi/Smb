import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { connectStripe } from '@/lib/connectors/stripe'

/**
 * GET /api/connectors/stripe/callback
 * Handles the Stripe OAuth redirect after the user authorizes.
 * Verifies state === authenticated user ID (CSRF protection).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Stripe returned an error (user declined, etc.)
  if (error) {
    const msg = encodeURIComponent(errorDescription ?? error)
    return NextResponse.redirect(`${origin}/connectors?error=${msg}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/connectors?error=missing_params`)
  }

  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  // CSRF: state must match authenticated user's ID
  if (state !== user.id) {
    return NextResponse.redirect(`${origin}/connectors?error=state_mismatch`)
  }

  try {
    await connectStripe(user.id, code)
    return NextResponse.redirect(`${origin}/connectors?connected=stripe`)
  } catch (err) {
    console.error('[stripe/callback] connectStripe failed:', err)
    const msg = encodeURIComponent('Failed to connect Stripe. Please try again.')
    return NextResponse.redirect(`${origin}/connectors?error=${msg}`)
  }
}
