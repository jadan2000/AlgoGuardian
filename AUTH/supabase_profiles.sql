-- Run this in Supabase SQL Editor before enabling registration.
-- Email confirmation must be disabled separately in Supabase Auth settings.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  activation_status text not null default 'pending'
    check (activation_status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile name" on public.profiles;
create policy "Users can update their own profile name"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, activation_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Activation is deliberately not user-editable. An administrator should activate
-- an account only after the product's subscription/payment checks are implemented.
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;


-- M-Pesa activation payments. Run this migration in Supabase SQL Editor.
create table if not exists public.mpesa_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  phone_number text not null,
  amount integer not null check (amount = 1000),
  currency text not null default 'KES' check (currency = 'KES'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'review')),
  checkout_request_id text unique,
  merchant_request_id text,
  mpesa_receipt_number text unique,
  result_code integer,
  result_description text,
  transaction_date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mpesa_payments_user_status_idx
  on public.mpesa_payments (user_id, status, created_at desc);

alter table public.mpesa_payments enable row level security;
-- Payment records are only read/written by the trusted backend service role.
revoke all on public.mpesa_payments from anon, authenticated;
