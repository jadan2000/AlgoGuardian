-- Remote monitoring and engine-only commands. Access is mediated exclusively by the Edge Function service role.
alter table public.notification_installations
  add column if not exists latest_snapshot jsonb,
  add column if not exists last_seen_at timestamptz;

create table if not exists public.installation_commands (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.notification_installations(installation_id) on delete cascade,
  action text not null check (action in ('start', 'pause')),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'completed', 'failed', 'expired')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 seconds'),
  claimed_at timestamptz,
  completed_at timestamptz,
  result jsonb
);
create index if not exists installation_commands_poll_idx
  on public.installation_commands (installation_id, status, requested_at);
alter table public.installation_commands enable row level security;
revoke all on table public.installation_commands from anon, authenticated;

-- Atomic command claim prevents two polling workers from processing the same request.
create or replace function public.claim_installation_commands(p_installation_id uuid, p_limit integer default 5)
returns setof public.installation_commands
language sql
security definer
set search_path = public
as $$
  update public.installation_commands c
  set status = 'claimed', claimed_at = now()
  where c.id in (
    select id from public.installation_commands
    where installation_id = p_installation_id
      and status = 'pending'
      and expires_at > now()
    order by requested_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 10))
  )
  returning c.*;
$$;
revoke all on function public.claim_installation_commands(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_installation_commands(uuid, integer) to service_role;
