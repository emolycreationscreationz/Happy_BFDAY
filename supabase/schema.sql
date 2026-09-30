-- =========================================================
--  Happy Boyfriend's Day: Supabase setup
--  Supabase dashboard → SQL Editor → New query → paste all → Run
--  Safe to run more than once.
-- =========================================================

-- ---------- Cards (made by clients in customize.html) ----------
create table if not exists public.cards (
  slug        text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- (clean-up from an earlier account-based version, if it was ever run)
drop policy if exists "owner reads cards"   on public.cards;
drop policy if exists "owner adds cards"    on public.cards;
drop policy if exists "owner edits cards"   on public.cards;
drop policy if exists "owner deletes cards" on public.cards;
alter table public.cards drop column if exists owner;
-- No direct access: the website only uses the two functions below.
-- You see and manage every card in Table Editor → cards.
alter table public.cards enable row level security;
revoke all on public.cards from anon, authenticated;

-- ---------- Visits: a row every time an envelope is opened ----------
create table if not exists public.visits (
  id         bigint generated always as identity primary key,
  opened_at  timestamptz not null default now(),
  user_agent text
);
alter table public.visits add column if not exists card_id text;
alter table public.visits enable row level security;
drop policy if exists "owner reads visits"   on public.visits;
drop policy if exists "page can log a visit" on public.visits;
create policy "page can log a visit" on public.visits for insert to anon, authenticated with check (true);
revoke all on public.visits from anon, authenticated;
grant insert on public.visits to anon, authenticated;

-- ---------- Functions the website calls ----------
-- Fetch ONE card by its exact link name (nobody can list cards)
create or replace function public.get_card(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select data from public.cards where slug = p_slug;
$$;

-- Create a new card. The link name is made here from the names plus a random ending,
-- so nobody can pick or overwrite someone else's card. Returns { slug }.
create or replace function public.create_card(p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  base text;
  s    text;
  i    int := 0;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then return jsonb_build_object('error', 'data'); end if;
  if length(p_data::text) > 200000 then return jsonb_build_object('error', 'too_big'); end if;
  base := lower(coalesce(p_data->>'hisName', '') || '-' || coalesce(p_data->>'herName', ''));
  base := trim(both '-' from regexp_replace(base, '[^a-z0-9]+', '-', 'g'));
  if length(base) < 2 then base := 'card'; end if;
  base := left(base, 40);
  loop
    s := base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    exit when not exists (select 1 from public.cards where slug = s);
    i := i + 1;
    if i > 10 then return jsonb_build_object('error', 'busy'); end if;
  end loop;
  insert into public.cards (slug, data) values (s, p_data);
  return jsonb_build_object('slug', s);
end $$;

-- Remove functions from the earlier studio-code version, if present
drop function if exists public.studio_status();
drop function if exists public.studio_setup(text);
drop function if exists public.studio_login(text);
drop function if exists public.studio_change_code(text, text);
drop function if exists public.studio_list(text);
drop function if exists public.studio_save(text, text, jsonb, boolean);
drop function if exists public.studio_delete(text, text);

revoke all on function public.get_card(text) from public;
revoke all on function public.create_card(jsonb) from public;
grant execute on function public.get_card(text) to anon, authenticated;
grant execute on function public.create_card(jsonb) to anon, authenticated;

-- ---------- Storage for photos and videos ----------
-- Viewable by link. The website can only ADD new files into uploads/ (never list,
-- replace or delete). Photos, videos up to 50 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-media', 'card-media', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

drop policy if exists "owner uploads media"  on storage.objects;
drop policy if exists "owner reads media"    on storage.objects;
drop policy if exists "owner deletes media"  on storage.objects;
drop policy if exists "studio uploads media" on storage.objects;
drop policy if exists "studio reads media"   on storage.objects;
drop policy if exists "studio deletes media" on storage.objects;
drop policy if exists "clients upload media" on storage.objects;
create policy "clients upload media" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'card-media' and (storage.foldername(name))[1] = 'uploads');
