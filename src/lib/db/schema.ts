// TypeScript types mirroring the Supabase database schema.
// These are hand-written (not generated) to keep them stable and predictable.

export type Region = 'US' | 'IN' | 'ME'
export type Plan = 'free' | 'paid'
export type SyncStatus = 'pending' | 'syncing' | 'ready' | 'error'
export type VerificationStatus =
  | 'verified'
  | 'unverified'
  | 'sql_rejected'
  | 'empty_result'
  | 'sanity_failed'
  | 'error'
export type Confidence = 'high' | 'medium' | 'low'
export type Provider = 'stripe' | 'shopify' | 'razorpay' | 'zoho'

export interface SchemaSnapshot {
  tables: {
    name: string
    columns: { name: string; type: string; description: string }[]
    row_count: number
    date_range: { min: string; max: string } | null
  }[]
  generated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  region: Region
  plan: Plan
  questions_today: number
  questions_reset_at: string
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface Connector {
  id: string
  user_id: string
  provider: Provider
  shop_domain: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  last_synced_at: string | null
  sync_status: SyncStatus
  sync_error: string | null
  schema_snapshot: SchemaSnapshot | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  user_id: string
  connector_id: string
  external_id: string
  amount: number
  currency: string
  amount_usd: number | null
  status: string | null
  customer_id: string | null
  customer_email: string | null
  product_id: string | null
  product_name: string | null
  ordered_at: string | null
  created_at: string
}

export interface Product {
  id: string
  user_id: string
  connector_id: string
  external_id: string
  name: string | null
  price: number | null
  cost: number | null
  currency: string
  category: string | null
  created_at: string
}

export interface Question {
  id: string
  user_id: string
  question: string
  sql_generated: string | null
  raw_result: unknown[] | null
  answer: string
  explanation: string | null
  verification_status: VerificationStatus
  confidence: Confidence
  numbers_used: number[] | null
  model_used: string | null
  latency_ms: number | null
  created_at: string
}
