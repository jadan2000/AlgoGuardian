-- Immutable record of a user's acceptance of the AlgoGuardian Agreement.
-- Apply this migration to the Supabase project connected to the frontend.

create table if not exists public.agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  agreement_version text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint agreement_acceptances_version_not_blank check (length(trim(agreement_version)) > 0),
  constraint agreement_acceptances_one_version_per_user unique (user_id, agreement_version)
);

alter table public.agreement_acceptances enable row level security;

-- Signed-in users may record acceptance only for their own authenticated account.
create policy "Users can record their own agreement acceptance"
  on public.agreement_acceptances
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can read only their own record. No update/delete policies are intentionally provided.
create policy "Users can read their own agreement acceptance"
  on public.agreement_acceptances
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke update, delete on public.agreement_acceptances from anon, authenticated;
grant select, insert on public.agreement_acceptances to authenticated;
