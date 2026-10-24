create table public.notification_installations (installation_id uuid primary key, secret_hash text not null, device_tokens jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.notification_installations enable row level security;
