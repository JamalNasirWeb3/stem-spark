-- STEM SPARK database setup. Paste into Supabase: SQL Editor -> New query -> Run.
-- Safe to run again: it only creates what is missing.

-- Saved lesson plans, one row per plan, visible only to the teacher who saved it.
create table if not exists public.plans (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  saved_at timestamptz not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, saved_at)
);

alter table public.plans enable row level security;

drop policy if exists "Teachers read their plans" on public.plans;
create policy "Teachers read their plans" on public.plans
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Teachers save their plans" on public.plans;
create policy "Teachers save their plans" on public.plans
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Teachers delete their plans" on public.plans;
create policy "Teachers delete their plans" on public.plans
  for delete to authenticated using (user_id = auth.uid());

-- One row per Claude request, for the daily limits enforced by the backend.
-- No update or delete policy, so teachers can't reset their own count.
create table if not exists public.generations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('problems', 'lesson_plan')),
  created_at timestamptz not null default now()
);

create index if not exists generations_user_day on public.generations (user_id, kind, created_at);

alter table public.generations enable row level security;

drop policy if exists "Teachers read their usage" on public.generations;
create policy "Teachers read their usage" on public.generations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Backend records usage" on public.generations;
create policy "Backend records usage" on public.generations
  for insert to authenticated with check (user_id = auth.uid() and created_at >= now() - interval '1 minute');
