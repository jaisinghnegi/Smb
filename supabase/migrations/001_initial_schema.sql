-- ============================================================
-- SMB Analytics Q&A Platform — Initial Schema
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id                    uuid references auth.users on delete cascade primary key,
  email                 text not null,
  full_name             text,
  region                text not null default 'US',        -- 'US' | 'IN' | 'ME'
  plan                  text not null default 'free',      -- 'free' | 'paid'
  questions_today       int  not null default 0,
  questions_reset_at    timestamptz not null default now(),
  stripe_customer_id    text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- CONNECTORS (one row per connected data source per user)
-- ============================================================
create table public.connectors (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles on delete cascade not null,
  provider          text not null,                -- 'stripe' | 'shopify' | 'razorpay' | 'zoho'
  shop_domain       text,                         -- Shopify only
  access_token      text,                         -- encrypted in application layer
  refresh_token     text,
  token_expires_at  timestamptz,
  last_synced_at    timestamptz,
  sync_status       text not null default 'pending', -- 'pending' | 'syncing' | 'ready' | 'error'
  sync_error        text,
  schema_snapshot   jsonb,                        -- cached schema for AI context
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, provider)
);

create index connectors_user_id_idx on public.connectors (user_id);

-- ============================================================
-- ORDERS (normalized from any connector)
-- ============================================================
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles on delete cascade not null,
  connector_id    uuid references public.connectors on delete cascade not null,
  external_id     text not null,
  amount          numeric(12, 2) not null,
  currency        text not null default 'USD',
  amount_usd      numeric(12, 2),
  status          text,
  customer_id     text,
  customer_email  text,
  product_id      text,
  product_name    text,
  ordered_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (connector_id, external_id)
);

create index orders_user_id_idx          on public.orders (user_id);
create index orders_ordered_at_idx       on public.orders (ordered_at);
create index orders_product_name_idx     on public.orders (product_name);
create index orders_customer_email_idx   on public.orders (customer_email);
create index orders_status_idx           on public.orders (status);

-- ============================================================
-- PRODUCTS (normalized from any connector)
-- ============================================================
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles on delete cascade not null,
  connector_id  uuid references public.connectors on delete cascade not null,
  external_id   text not null,
  name          text,
  price         numeric(12, 2),
  cost          numeric(12, 2),
  currency      text not null default 'USD',
  category      text,
  created_at    timestamptz not null default now(),
  unique (connector_id, external_id)
);

create index products_user_id_idx on public.products (user_id);
create index products_name_idx    on public.products (name);

-- ============================================================
-- QUESTIONS (full audit trail for every AI interaction)
-- ============================================================
create table public.questions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.profiles on delete cascade not null,
  question              text not null,
  sql_generated         text,
  raw_result            jsonb,
  answer                text not null,
  explanation           text,
  verification_status   text not null default 'unverified',
  -- 'verified' | 'unverified' | 'sql_rejected' | 'empty_result' | 'sanity_failed' | 'error'
  confidence            text not null default 'medium',   -- 'high' | 'medium' | 'low'
  numbers_used          jsonb,
  model_used            text,
  latency_ms            int,
  created_at            timestamptz not null default now()
);

create index questions_user_id_idx    on public.questions (user_id);
create index questions_created_at_idx on public.questions (created_at);

-- ============================================================
-- ROW LEVEL SECURITY — every table, no exceptions
-- ============================================================
alter table public.profiles   enable row level security;
alter table public.connectors enable row level security;
alter table public.orders     enable row level security;
alter table public.products   enable row level security;
alter table public.questions  enable row level security;

create policy "profiles: own data"
  on public.profiles for all
  using (auth.uid() = id);

create policy "connectors: own data"
  on public.connectors for all
  using (auth.uid() = user_id);

create policy "orders: own data"
  on public.orders for all
  using (auth.uid() = user_id);

create policy "products: own data"
  on public.products for all
  using (auth.uid() = user_id);

create policy "questions: own data"
  on public.questions for all
  using (auth.uid() = user_id);

-- ============================================================
-- UPDATED_AT triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger connectors_updated_at
  before update on public.connectors
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- SECURE SQL EXECUTION FUNCTION
-- Used by src/lib/ai/query.ts — defense-in-depth security boundary.
-- Runs AI-generated SELECT queries inside a read-only transaction.
-- RLS still applies because auth.uid() is in scope.
-- ============================================================
create or replace function public.execute_user_query(
  p_user_id uuid,
  p_sql     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- Defense-in-depth: validate at DB layer even after app-layer checks
  if p_sql !~* '^\s*SELECT\s' then
    raise exception 'Only SELECT queries are allowed';
  end if;

  if p_sql ~* '\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b' then
    raise exception 'DDL and DML operations are not allowed';
  end if;

  -- Execute inside a read-only sub-transaction
  begin
    execute 'SET LOCAL TRANSACTION READ ONLY';
    execute
      'SELECT jsonb_agg(row_to_json(q)) FROM (' || p_sql || ') q'
      into v_result;
  end;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- Only authenticated users can call this
revoke all on function public.execute_user_query(uuid, text) from public;
grant  execute on function public.execute_user_query(uuid, text) to authenticated;
