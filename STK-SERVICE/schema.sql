-- Run this in the Supabase SQL Editor for the project dedicated to AlgoGuardian.
create table if not exists public.stk_transactions (
  id uuid primary key default gen_random_uuid(),
  app_name text not null default 'algoguardian' check (app_name = 'algoguardian'),
  phone_number text not null,
  amount integer not null check (amount > 0),
  currency text not null default 'KES' check (currency = 'KES'),
  status text not null default 'initiating' check (status in ('initiating','pending','paid','failed','review')),
  checkout_request_id text unique,
  merchant_request_id text,
  mpesa_receipt_number text unique,
  result_code integer,
  result_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stk_transactions_status_created_idx on public.stk_transactions(status, created_at desc);
alter table public.stk_transactions enable row level security;
revoke all on public.stk_transactions from anon, authenticated;
