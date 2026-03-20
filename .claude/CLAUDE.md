# CLAUDE.md — SMB Analytics Q&A Platform
> Read this file completely before writing any code. Every decision in this file has a reason.

---

## 🧠 Engineer Identity (Apply Every Session)

You are a senior software engineer (10+ YOE). You ship clean, production-ready code
with extreme ownership. You never vibe-code. You think like a staff+ engineer who
reviews their own PRs ruthlessly before calling something done.

**Confidence gate:** If confidence in understanding the task is below 95%, ask a
clarifying question before writing any code. Do not guess. One wrong assumption
wastes more time than one clarifying question.

---

## 📋 Plan First — Always (Highest ROI Rule)

Before writing or editing ANY code, output a plan in this exact structure:

```
1. UNDERSTANDING  — restate the task in your own words
2. FILES CHANGING — list every file that will be created or modified + why
3. RISKS          — edge cases, security concerns, things that could break
4. STEPS          — numbered implementation plan
5. VALIDATION     — how we confirm it works (tests, manual checks, build)
```

After the plan, pause. If the plan looks right, proceed. If anything is unclear, ask.
This single habit reduces rework by ~70%. Never skip it, even for small tasks.

---

## ⚡ Workflow Commands

| Command | File | When |
|---------|------|------|
| `/plan` | workflows/plan.md | Every task — always first |
| `/wizard` | workflows/wizard.md | Feature touching 2+ files |
| `/review` | workflows/review.md | After implementing, before committing |
| `/fix [error]` | workflows/fix.md | Any bug — reproduce → root cause → fix → verify |
| `/refactor` | workflows/refactor.md | Cleaning up duplication or complexity |
| `/deploy` | AGENTS.md → DeployAgent | When all checks pass |
| `/market` | AGENTS.md → MarketingAgent | End of build day |
| `/status` | — | Print agent status board + build checklist |

---

## 🔁 Validation Loop (Never Skip)

After any code change, in this order:
1. `npm run build` — fix all errors before continuing
2. `npm run lint` — fix all warnings on changed files
3. Run relevant tests — fix failures before continuing
4. Manual check — does it actually do what was asked?

Never say "this should work." Verify. Fix in a loop until all four pass.
Ship nothing that doesn't pass the validation loop.

---

## 🔄 Continuous Improvement

At the end of every major task, suggest 1–2 specific improvements to CLAUDE.md,
SKILLS.md, or RULES.md based on what worked or what was painful this session.
If a workflow repeated successfully, propose adding it as a new SKILL.

---

## 🧠 What We Are Building

A **plain-English data Q&A tool for small business owners** who have zero technical background.
The user connects their business tools (Shopify, Stripe, Razorpay, Zoho, QuickBooks), types a question
in plain English, and gets a **correct, trusted answer with a full explanation** of how it was derived.

**Core promise:** No SQL. No dashboards. No data team. Just ask and get an answer.

**Target markets:** United States · India · Middle East (GCC)

---

## 👤 Who We Are Building For

Never forget this person:

> "I pay $300/month for reports I don't open because I don't understand them."
> — Real SMB owner, r/accounting

> "I have data everywhere and answers nowhere."
> — Real SMB owner, r/smallbusiness

Our user is the **owner-operator**. The plumber who employs 5 people. The Shopify merchant doing
$800K/year. The marketing agency with 12 staff. They make every decision themselves. They have
QuickBooks, Shopify, and a gut feeling — and none of those talk to each other.

**They are not:** data analysts, developers, or technical users. Never assume technical knowledge.

---

## 🤖 AI Provider Strategy (Read This First)

**Two tools. Two jobs. Do not confuse them.**

| Tool | What it does | Cost |
|------|-------------|------|
| **Claude Code** (Pro subscription) | Writes your code — this is YOU building | Covered by your Pro plan |
| **Groq API** | Powers your product for SMB users — answers their questions | Free (14,400 req/day) |

Claude Code does not call Groq. Groq does not help you write code.
They are completely separate. Claude Code is your IDE. Groq is your product's engine.

### NOW → Groq (everything, local dev and production)
```
Provider:  Groq
Model:     llama-3.3-70b-versatile
Cost:      $0 — 14,400 free requests/day
Speed:     500+ tokens/sec
Limit:     14,400 req/day free = enough for ~2,800 users asking 5 questions/day
Get key:   console.groq.com → API Keys → Create (free, no credit card, 2 min)
```

Use Groq in `.env.local` for local testing AND in Vercel for production.
Same key, same model, same config everywhere. No switching needed.

### WHEN FIRST REVENUE COMES IN → Upgrade to Claude Sonnet
```
Provider:  Anthropic Claude
Model:     claude-sonnet-4-6
Cost:      ~$3/1M tokens (~$15/month at early scale)
Trigger:   Switch when you have 3+ paying users ($147+/mo revenue)
Why:       Best text-to-SQL accuracy, best answer quality, worth it when users pay for it
How:       Change AI_PROVIDER=anthropic + AI_API_KEY in .env.local and Vercel. One line.
```

### The Config File (NEVER hardcode provider anywhere else)
```typescript
// src/config/ai.ts — THE ONLY PLACE provider is set
export const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || 'groq',
  model:    process.env.AI_MODEL    || 'llama-3.3-70b-versatile',
  apiKey:   process.env.AI_API_KEY  || '',
} as const;
```

All AI calls go through `src/lib/ai/query.ts` — never call provider APIs directly in components or routes.

---

## 🏗️ Tech Stack (Non-Negotiable)

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router) | Full-stack, Vercel-native, best Claude Code support |
| Language | TypeScript (strict mode) | Catches bugs, Claude writes better TS |
| Styling | Tailwind CSS + shadcn/ui | Fast UI, copy-paste components, no CSS files |
| Database | Supabase (PostgreSQL) | Auth + DB + Edge Functions in one, free tier generous |
| Auth | Supabase Auth | Email + Google OAuth, row-level security built in |
| Payments (US/ME) | Stripe | Subscriptions, webhooks, battle-tested |
| Payments (India) | Razorpay | UPI + cards + wallets, lower fees for INR |
| Email | Resend | Deliverable transactional email, free 100/day |
| Analytics | PostHog | Product analytics, free 1M events/month |
| Monitoring | Better Stack | Uptime alerts, free tier |
| Deployment | Vercel | One-click, global CDN, Mumbai + Dubai edge nodes |
| AI SDK | Vercel AI SDK | Provider-agnostic, streaming, works with all models |

**Do not introduce new dependencies without asking.** Every package must justify its existence.

---

## 📁 Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (login, signup, forgot-password)
│   ├── (dashboard)/              # Protected app pages
│   │   ├── ask/                  # Main question interface — the core product
│   │   ├── connectors/           # Connect/manage data sources
│   │   ├── history/              # Past questions and answers
│   │   └── settings/             # Account, billing, region
│   ├── api/                      # API routes
│   │   ├── ask/route.ts          # POST /api/ask — main AI endpoint
│   │   ├── connectors/           # OAuth callbacks, sync jobs
│   │   │   ├── shopify/
│   │   │   ├── stripe/
│   │   │   ├── razorpay/
│   │   │   └── zoho/
│   │   ├── webhooks/             # Stripe + Razorpay payment webhooks
│   │   └── sync/route.ts         # Data sync scheduler
│   └── layout.tsx
├── components/
│   ├── ui/                       # shadcn/ui components (auto-generated)
│   ├── ask/                      # Question box, answer display, transparency panel
│   ├── connectors/               # Connector cards, OAuth buttons, sync status
│   └── shared/                   # Navbar, sidebar, loading states
├── lib/
│   ├── ai/
│   │   ├── query.ts              # Main AI call — text to SQL to answer
│   │   ├── prompts.ts            # All system prompts (never inline)
│   │   ├── schema-builder.ts     # Builds DB schema context for AI
│   │   └── providers.ts          # Provider abstraction (Groq → Gemini → Claude Sonnet)
│   ├── connectors/
│   │   ├── shopify.ts            # Shopify API client + data normalizer
│   │   ├── stripe.ts             # Stripe API client + data normalizer
│   │   ├── razorpay.ts           # Razorpay API client + data normalizer
│   │   └── zoho.ts               # Zoho Books API client + data normalizer
│   ├── db/
│   │   ├── schema.ts             # Drizzle ORM schema definitions
│   │   └── queries.ts            # Common DB queries
│   └── utils/
│       ├── currency.ts           # Multi-currency formatting (USD/INR/AED)
│       └── regions.ts            # Region detection + pricing routing
├── config/
│   ├── ai.ts                     # AI provider config (THE only place)
│   └── regions.ts                # Pricing per region
└── types/
    ├── connectors.ts             # Connector data types
    └── ai.ts                     # AI response types
```

---

## 🗄️ Database Schema (Supabase / PostgreSQL)

```sql
-- Users (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users primary key,
  email text not null,
  full_name text,
  region text default 'US',          -- 'US' | 'IN' | 'ME'
  plan text default 'free',          -- 'free' | 'paid'
  questions_today int default 0,
  questions_reset_at timestamptz default now(),
  stripe_customer_id text,
  razorpay_customer_id text,
  created_at timestamptz default now()
);

-- Connected data sources
create table public.connectors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles not null,
  provider text not null,             -- 'shopify' | 'stripe' | 'razorpay' | 'zoho'
  shop_domain text,                   -- for Shopify
  access_token text,                  -- encrypted
  refresh_token text,                 -- encrypted
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  sync_status text default 'pending', -- 'pending' | 'syncing' | 'ready' | 'error'
  schema_snapshot jsonb,              -- cached schema for AI context
  created_at timestamptz default now()
);

-- Normalized orders (from any connector)
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles not null,
  connector_id uuid references public.connectors not null,
  external_id text not null,          -- original ID from source
  amount numeric not null,
  currency text default 'USD',
  amount_usd numeric,                 -- normalized to USD for cross-currency queries
  status text,
  customer_id text,
  customer_email text,
  product_id text,
  product_name text,
  ordered_at timestamptz,
  created_at timestamptz default now()
);

-- Normalized products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles not null,
  connector_id uuid references public.connectors not null,
  external_id text not null,
  name text,
  price numeric,
  cost numeric,                       -- if available
  currency text default 'USD',
  category text,
  created_at timestamptz default now()
);

-- Question history
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles not null,
  question text not null,
  sql_generated text,                 -- the SQL the AI wrote
  raw_result jsonb,                   -- raw DB result rows
  answer text not null,               -- plain English answer
  explanation text,                   -- transparency: how it was derived
  verification_status text default 'unverified', -- 'verified' | 'unverified' | 'sql_rejected' | 'empty_result' | 'sanity_failed' | 'error'
  confidence text default 'medium',   -- 'high' | 'medium' | 'low'
  numbers_used jsonb,                 -- numbers extracted from answer for cross-check
  model_used text,                    -- which AI model answered
  latency_ms int,
  created_at timestamptz default now()
);

-- Row Level Security (CRITICAL — each user sees only their data)
alter table public.profiles enable row level security;
alter table public.connectors enable row level security;
alter table public.orders enable row level security;
alter table public.products enable row level security;
alter table public.questions enable row level security;

create policy "users see own data" on public.profiles for all using (auth.uid() = id);
create policy "users see own connectors" on public.connectors for all using (auth.uid() = user_id);
create policy "users see own orders" on public.orders for all using (auth.uid() = user_id);
create policy "users see own products" on public.products for all using (auth.uid() = user_id);
create policy "users see own questions" on public.questions for all using (auth.uid() = user_id);
```

---

## 🤖 Core AI Flow — How a Question Gets Answered

This is the most important function in the product. Get this right first.
Every step has a verification gate. A wrong answer that looks right is worse than no answer.

```
1. User types:      "Which product made me the most money last month?"

2. Context build:   Fetch user's schema snapshot from connectors table.
                    Build compact schema description for the AI prompt.

3. AI call:         Send to provider (Groq/Claude):
                    - System prompt: who the AI is, what data is available
                    - User prompt: the question + schema context
                    - Expected output: { sql, explanation, answer_template, confidence }

── VERIFICATION GATE 1: SQL Safety ─────────────────────────────────────────
4. SQL validation:  Before executing, run isSafeQuery() check:
                    - Must start with SELECT
                    - Must NOT contain: INSERT, UPDATE, DELETE, DROP, TRUNCATE,
                      ALTER, CREATE, GRANT, REVOKE, EXEC, --, ;; (stacked queries)
                    - Must reference only tables the user owns (user_id scoped)
                    If validation fails → reject silently, return safe error to user,
                    log to PostHog as 'unsafe_sql_attempt'

── VERIFICATION GATE 2: Result Sanity ──────────────────────────────────────
5. SQL execution:   Run the validated SQL against user's data (READ ONLY).
                    After getting result, run sanity checks:
                    - Result is not null/empty → if empty, return "no data" message
                    - Numeric values are non-negative for revenue/counts
                    - Date values fall within a plausible range (not year 1970 or 2099)
                    - Row count is reasonable (< 10,000 rows — if more, the query is wrong)
                    If sanity fails → do NOT pass bad data to answer formatter.
                    Return: "I got an unexpected result. Try rephrasing the question."

── VERIFICATION GATE 3: Answer Consistency ─────────────────────────────────
6. Answer format:   Send raw SQL result to AI for plain-English formatting.
                    AI returns: { answer, explanation, confidence, numbers_used }
                    
                    Run consistency check — verify the number in the answer
                    actually appears in the raw SQL result:
                    - Extract all numbers from answer string
                    - Verify each appears (within 1% rounding tolerance) in raw_result
                    - If a number in the answer has NO match in the data → flag as unverified
                    
                    If consistency check fails:
                    - Do not show the answer as confident
                    - Set confidence = 'low'
                    - Show amber warning: "This answer couldn't be fully verified.
                      Check the data yourself before acting on it."

── VERIFICATION GATE 4: Confidence Display ─────────────────────────────────
7. Transparency:    Show user:
                    - The answer in large text
                    - Confidence badge: ✓ Verified (green) | ⚠ Unverified (amber) | ✗ Failed (red)
                    - "Here's how I got this:" explanation
                    - The tables and date range used
                    - The actual numbers from the raw data that back the answer
                    - Option to see the SQL (collapsed by default, click to expand)
                    - Option to see the raw data rows (collapsed, click to expand)

8. Save:            Store in questions table:
                    question + sql + raw_result + answer + explanation +
                    verification_status + confidence + model_used + latency_ms
```

### Verification Status Values
```typescript
type VerificationStatus =
  | 'verified'      // all gates passed, numbers match raw data
  | 'unverified'    // answer generated but numbers could not be cross-checked
  | 'sql_rejected'  // unsafe SQL caught before execution
  | 'empty_result'  // query ran but returned no rows
  | 'sanity_failed' // result data failed sanity checks
  | 'error'         // unexpected failure
```

---

## 📝 AI Prompt Templates (Never Inline — Always in prompts.ts)

```typescript
// src/lib/ai/prompts.ts

export const SYSTEM_PROMPT = (schema: string) => `
You are a data analyst assistant for a small business owner.
You have access to their business data through the following database schema:

${schema}

RULES:
1. Always generate valid PostgreSQL SELECT queries only. Never UPDATE, DELETE, INSERT, or DROP.
2. All monetary values are stored in the original currency. Use amount_usd for cross-currency comparison.
3. Return ONLY valid JSON. No markdown, no explanation outside the JSON.
4. If you cannot answer confidently, say so in the answer field.
5. Keep answers under 3 sentences. Business owners want the answer, not an essay.
6. Always explain HOW you got the answer — which tables, which date range, what calculation.

Return this exact JSON structure:
{
  "sql": "SELECT ...",
  "answer": "Your best product last month was Lemon Candle at $4,200 in revenue.",
  "explanation": "I looked at your orders table for November 2025, grouped by product_name, and summed the amount_usd column.",
  "confidence": "high" | "medium" | "low",
  "tables_used": ["orders", "products"]
}
`;

export const ANSWER_WHEN_NO_DATA = `
I couldn't find data to answer that question. This usually means:
- Your connector hasn't finished syncing yet (check the Connectors page)
- You don't have data for that time period
- The question refers to data we don't collect yet
`;
```

---

## 💰 Pricing & Region Logic

```typescript
// src/config/regions.ts

export const PRICING = {
  US: { currency: 'USD', symbol: '$', monthly: 49, free_questions_per_day: 5 },
  IN: { currency: 'INR', symbol: '₹', monthly: 799, free_questions_per_day: 5 },
  ME: { currency: 'USD', symbol: '$', monthly: 39, free_questions_per_day: 5 },
} as const;

export const PAYMENT_PROVIDERS = {
  US: 'stripe',
  IN: 'razorpay',
  ME: 'stripe',
} as const;
```

Region is detected on signup via IP geolocation (use `@vercel/edge` for this).
Users can manually change their region in Settings.
Billing always routes through the correct payment provider for their region.

---

## 🔌 Connector Priority (Build in This Order)

| Priority | Connector | Market | API Docs |
|----------|-----------|--------|----------|
| 1 | **Stripe** | US + ME | stripe.com/docs/api |
| 2 | **Shopify** | US + ME | shopify.dev/api |
| 3 | **Razorpay** | India | razorpay.com/docs |
| 4 | **Zoho Books** | India + ME | zoho.com/books/api |
| 5 | QuickBooks | US | developer.intuit.com |

**For v1: Build Stripe only. Ship. Then add Shopify. Then Razorpay.**
Do not build all connectors at once. One perfect connector beats five broken ones.

### Connector Data Sync Pattern
```typescript
// Every connector follows this exact pattern
interface ConnectorSync {
  connect(userId: string, authCode: string): Promise<void>   // OAuth
  sync(connectorId: string): Promise<void>                    // Fetch + store
  getSchema(connectorId: string): Promise<string>             // For AI context
  disconnect(connectorId: string): Promise<void>              // Revoke + delete
}
```

Data is synced on connect (full) and every 6 hours (incremental).
Use Supabase Edge Functions with cron for the 6-hour sync.

---

## 🛡️ Security Rules (Non-Negotiable)

1. **Row Level Security is ALWAYS on.** Every table has RLS. Never disable it.
2. **API keys are NEVER in client code.** Only server-side API routes touch external APIs.
3. **OAuth tokens are encrypted** before storage. Use `@supabase/supabase-js` server client with service role only in Edge Functions.
4. **SQL execution is read-only.** The DB user Claude uses has SELECT permission only. No writes.
5. **Rate limiting on /api/ask.** Free users: 5/day. Paid users: unlimited. Enforce server-side, not client-side.
6. **Never log user questions** to external services. PostHog tracks question count, not content.

---

## 🌍 Multi-Region Requirements

- **Language:** English only for v1. Architecture must support i18n (use `next-intl`) for Hindi + Arabic later.
- **RTL:** Add `dir="rtl"` to `<html>` for Arabic. Use `rtl:` Tailwind variant throughout.
- **Currency display:** Always show currency symbol + amount. Never show raw numbers without context.
- **Date formats:** US uses MM/DD/YYYY. India uses DD/MM/YYYY. Middle East uses DD/MM/YYYY. Detect from region.
- **Timezone:** Store all timestamps in UTC. Display in user's local timezone.

---

## 🎨 UI/UX Principles

**The product is ONE text box.** Resist the urge to add dashboards, charts, and widgets in v1.

### Core UI Rules
1. **Main screen = question box only.** Placeholder: "Ask your business a question..."
2. **Answers stream word-by-word** (use Vercel AI SDK streaming). Never make users wait for full response.
3. **Transparency is always visible** — not behind a toggle. Every answer shows how it was derived.
4. **Loading states** on every async action. An SMB owner hitting submit and seeing nothing is churn.
5. **Error messages in plain English.** Never show stack traces, SQL errors, or technical messages to users.
6. **Mobile-first.** Many India and ME users will access on mobile. Test on 375px width.

### Color & Style
- Use shadcn/ui defaults — clean, minimal, professional
- Primary action color: blue (trust + data)
- Success answers: subtle green left border
- Error/uncertain answers: amber left border
- Font: Inter (already in shadcn default)

---

## ⚡ Performance Requirements

- **Answer latency target:** Under 5 seconds end-to-end for 90% of questions
- **Page load:** Under 2 seconds globally (Vercel edge handles this)
- **DB queries:** All user data queries must use indexed columns. Add indexes on: `user_id`, `ordered_at`, `product_name`
- **Schema caching:** Cache the AI schema context in Supabase. Rebuild only when connector syncs. Never build it fresh on every question.

---

## 🧪 Testing Approach

For v1, focus on these 20 questions that must ALWAYS work correctly:

```
Revenue questions:
1. "What was my total revenue last month?"
2. "What was my best month this year?"
3. "How much revenue did I make last week?"

Product questions:
4. "Which product made me the most money?"
5. "What is my best-selling product?"
6. "Which products am I losing money on?" (if cost data available)

Customer questions:
7. "How many new customers did I get this month?"
8. "Who are my top 10 customers by revenue?"
9. "What percentage of my customers come back?"

Trend questions:
10. "Is my revenue growing or declining?"
11. "What day of the week are my sales highest?"
12. "What time of year is my slowest?"

Comparison questions:
13. "Compare this month to last month"
14. "How does this quarter compare to last quarter?"
15. "Which month was my best last year?"
```

If all 15 work reliably, ship. Do not wait for 100% coverage.

---

## 🚀 Deployment Checklist

Before any production deploy:
- [ ] All environment variables set in Vercel dashboard
- [ ] Supabase RLS policies verified with test user
- [ ] Rate limiting tested (5 questions/day free tier enforced)
- [ ] Stripe webhooks connected and tested with Stripe CLI
- [ ] Better Stack uptime monitor configured
- [ ] PostHog events firing correctly
- [ ] Mobile layout tested at 375px
- [ ] Error boundaries on all async components
- [ ] SQL injection protection verified (parameterized queries only)

---

## 🔧 Environment Variables

**Same Groq key works in both .env.local and Vercel. No difference between local and production.**

### .env.local — Your machine (used when testing locally)
```bash
# .env.local  ← never commit this file, it's in .gitignore

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Server only — never expose to client

# ✅ Groq — same key for local and production
AI_PROVIDER=groq
AI_MODEL=llama-3.3-70b-versatile
AI_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx  # from console.groq.com (free)

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Connectors
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
STRIPE_CONNECT_CLIENT_ID=

# Email
RESEND_API_KEY=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Vercel Dashboard → Settings → Environment Variables (Production)
```bash
# Set these in Vercel UI — NOT in any file you commit

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ✅ Groq — exact same values as .env.local
AI_PROVIDER=groq
AI_MODEL=llama-3.3-70b-versatile
AI_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx  # same key as local

# Payments (use Stripe test keys until go-live)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Connectors
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
STRIPE_CONNECT_CLIENT_ID=

# Email
RESEND_API_KEY=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### How to get your Groq API key (free, 2 minutes)
```
1. Go to console.groq.com
2. Sign up with Google (free)
3. Click "API Keys" in sidebar
4. Click "Create API Key"
5. Copy the key (starts with gsk_)
6. Paste into Vercel dashboard as AI_API_KEY
Done. 14,400 free requests/day immediately.
```

---

## 📋 Current Build Status

Track what's done so Claude Code knows where to pick up:

- [ ] Project scaffolding (Next.js 15 + Supabase + Tailwind + shadcn)
- [ ] Auth (email + Google OAuth)
- [ ] Database schema + RLS policies
- [ ] AI provider abstraction (Groq now, Claude Sonnet when revenue comes)
- [ ] Core question box UI
- [ ] /api/ask route with Groq integration
- [ ] Stripe connector (OAuth + sync)
- [ ] Answer display with transparency layer
- [ ] Free tier rate limiting (5 questions/day)
- [ ] Stripe subscriptions + webhooks
- [ ] Shopify connector
- [ ] Razorpay connector + India pricing
- [ ] Zoho Books connector
- [ ] Onboarding email sequence (Resend)
- [ ] PostHog analytics events
- [ ] Landing page
- [ ] Production deploy (Vercel)

**Update this list as you complete tasks.**

---

## 💬 How to Work With Claude Code

### Starting every session
```
"Read CLAUDE.md completely. Current build status: [paste checklist].
Today's task: [what we're building]. Let's start with /plan."
```

### For any new feature
```
/plan
[describe what you want]
```
Claude will output the 5-part plan. Review it. Say "looks good, proceed" or correct it.
Never let Claude jump straight to code.

### When stuck on a bug
```
"I'm stuck. Error: [paste exact error]. File: [filename]. Relevant code: [paste].
Run the validation loop after fixing."
```

### For a thorough build session
```
/wizard
[describe the feature]
```
Runs the full 8-phase flow from plan to PR description. Use this for anything
that touches more than 2 files.

### Adding a new connector
```
"Add a [ConnectorName] connector following the ConnectorSync interface in CLAUDE.md.
Their API docs are at [URL]. Store normalized data in the orders/products tables.
Start with /plan."
```

### Switching AI provider (when first revenue arrives)
```
"Switch AI provider to Claude Sonnet — we have paying users now.
Update AI_PROVIDER=anthropic, AI_MODEL=claude-sonnet-4-6 in
.env.local and Vercel dashboard. Start with /plan."
```

### At the end of every session
```
"Summarize what we built, what changed, any risks, and suggest 1-2 improvements
to CLAUDE.md or SKILLS.md based on today's session."
```

---

*Last updated: March 2026 | Product: SMB Analytics Q&A | Stage: Pre-launch*
*Architecture: Next.js 15 + Supabase + Groq (free) → Claude Sonnet (at revenue)*
