-- ============================================================
-- Arena Clash – Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. PUBLIC PROFILES TABLE
--    Stores the in-game username for each authenticated user.
-- ============================================================
create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  username    text        not null unique,
  points      integer     not null default 0,
  created_at  timestamptz not null default now()
);

-- Enable Row-Level Security
alter table public.profiles enable row level security;

-- Anyone can read profiles (needed to display opponent names)
create policy "Public read"
  on public.profiles for select
  using (true);

-- Users can only insert/update their own profile row
create policy "Own insert"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Own update"
  on public.profiles for update
  using (auth.uid() = id);


-- 2. OPTIONAL – AUTO-CREATE PROFILE ON SIGN-UP
--    This trigger creates a profile row automatically when a
--    new user registers, using the username from auth metadata.
--    Requires: Database → Extensions → pg_net (already enabled by default)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)   -- fallback: use email prefix
    )
  )
  on conflict (id) do nothing;          -- safe if client already inserted
  return new;
end;
$$;

-- Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 3. INCREMENT POINTS FUNCTION
--    Called after a match is won to award +20 points.
--    Usage: supabase.rpc('increment_points', { user_id, points_to_add })
-- ============================================================
create or replace function public.increment_points(
  user_id      uuid,
  points_to_add integer
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set points = points + points_to_add
  where id = user_id;
end;
$$;

-- Allow any authenticated user to call this function
grant execute on function public.increment_points(uuid, integer) to authenticated;


-- ============================================================
-- HOW TO USE
-- ============================================================
-- 1. Copy .env.example → .env
-- 2. Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON from:
--      Supabase Dashboard → Settings → API
-- 3. Run this entire SQL file in the Supabase SQL Editor.
-- 4. (Optional) Disable "Confirm email" in:
--      Supabase Dashboard → Authentication → Providers → Email
--    so users can log in immediately after registration.
-- ============================================================
