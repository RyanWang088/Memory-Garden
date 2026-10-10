-- Memory Garden: Supabase database setup for login + onboarding.
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query, then click Run.
-- Run it once on a new project. Running it again will fail because the table already exists.

-- 1. Profiles table: one row per user, holding the app's own data about them
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text,
  display_name       text,
  onboarded          boolean not null default false,
  onboarding_answers jsonb   not null default '{}'::jsonb,
  avatar             text,
  coins              integer not null default 50,
  exp                integer not null default 0,
  streak             integer not null default 0,
  last_tended        timestamptz,
  created_at         timestamptz not null default now()
);

-- 2. Security: each logged-in user can only see and edit their own row
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 3. Trigger: automatically create a profile row whenever someone signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =====================================================================
-- 4. Seeds (Add a seed): one row per study set = one plant in Memory Beds.
--    Already ran sections 1-3? Paste and run only from here down.
-- =====================================================================
create table public.seeds (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null,                                  -- Study Set Name
  subject       text not null,                                  -- typed by the user
  tags          text[] not null default '{}',                   -- e.g. {WAD2,CSS}
  cards         jsonb  not null default '[]'::jsonb,            -- [{ "question": "...", "answer": "..." }]
  plot          smallint not null check (plot between 0 and 7), -- which of the 8 garden spots
  flower        text not null check (flower in ('sunflower', 'tulip', 'lavender', 'cactus')),
  mastery       smallint not null default 0 check (mastery between 0 and 100),
  last_reviewed timestamptz,
  exam_date     date,
  created_at    timestamptz not null default now(),
  unique (user_id, plot)                                        -- one plant per spot
);

alter table public.seeds enable row level security;

create policy "Users can view own seeds"
  on public.seeds for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add own seeds"
  on public.seeds for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own seeds"
  on public.seeds for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own seeds"
  on public.seeds for delete
  to authenticated
  using ((select auth.uid()) = user_id);


-- =====================================================================
-- 5. Coloured tags: tags become [{ "name": "CSS", "color": "mint" }] instead of plain words.
--    Already ran section 4? Paste and run only from here down.
--    Old plain-word tags are kept; the app shows them in the default colour.
-- =====================================================================
alter table public.seeds alter column tags drop default;
alter table public.seeds alter column tags type jsonb using to_jsonb(tags);
alter table public.seeds alter column tags set default '[]'::jsonb;
