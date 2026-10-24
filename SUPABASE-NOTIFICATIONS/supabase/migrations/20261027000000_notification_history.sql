-- Durable per-installation notification history for the mobile app.
create table if not exists public.installation_notifications (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.notification_installations(installation_id) on delete cascade,
  event text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists installation_notifications_history_idx
  on public.installation_notifications (installation_id, created_at desc);

alter table public.installation_notifications enable row level security;
revoke all on table public.installation_notifications from anon, authenticated;
