-- =========================================================
--  Happy Boyfriend's Day: Supabase setup
--  Supabase dashboard → SQL Editor → New query → paste all → Run
--  Safe to run more than once.
-- =========================================================

-- A row every time the envelope is opened
create table if not exists public.visits (
  id         bigint generated always as identity primary key,
  opened_at  timestamptz not null default now(),
  user_agent text
);

-- The page can only ADD rows, never read them. You read them in Table Editor.
alter table public.visits enable row level security;

drop policy if exists "page can log a visit" on public.visits;
create policy "page can log a visit" on public.visits
  for insert to anon with check (true);

grant insert on public.visits to anon;
