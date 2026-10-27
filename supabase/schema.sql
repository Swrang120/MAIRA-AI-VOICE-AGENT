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


-- MAIRA private-by-default library, opt-in public marketplace, subscriptions and creator share.
alter table public.voice_profiles
  add column if not exists gender text not null default 'Not specified',
  add column if not exists visibility text not null default 'private' check (visibility in ('private','public')),
  add column if not exists public_listing_consent boolean not null default false,
  add column if not exists public_listing_consent_at timestamptz,
  add column if not exists owner_payout_percent numeric(5,2) not null default 30.00 check (owner_payout_percent >= 0 and owner_payout_percent <= 100),
  add column if not exists consent_evidence_path text,
  add column if not exists consent_revoked_at timestamptz;

create table if not exists public.voice_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_profile_id uuid not null references public.voice_profiles(id) on delete restrict,
  characters_count integer not null default 0 check (characters_count >= 0),
  billed_amount numeric(12,2) not null default 0 check (billed_amount >= 0),
  currency text not null default 'INR',
  provider_cost numeric(12,2) not null default 0 check (provider_cost >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.voice_creator_earnings (
  id uuid primary key default gen_random_uuid(),
  voice_profile_id uuid not null references public.voice_profiles(id) on delete restrict,
  creator_id uuid not null references auth.users(id) on delete restrict,
  usage_id uuid not null unique references public.voice_usage(id) on delete restrict,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  share_percent numeric(5,2) not null default 30.00 check (share_percent >= 0 and share_percent <= 100),
  creator_amount numeric(12,2) not null check (creator_amount >= 0),
  platform_amount numeric(12,2) not null check (platform_amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  payout_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create table if not exists public.voice_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_inr numeric(12,2) not null check (price_inr >= 0),
  billing_period text not null default 'monthly' check (billing_period in ('monthly','yearly','one_time')),
  included_characters integer not null default 0 check (included_characters >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.voice_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.voice_subscription_plans(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','active','cancelled','expired','past_due')),
  provider text,
  provider_subscription_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.prevent_profile_role_escalation()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Only trusted server-side admin operations can change account roles';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles
for each row execute function public.prevent_profile_role_escalation();

create or replace function public.is_maira_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
revoke all on function public.is_maira_admin() from public;
grant execute on function public.is_maira_admin() to authenticated;

alter table public.voice_usage enable row level security;
alter table public.voice_creator_earnings enable row level security;
alter table public.voice_subscription_plans enable row level security;
alter table public.voice_subscriptions enable row level security;

drop policy if exists "Read active or owned voices" on public.voice_profiles;
drop policy if exists "Read public active or own voices" on public.voice_profiles;
create policy "Read public active or own voices" on public.voice_profiles for select to authenticated
using (owner_id = auth.uid() or (status = 'active' and visibility = 'public' and public_listing_consent = true and consent_revoked_at is null));

drop policy if exists "Users create voice profile requests" on public.voice_profiles;
drop policy if exists "Users submit own clone requests" on public.voice_clone_requests;
create policy "Users submit own clone requests" on public.voice_clone_requests for insert to authenticated
with check (requester_id = auth.uid() and consent_confirmed = true);

drop policy if exists "Users read own voice usage" on public.voice_usage;
create policy "Users read own voice usage" on public.voice_usage for select to authenticated using (user_id = auth.uid());
drop policy if exists "Creators read own earnings" on public.voice_creator_earnings;
create policy "Creators read own earnings" on public.voice_creator_earnings for select to authenticated using (creator_id = auth.uid());
drop policy if exists "Users read own voice subscriptions" on public.voice_subscriptions;
create policy "Users read own voice subscriptions" on public.voice_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists "Read active voice subscription plans" on public.voice_subscription_plans;
create policy "Read active voice subscription plans" on public.voice_subscription_plans for select to authenticated using (is_active = true);

drop policy if exists "MAIRA admins manage voice profiles" on public.voice_profiles;
create policy "MAIRA admins manage voice profiles" on public.voice_profiles for all to authenticated
using (public.is_maira_admin()) with check (public.is_maira_admin());
drop policy if exists "MAIRA admins manage clone requests" on public.voice_clone_requests;
create policy "MAIRA admins manage clone requests" on public.voice_clone_requests for all to authenticated
using (public.is_maira_admin()) with check (public.is_maira_admin());
drop policy if exists "MAIRA admins manage creator earnings" on public.voice_creator_earnings;
create policy "MAIRA admins manage creator earnings" on public.voice_creator_earnings for all to authenticated
using (public.is_maira_admin()) with check (public.is_maira_admin());
drop policy if exists "MAIRA admins read all voice usage" on public.voice_usage;
create policy "MAIRA admins read all voice usage" on public.voice_usage for select to authenticated using (public.is_maira_admin());
drop policy if exists "MAIRA admins manage subscription plans" on public.voice_subscription_plans;
create policy "MAIRA admins manage subscription plans" on public.voice_subscription_plans for all to authenticated
using (public.is_maira_admin()) with check (public.is_maira_admin());
drop policy if exists "MAIRA admins manage subscriptions" on public.voice_subscriptions;
create policy "MAIRA admins manage subscriptions" on public.voice_subscriptions for all to authenticated
using (public.is_maira_admin()) with check (public.is_maira_admin());
