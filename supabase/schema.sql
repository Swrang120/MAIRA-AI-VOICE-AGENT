-- MAIRA AI Voice Agent: initial database schema
-- Apply only after reviewing the SQL in your own Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.voice_profiles (
  id uuid primary key default gen_random_uuid(),
  public_voice_id text not null unique,
  name text not null,
  language text not null default 'Multilingual',
  profile_type text not null default 'Custom',
  description text,
  status text not null default 'pending' check (status in ('pending','active','inactive','rejected')),
  owner_id uuid references auth.users(id) on delete set null,
  provider text,
  provider_voice_id text,
  consent_confirmed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_clone_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  requested_name text not null,
  language text not null default 'Multilingual',
  notes text,
  status text not null default 'pending_review' check (status in ('pending_review','approved','in_progress','completed','rejected')),
  requester_id uuid references auth.users(id) on delete set null,
  consent_confirmed boolean not null default false,
  consent_notes text,
  admin_notes text,
  voice_profile_id uuid references public.voice_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_profiles_owner_idx on public.voice_profiles(owner_id);
create index if not exists voice_profiles_status_idx on public.voice_profiles(status);
create index if not exists clone_requests_requester_idx on public.voice_clone_requests(requester_id);
create index if not exists clone_requests_status_idx on public.voice_clone_requests(status);

alter table public.profiles enable row level security;
alter table public.voice_profiles enable row level security;
alter table public.voice_clone_requests enable row level security;

-- Users can read/update their own basic profile; role changes must be handled securely by an admin-only server function.
create policy "Users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users update own display name" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Authenticated users can see active public voice profiles and their own profiles.
create policy "Read active or owned voices" on public.voice_profiles for select to authenticated using (status = 'active' or owner_id = auth.uid());
create policy "Users create voice profile requests" on public.voice_profiles for insert to authenticated with check (owner_id = auth.uid() and status = 'pending');
create policy "Users submit own clone requests" on public.voice_clone_requests for insert to authenticated with check (requester_id = auth.uid() and consent_confirmed = true);
create policy "Users read own clone requests" on public.voice_clone_requests for select to authenticated using (requester_id = auth.uid());

-- Admin write access should be implemented with server-side authorization/Edge Functions.
-- Do not add public write policies or expose provider secrets in the browser.
