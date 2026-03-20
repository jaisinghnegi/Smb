import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkAndIncrementQuestionCount, saveQuestion } from '@/lib/db/queries'
import { runAIQuery } from '@/lib/ai/query'
import { ANSWER_WHEN_RATE_LIMITED } from '@/lib/ai/prompts'

const AskBodySchema = z.object({
  question: z
    .string()
    .min(3, 'Question must be at least 3 characters')
    .max(500, 'Question must be under 500 characters'),
})

/**
 * POST /api/ask
 * Orchestrates: auth → rate limit → AI query → save → respond
 *
 * PostHog tracking: verification_status + latency only.
 * NEVER logs question text or answer to external services.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Validate request body ─────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AskBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const { question } = parsed.data

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const rateLimit = await checkAndIncrementQuestionCount(user.id)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: ANSWER_WHEN_RATE_LIMITED,
        rate_limited: true,
        questions_today: rateLimit.questionsToday,
        questions_limit: rateLimit.limit,
      },
      { status: 429 }
    )
  }

  // ── AI query ──────────────────────────────────────────────────────────────
  const result = await runAIQuery(user.id, question)

  // ── Persist ───────────────────────────────────────────────────────────────
  const saved = await saveQuestion(user.id, {
    question,
    sql_generated: result.sql_generated,
    raw_result: result.raw_result as unknown[] | null,
    answer: result.answer,
    explanation: result.explanation,
    verification_status: result.verification_status,
    confidence: result.confidence,
    numbers_used: result.numbers_used,
    model_used: result.model_used,
    latency_ms: result.latency_ms,
  })

  // ── Fire-and-forget PostHog (server-side, NO question content) ────────────
  void trackQuestion(user.id, result.verification_status, result.latency_ms)

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    id: saved.id,
    answer: result.answer,
    explanation: result.explanation,
    sql_generated: result.sql_generated,
    raw_result: result.raw_result,
    verification_status: result.verification_status,
    confidence: result.confidence,
    numbers_used: result.numbers_used,
    model_used: result.model_used,
    latency_ms: result.latency_ms,
    questions_today: rateLimit.questionsToday,
    questions_limit: rateLimit.limit,
  })
}

async function trackQuestion(
  userId: string,
  verificationStatus: string,
  latencyMs: number
): Promise<void> {
  try {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'
    if (!posthogKey) return

    await fetch(`${posthogHost}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: posthogKey,
        event: 'question_asked',
        distinct_id: userId,
        properties: {
          verification_status: verificationStatus,
          latency_ms: latencyMs,
          // NEVER include question text or answer
        },
      }),
    })
  } catch {
    // Analytics failure must never break the main flow
  }
}
