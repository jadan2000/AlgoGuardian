-- Private per-installation FCM token registry. Only the Edge Function service role may access it.
create table if not exists public.notification_installations (
  installation_id uuid primary key,
  secret_hash text not null,
  device_tokens jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_device_tokens_is_array check (jsonb_typeof(device_tokens) = 'array')
);

alter table public.notification_installations enable row level security;
revoke all on table public.notification_installations from anon, authenticated;
