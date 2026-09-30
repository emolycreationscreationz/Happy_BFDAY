-- =========================================================
--  Happy Boyfriend's Day: Supabase setup
--  Supabase dashboard → SQL Editor → New query → paste all → Run
-- =========================================================

-- When he opened the envelope
create table if not exists public.visits (
  id         bigint generated always as identity primary key,
  opened_at  timestamptz not null default now(),
  user_agent text
);

-- Messages he writes back to you
create table if not exists public.replies (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 60),
  message    text not null check (char_length(message) between 1 and 1500)
);

-- One-row counter for the "send a kiss back" button
create table if not exists public.kisses (
  id    int primary key default 1 check (id = 1),
  total bigint not null default 0
);
insert into public.kisses (id, total) values (1, 0) on conflict (id) do nothing;

-- Row Level Security: the page can only ADD rows, never read them.
-- You read everything in the dashboard (Table Editor).
alter table public.visits  enable row level security;
alter table public.replies enable row level security;
alter table public.kisses  enable row level security;

drop policy if exists "page can log a visit" on public.visits;
create policy "page can log a visit" on public.visits
  for insert to anon with check (true);

drop policy if exists "page can send a reply" on public.replies;
create policy "page can send a reply" on public.replies
  for insert to anon with check (true);

grant insert on public.visits, public.replies to anon;

-- Kiss counter: add (max 50 per call) and read the total
create or replace function public.add_kisses(amount int)
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.kisses
     set total = total + greatest(1, least(coalesce(amount, 1), 50))
   where id = 1
  returning total;
$$;

create or replace function public.get_kisses()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select total from public.kisses where id = 1;
$$;

revoke all on function public.add_kisses(int) from public;
revoke all on function public.get_kisses() from public;
grant execute on function public.add_kisses(int) to anon;
grant execute on function public.get_kisses() to anon;
