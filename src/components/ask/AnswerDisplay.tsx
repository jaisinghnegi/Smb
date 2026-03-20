'use client'

import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TransparencyPanel } from './TransparencyPanel'
import type { VerificationStatus, Confidence } from '@/lib/db/schema'

interface AnswerResult {
  answer: string
  explanation: string | null
  sql_generated: string | null
  raw_result: unknown[] | null
  verification_status: string
  confidence: string
  numbers_used: number[]
  latency_ms: number
}

interface StatusConfig {
  label: string
  badgeClass: string
  borderClass: string
}

const STATUS_CONFIG: Record<VerificationStatus, StatusConfig> = {
  verified: {
    label: '✓ Verified',
    badgeClass: 'bg-green-100 text-green-800 hover:bg-green-100',
    borderClass: 'border-l-4 border-l-green-500',
  },
  unverified: {
    label: '⚠ Unverified',
    badgeClass: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
    borderClass: 'border-l-4 border-l-amber-500',
  },
  sql_rejected: {
    label: '✗ Failed',
    badgeClass: 'bg-red-100 text-red-800 hover:bg-red-100',
    borderClass: 'border-l-4 border-l-red-500',
  },
  empty_result: {
    label: 'No Data',
    badgeClass: 'bg-slate-100 text-slate-600 hover:bg-slate-100',
    borderClass: 'border-l-4 border-l-slate-400',
  },
  sanity_failed: {
    label: '⚠ Uncertain',
    badgeClass: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
    borderClass: 'border-l-4 border-l-amber-500',
  },
  error: {
    label: '✗ Error',
    badgeClass: 'bg-red-100 text-red-800 hover:bg-red-100',
    borderClass: 'border-l-4 border-l-red-500',
  },
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

interface AnswerDisplayProps {
  result: AnswerResult
}

export function AnswerDisplay({ result }: AnswerDisplayProps) {
  const status = result.verification_status as VerificationStatus
  const confidence = result.confidence as Confidence
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['error']

  return (
    <div className={`rounded-lg border bg-card p-6 shadow-sm ${config.borderClass}`}>
      {/* Header row: verification badge + confidence */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className={config.badgeClass}>{config.label}</Badge>
        {confidence && (
          <span className="text-xs text-muted-foreground">{CONFIDENCE_LABEL[confidence]}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{result.latency_ms}ms</span>
      </div>

      {/* Main answer */}
      <p className="text-lg font-medium leading-relaxed text-foreground">{result.answer}</p>

      {/* Unverified warning */}
      {(status === 'unverified' || status === 'sanity_failed') && (
        <Alert className="mt-4 border-amber-200 bg-amber-50">
          <AlertDescription className="text-sm text-amber-800">
            This answer could not be fully verified. Check the data yourself before acting on it.
          </AlertDescription>
        </Alert>
      )}

      {/* Transparency panel */}
      <TransparencyPanel
        explanation={result.explanation}
        sql={result.sql_generated}
        rawResult={result.raw_result}
      />
    </div>
  )
}
