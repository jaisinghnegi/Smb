import { createClient } from '@/lib/supabase/server'
import type { Connector, Question } from './schema'

// ── Rate limiting ─────────────────────────────────────────────────────────────

/**
 * Checks whether the user has questions remaining today.
 * If allowed, atomically increments their daily counter.
 * Resets the counter if last reset was before today (UTC midnight).
 */
export async function checkAndIncrementQuestionCount(userId: string): Promise<{
  allowed: boolean
  questionsToday: number
  limit: number
}> {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('questions_today, questions_reset_at, plan')
    .eq('id', userId)
    .single()

  if (error ?? !profile) throw new Error('Profile not found')

  const limit = profile.plan === 'paid' ? Infinity : 5

  // Reset counter if last reset was before today (UTC midnight)
  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)
  const needsReset = new Date(profile.questions_reset_at) < todayUTC
  const currentCount = needsReset ? 0 : profile.questions_today

  if (currentCount >= limit) {
    return { allowed: false, questionsToday: currentCount, limit }
  }

  await supabase
    .from('profiles')
    .update({
      questions_today: needsReset ? 1 : currentCount + 1,
      ...(needsReset ? { questions_reset_at: new Date().toISOString() } : {}),
    })
    .eq('id', userId)

  return { allowed: true, questionsToday: currentCount + 1, limit }
}

// ── Connectors ────────────────────────────────────────────────────────────────

/**
 * Returns the first ready connector for a given provider, or null.
 */
export async function getReadyConnector(
  userId: string,
  provider: string
): Promise<Connector | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('connectors')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('sync_status', 'ready')
    .single()
  return data ?? null
}

/**
 * Returns all connectors for a user (any status).
 */
export async function getUserConnectors(userId: string): Promise<Connector[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('connectors')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// ── Questions ─────────────────────────────────────────────────────────────────

/**
 * Saves a completed question + answer to the questions table.
 */
export async function saveQuestion(
  userId: string,
  payload: Omit<Question, 'id' | 'user_id' | 'created_at'>
): Promise<Question> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .insert({ user_id: userId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data as Question
}

/**
 * Returns the last N questions for a user, newest first.
 */
export async function getQuestionHistory(
  userId: string,
  limit = 50
): Promise<Question[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('questions')
    .select(
      'id, question, answer, verification_status, confidence, created_at, latency_ms'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as Question[]
}
