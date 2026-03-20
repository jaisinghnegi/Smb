import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/connectors/stripe/connect
 * Redirects the user to Stripe's OAuth authorization page.
 * Passes the user's ID as the state parameter (CSRF protection in callback).
 */
export async function GET(): Promise<never> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!clientId) {
    redirect('/connectors?error=stripe_not_configured')
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_only',
    redirect_uri: `${appUrl}/api/connectors/stripe/callback`,
    state: user.id,
  })

  redirect(`https://connect.stripe.com/oauth/authorize?${params.toString()}`)
}
