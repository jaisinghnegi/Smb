import { createGroq } from '@ai-sdk/groq'
import { AI_CONFIG } from '@/config/ai'

/**
 * Returns the configured AI provider model instance for use with the Vercel AI SDK.
 * This is the ONLY place that imports AI provider SDKs.
 *
 * To add a new provider (e.g. Anthropic when revenue comes in), add a branch here.
 * Never add providers anywhere else in the codebase.
 */
export function getAIProvider() {
  if (AI_CONFIG.provider === 'groq') {
    const groq = createGroq({ apiKey: AI_CONFIG.apiKey })
    return groq(AI_CONFIG.model)
  }

  // Future: switch to Anthropic Claude when first revenue arrives
  // if (AI_CONFIG.provider === 'anthropic') {
  //   const anthropic = createAnthropic({ apiKey: AI_CONFIG.apiKey })
  //   return anthropic(AI_CONFIG.model)
  // }

  throw new Error(
    `Unsupported AI provider: "${AI_CONFIG.provider}". Valid values: groq, anthropic`
  )
}
