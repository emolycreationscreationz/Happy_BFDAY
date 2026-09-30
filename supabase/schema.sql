-- =========================================================
--  Happy Boyfriend's Day: Supabase setup
--  Supabase dashboard → SQL Editor → New query → paste all → Run
--  Safe to run more than once (it only adds what's missing).
-- =========================================================

-- ---------- Cards made in customize.html ----------
create table if not exists public.cards (
  slug        text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  data        jsonb not null default '{}'::jsonb,
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.cards enable row level security;

-- Only the logged-in owner can list, create, edit or delete their cards
drop policy if exists "owner reads cards"   on public.cards;
drop policy if exists "owner adds cards"    on public.cards;
drop policy if exists "owner edits cards"   on public.cards;
drop policy if exists "owner deletes cards" on public.cards;
create policy "owner reads cards"   on public.cards for select to authenticated using (owner = auth.uid());
create policy "owner adds cards"    on public.cards for insert to authenticated with check (owner = auth.uid());
create policy "owner edits cards"   on public.cards for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner deletes cards" on public.cards for delete to authenticated using (owner = auth.uid());
grant select, insert, update, delete on public.cards to authenticated;

-- Visitors can fetch ONE card by its link name, but can never list the cards
create or replace function public.get_card(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select data from public.cards where slug = p_slug;
$$;
revoke all on function public.get_card(text) from public;
grant execute on function public.get_card(text) to anon, authenticated;

-- ---------- Visits: a row every time an envelope is opened ----------
create table if not exists public.visits (
  id         bigint generated always as identity primary key,
  opened_at  timestamptz not null default now(),
  user_agent text
);
alter table public.visits add column if not exists card_id text;
alter table public.visits enable row level security;

drop policy if exists "page can log a visit" on public.visits;
create policy "page can log a visit" on public.visits
  for insert to anon, authenticated with check (true);

-- The editor shows visit counts for your own cards (and the main card)
drop policy if exists "owner reads visits" on public.visits;
create policy "owner reads visits" on public.visits
  for select to authenticated
  using (card_id = 'main' or exists (select 1 from public.cards c where c.slug = visits.card_id and c.owner = auth.uid()));

grant insert on public.visits to anon, authenticated;
grant select on public.visits to authenticated;

-- ---------- Storage for photos and videos ----------
-- Public bucket: files are viewable by link; only you can upload, into your own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-media', 'card-media', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

drop policy if exists "owner uploads media" on storage.objects;
drop policy if exists "owner reads media"   on storage.objects;
drop policy if exists "owner deletes media" on storage.objects;
create policy "owner uploads media" on storage.objects for insert to authenticated
  with check (bucket_id = 'card-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner reads media" on storage.objects for select to authenticated
  using (bucket_id = 'card-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes media" on storage.objects for delete to authenticated
  using (bucket_id = 'card-media' and (storage.foldername(name))[1] = auth.uid()::text);
