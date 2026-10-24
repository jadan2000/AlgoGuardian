-- Short-lived one-time QR codes. Raw pairing codes are never stored.
create table if not exists public.notification_pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  installation_id uuid not null references public.notification_installations(installation_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'claimed')),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notification_pairing_sessions_expiry_idx
  on public.notification_pairing_sessions (expires_at);
alter table public.notification_pairing_sessions enable row level security;
revoke all on table public.notification_pairing_sessions from anon, authenticated;
