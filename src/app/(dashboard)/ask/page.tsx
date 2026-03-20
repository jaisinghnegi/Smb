'use client'

import { useState } from 'react'
import { QuestionBox } from '@/components/ask/QuestionBox'
import { AnswerDisplay } from '@/components/ask/AnswerDisplay'
import { Skeleton } from '@/components/ui/skeleton'

interface AskResult {
  id: string
  answer: string
  explanation: string | null
  sql_generated: string | null
  raw_result: unknown[] | null
  verification_status: string
  confidence: string
  numbers_used: number[]
  model_used: string
  latency_ms: number
  questions_today: number
  questions_limit: number
}

export default function AskPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)
  const [questionsToday, setQuestionsToday] = useState(0)
  const [questionsLimit, setQuestionsLimit] = useState(5)

  function handleAnswer(newResult: AskResult) {
    setResult(newResult)
    setQuestionsToday(newResult.questions_today)
    setQuestionsLimit(newResult.questions_limit)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ask your data</h1>
        <p className="mt-1 text-muted-foreground">
          Ask any question about your business in plain English.
        </p>
      </div>

      <QuestionBox
        onAnswer={handleAnswer}
        onLoading={setIsLoading}
        questionsToday={questionsToday}
        questionsLimit={questionsLimit}
      />

      {isLoading && (
        <div className="space-y-3 rounded-lg border bg-card p-6">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}

      {!isLoading && result && <AnswerDisplay result={result} />}
    </div>
  )
}
