'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Magic link auth means there's no password to forget.
// This page exists to handle users who land here from old bookmarks or habit.
export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">No password needed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            We use magic links — just enter your email on the sign-in page and
            we&apos;ll send you a link to log in instantly.
          </p>
          <Link
            href="/login"
            className="text-sm underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
