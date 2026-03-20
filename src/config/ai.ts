// THE ONLY PLACE the AI provider is configured.
// To switch providers, change AI_PROVIDER + AI_MODEL + AI_API_KEY
// in .env.local (dev) and Vercel dashboard (prod). Nothing else changes.
//
// Never import AI SDKs directly in components or routes.
// All AI calls must go through src/lib/ai/query.ts.

export const AI_CONFIG = {
  provider: (process.env.AI_PROVIDER ?? 'groq') as 'groq' | 'anthropic',
  model: process.env.AI_MODEL ?? 'llama-3.3-70b-versatile',
  apiKey: process.env.AI_API_KEY ?? '',
} as const

if (!AI_CONFIG.apiKey && process.env.NODE_ENV === 'production') {
  throw new Error(
    'AI_API_KEY is required in production. Set it in Vercel environment variables.'
  )
}
