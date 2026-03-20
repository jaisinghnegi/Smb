'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  async function handleGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Ask your business anything
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <div className="text-center space-y-2 py-4">
              <p className="font-medium">Check your email</p>
              <p className="text-sm text-muted-foreground">
                We sent a sign-in link to <strong>{email}</strong>
              </p>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogle}
                type="button"
              >
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <form onSubmit={handleMagicLink} className="space-y-3">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={loading || !email}>
                  {loading ? 'Sending...' : 'Send sign-in link'}
                </Button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link href="/signup" className="underline underline-offset-4">
              Sign up free
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
