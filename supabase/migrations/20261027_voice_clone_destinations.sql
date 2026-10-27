-- MAIRA voice clone metadata + secure destination support
-- Run this in Supabase SQL Editor before using the updated clone workflow.
alter table public.voice_profiles
  add column if not exists gender text not null default 'Not specified';

-- Ensure public-library records require explicit opt-in and remain private by default.
alter table public.voice_profiles
  add column if not exists visibility text not null default 'private',
  add column if not exists public_listing_consent boolean not null default false,
  add column if not exists public_listing_consent_at timestamptz;

drop policy if exists "Read active or owned voices" on public.voice_profiles;
drop policy if exists "Read public active or own voices" on public.voice_profiles;
create policy "Read public active or own voices" on public.voice_profiles
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      status = 'active'
      and visibility = 'public'
      and public_listing_consent = true
      and consent_revoked_at is null
    )
  );

-- The existing MAIRA admins policy should remain in place for secure admin management.
