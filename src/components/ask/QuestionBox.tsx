'use client'

import { useState, type KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const EXAMPLE_QUESTIONS = [
  'What was my total revenue last month?',
  'Which product made me the most money?',
  'Who are my top 10 customers?',
  'Is my revenue growing or declining?',
]

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

interface QuestionBoxProps {
  onAnswer: (result: AskResult) => void
  onLoading: (loading: boolean) => void
  questionsToday?: number
  questionsLimit?: number
}

export function QuestionBox({
  onAnswer,
  onLoading,
  questionsToday = 0,
  questionsLimit = 5,
}: QuestionBoxProps) {
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = question.trim()
    if (!trimmed || isLoading) return

    setIsLoading(true)
    setError(null)
    onLoading(true)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      })

      const data = (await res.json()) as AskResult & { error?: string; rate_limited?: boolean }

      if (!res.ok) {
        if (data.rate_limited) {
          setError(
            `You've used all ${questionsLimit} free questions for today. Your limit resets at midnight UTC.`
          )
        } else {
          setError(data.error ?? 'Something went wrong. Please try again.')
        }
        return
      }

      onAnswer(data)
      setQuestion('')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
      onLoading(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  const remaining = questionsLimit === Infinity ? null : questionsLimit - questionsToday

  return (
    <div className="w-full space-y-4">
      <div className="relative">
        <Textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your business a question..."
          disabled={isLoading}
          rows={3}
          className="resize-none pr-24 text-base"
          aria-label="Business question"
        />
        <Button
          onClick={() => void submit()}
          disabled={isLoading || !question.trim()}
          size="sm"
          className="absolute bottom-3 right-3"
        >
          {isLoading ? 'Thinking...' : 'Ask'}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Example question chips */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => setQuestion(q)}
            disabled={isLoading}
            className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Rate limit counter */}
      {remaining !== null && (
        <p className="text-xs text-muted-foreground">
          {questionsToday}/{questionsLimit} questions used today
          {remaining <= 1 && remaining > 0 && ' — 1 remaining'}
        </p>
      )}
    </div>
  )
}
