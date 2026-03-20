import type { Region } from '@/config/regions'

/**
 * Formats a numeric amount as a localized currency string.
 * Uses the user's region to pick the correct locale and decimal format.
 */
export function formatCurrency(
  amount: number,
  currency: string,
  region?: Region
): string {
  const locale =
    region === 'IN' ? 'en-IN' : region === 'ME' ? 'ar-AE' : 'en-US'

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
