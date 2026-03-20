export const PRICING = {
  US: { currency: 'USD' as const, symbol: '$',  monthly: 49,  free_questions_per_day: 5 },
  IN: { currency: 'INR' as const, symbol: '₹', monthly: 799, free_questions_per_day: 5 },
  ME: { currency: 'USD' as const, symbol: '$',  monthly: 39,  free_questions_per_day: 5 },
} as const

export const PAYMENT_PROVIDERS = {
  US: 'stripe',
  IN: 'razorpay',
  ME: 'stripe',
} as const

export type Region = keyof typeof PRICING
