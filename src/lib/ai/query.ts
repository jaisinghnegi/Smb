/**
 * Core AI query engine — the most critical file in the product.
 * Implements all 4 verification gates on every question.
 *
 * Gate 1: SQL Safety     — isSafeQuery() before any DB call
 * Gate 2: Result Sanity  — runSanityChecks() on raw rows
 * Gate 3: Answer Check   — verifyAnswerConsistency() numbers match data
 * Gate 4: Confidence     — verification_status surfaced to UI
 *
 * All AI calls go through this file. Never call provider APIs elsewhere.
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { getAIProvider } from './providers'
import { buildSystemPrompt, ANSWER_FORMAT_PROMPT, ANSWER_WHEN_NO_DATA } from './prompts'
import { buildSchemaContext } from './schema-builder'
import { createClient } from '@/lib/supabase/server'
import { AI_CONFIG } from '@/config/ai'
import type { VerificationStatus, Confidence } from '@/lib/db/schema'

// ── Public result type ─────────────────────────────────────────────────────

export interface AIQueryResult {
  answer: string
  explanation: string | null
  sql_generated: string | null
  raw_result: unknown[] | null
  verification_status: VerificationStatus
  confidence: Confidence
  numbers_used: number[]
  model_used: string
  latency_ms: number
}

// ── Zod schemas for structured AI output ──────────────────────────────────

const SQLGenerationSchema = z.object({
  sql: z.string().nullable(),
  answer: z.string(),
  explanation: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  tables_used: z.array(z.string()),
})

const AnswerFormatSchema = z.object({
  answer: z.string(),
  explanation: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  numbers_used: z.array(z.number()),
})

// ── GATE 1: SQL Safety ─────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE)\b/i,
  /--/,           // SQL comments (common injection vector)
  /;.*\S/,        // stacked queries — semicolon followed by more content
  /\/\*/,         // block comments
  /\bINTO\s+OUTFILE\b/i,
  /\bLOAD_FILE\b/i,
  /\bxp_/i,       // SQL Server extended procs (shouldn't be in PG but block anyway)
]

/**
 * Returns true only if the SQL is a safe SELECT query.
 * Defense in depth — the Supabase RPC also checks, but we catch it here first.
 */
export function isSafeQuery(sql: string): boolean {
  const trimmed = sql.trim()
  if (!/^SELECT\s/i.test(trimmed)) return false
  return !FORBIDDEN_PATTERNS.some(p => p.test(trimmed))
}

// ── GATE 2: Result Sanity ──────────────────────────────────────────────────

const MIN_PLAUSIBLE_YEAR = 2000
const MAX_PLAUSIBLE_YEAR = 2100
const MAX_ROWS = 10_000

function runSanityChecks(rows: unknown[]): { passed: boolean; reason?: string } {
  if (rows.length === 0) {
    return { passed: false, reason: 'empty_result' }
  }
  if (rows.length > MAX_ROWS) {
    return { passed: false, reason: `Result has ${rows.length} rows — query may be too broad` }
  }

  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const record = row as Record<string, unknown>

    for (const [key, value] of Object.entries(record)) {
      // Revenue/amount fields must be non-negative
      if (
        typeof value === 'number' &&
        (key.includes('amount') || key.includes('revenue') || key.includes('total')) &&
        value < 0
      ) {
        return { passed: false, reason: `Negative value in ${key}: ${value}` }
      }

      // Date fields must be in a plausible range
      if (typeof value === 'string' && (key.includes('_at') || key.includes('date'))) {
        const year = new Date(value).getFullYear()
        if (!isNaN(year) && (year < MIN_PLAUSIBLE_YEAR || year > MAX_PLAUSIBLE_YEAR)) {
          return { passed: false, reason: `Implausible date in ${key}: ${value}` }
        }
      }
    }
  }

  return { passed: true }
}

// ── GATE 3: Answer Consistency ─────────────────────────────────────────────

/**
 * Extracts all numeric values from raw result rows for cross-checking.
 */
function extractNumbersFromRows(rows: unknown[]): number[] {
  const numbers: number[] = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    for (const value of Object.values(row as Record<string, unknown>)) {
      if (typeof value === 'number' && isFinite(value)) {
        numbers.push(value)
      } else if (typeof value === 'string') {
        const parsed = parseFloat(value)
        if (!isNaN(parsed)) numbers.push(parsed)
      }
    }
  }
  return numbers
}

/**
 * Verifies that each number the AI cited in its answer actually appears
 * in the raw SQL result within a 1% tolerance.
 *
 * Returns true (verified) if all cited numbers are accounted for.
 * Returns false (unverified) if any cited number has no match in raw data.
 */
export function verifyAnswerConsistency(
  numbersUsed: number[],
  rawRows: unknown[]
): boolean {
  if (numbersUsed.length === 0) return true // nothing to verify — pass

  const rawNumbers = extractNumbersFromRows(rawRows)
  if (rawNumbers.length === 0) return false // answer cites numbers but data is empty

  for (const cited of numbersUsed) {
    if (cited === 0) continue // zeroes are trivially satisfied
    const tolerance = Math.abs(cited) * 0.01
    const found = rawNumbers.some(n => Math.abs(n - cited) <= tolerance)
    if (!found) return false
  }

  return true
}

// ── Main query orchestrator ────────────────────────────────────────────────

/**
 * Runs a full AI query cycle for a user's plain-English question.
 * All 4 verification gates are applied on every call.
 */
export async function runAIQuery(
  userId: string,
  question: string
): Promise<AIQueryResult> {
  const startTime = Date.now()
  const model = getAIProvider()
  const modelName = AI_CONFIG.model

  // ── Step 1: Build schema context ─────────────────────────────────────────
  const schemaContext = await buildSchemaContext(userId)

  if (!schemaContext) {
    return {
      answer: ANSWER_WHEN_NO_DATA,
      explanation: null,
      sql_generated: null,
      raw_result: null,
      verification_status: 'empty_result',
      confidence: 'low',
      numbers_used: [],
      model_used: modelName,
      latency_ms: Date.now() - startTime,
    }
  }

  // ── Step 2: AI call — text to SQL ────────────────────────────────────────
  let sqlGeneration: z.infer<typeof SQLGenerationSchema>
  try {
    const result = await generateObject({
      model,
      system: buildSystemPrompt(schemaContext),
      prompt: question,
      schema: SQLGenerationSchema,
    })
    sqlGeneration = result.object
  } catch (err) {
    return errorResult(modelName, startTime, `AI generation failed: ${String(err)}`)
  }

  // ── Step 3: Handle "cannot answer" ───────────────────────────────────────
  if (!sqlGeneration.sql) {
    return {
      answer: sqlGeneration.answer,
      explanation: sqlGeneration.explanation,
      sql_generated: null,
      raw_result: null,
      verification_status: 'empty_result',
      confidence: sqlGeneration.confidence,
      numbers_used: [],
      model_used: modelName,
      latency_ms: Date.now() - startTime,
    }
  }

  // ── GATE 1: SQL Safety ────────────────────────────────────────────────────
  if (!isSafeQuery(sqlGeneration.sql)) {
    return {
      answer: 'I could not safely process that question. Please try rephrasing it.',
      explanation: 'The generated SQL did not pass safety validation.',
      sql_generated: sqlGeneration.sql,
      raw_result: null,
      verification_status: 'sql_rejected',
      confidence: 'low',
      numbers_used: [],
      model_used: modelName,
      latency_ms: Date.now() - startTime,
    }
  }

  // ── Step 4: Execute SQL via secure RPC ───────────────────────────────────
  const supabase = await createClient()
  let rawRows: unknown[]

  try {
    const { data, error } = await supabase.rpc('execute_user_query', {
      p_user_id: userId,
      p_sql: sqlGeneration.sql,
    })
    if (error) throw error
    rawRows = Array.isArray(data) ? data : []
  } catch (err) {
    return errorResult(modelName, startTime, `SQL execution failed: ${String(err)}`)
  }

  // ── GATE 2: Result Sanity ─────────────────────────────────────────────────
  const sanity = runSanityChecks(rawRows)
  if (!sanity.passed) {
    const isEmptyResult = sanity.reason === 'empty_result'
    return {
      answer: isEmptyResult
        ? 'I did not find any data matching that question. You may not have data for that time period.'
        : 'I got an unexpected result. Try rephrasing your question.',
      explanation: sanity.reason ?? null,
      sql_generated: sqlGeneration.sql,
      raw_result: rawRows,
      verification_status: isEmptyResult ? 'empty_result' : 'sanity_failed',
      confidence: 'low',
      numbers_used: [],
      model_used: modelName,
      latency_ms: Date.now() - startTime,
    }
  }

  // ── Step 5: AI call — format plain-English answer ─────────────────────────
  let answerFormat: z.infer<typeof AnswerFormatSchema>
  try {
    const result = await generateObject({
      model,
      system: ANSWER_FORMAT_PROMPT,
      prompt: `Question: ${question}\n\nSQL result:\n${JSON.stringify(rawRows, null, 2)}`,
      schema: AnswerFormatSchema,
    })
    answerFormat = result.object
  } catch (err) {
    return errorResult(modelName, startTime, `Answer formatting failed: ${String(err)}`)
  }

  // ── GATE 3: Answer Consistency ────────────────────────────────────────────
  const isConsistent = verifyAnswerConsistency(answerFormat.numbers_used, rawRows)
  const verificationStatus: VerificationStatus = isConsistent ? 'verified' : 'unverified'

  return {
    answer: answerFormat.answer,
    explanation: answerFormat.explanation,
    sql_generated: sqlGeneration.sql,
    raw_result: rawRows,
    verification_status: verificationStatus,
    confidence: isConsistent ? answerFormat.confidence : 'low',
    numbers_used: answerFormat.numbers_used,
    model_used: modelName,
    latency_ms: Date.now() - startTime,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function errorResult(
  modelName: string,
  startTime: number,
  reason: string
): AIQueryResult {
  return {
    answer: 'Something went wrong while processing your question. Please try again.',
    explanation: reason,
    sql_generated: null,
    raw_result: null,
    verification_status: 'error',
    confidence: 'low',
    numbers_used: [],
    model_used: modelName,
    latency_ms: Date.now() - startTime,
  }
}
