'use client'

import { useState } from 'react'
import { Separator } from '@/components/ui/separator'

interface TransparencyPanelProps {
  explanation: string | null
  sql: string | null
  rawResult: unknown[] | null
}

export function TransparencyPanel({ explanation, sql, rawResult }: TransparencyPanelProps) {
  const [showSql, setShowSql] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const rowCount = rawResult?.length ?? 0

  return (
    <div className="mt-5 space-y-3">
      <Separator />

      {/* How I got this answer */}
      {explanation && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            How I got this answer
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{explanation}</p>
        </div>
      )}

      {/* SQL toggle */}
      {sql && (
        <div>
          <button
            onClick={() => setShowSql(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            aria-expanded={showSql}
          >
            <span>{showSql ? '▲' : '▼'}</span>
            <span>Show SQL query</span>
          </button>
          {showSql && (
            <pre className="mt-2 max-h-48 overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
              {sql}
            </pre>
          )}
        </div>
      )}

      {/* Raw data toggle */}
      {rawResult && rowCount > 0 && (
        <div>
          <button
            onClick={() => setShowRaw(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            aria-expanded={showRaw}
          >
            <span>{showRaw ? '▲' : '▼'}</span>
            <span>
              Show raw data ({rowCount} {rowCount === 1 ? 'row' : 'rows'})
            </span>
          </button>
          {showRaw && (
            <pre className="mt-2 max-h-48 overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
              {JSON.stringify(rawResult, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
