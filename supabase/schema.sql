-- Reference only — this describes the schema as actually deployed in the
-- live Supabase project (public.foamico_gallery_registrations). It is not
-- applied automatically by this repo; the table, trigger, and RLS lockdown
-- already exist in the project referenced by SUPABASE_URL.
--
-- dealer_code is intentionally left out of application inserts: a
-- BEFORE INSERT trigger (generate_foamico_dealer_code) assigns it
-- atomically per state (e.g. "FOA-UP-0001"), backed by a small
-- foamico_dealer_code_sequences(state_abbr, next_seq) counter table.
--
-- RLS is enabled with no policies, so only the service_role key (used
-- exclusively by /api/submit-registration, never sent to the browser) can
-- read or write. The client never talks to Supabase directly.

create table if not exists public.foamico_gallery_registrations (
  id uuid primary key default gen_random_uuid(),
  dealer_code text unique,
  language text not null default 'en' check (language in ('en','hi')),

  mobile text not null check (mobile ~ '^[0-9]{10}$'),
  mobile_verified boolean not null default false,

  owner_name text not null,
  date_of_birth text not null,
  is_unmarried boolean not null default false,
  anniversary_date text,
  alternate_mobile text,
  email text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),

  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  district text,
  state text,
  firm_address text not null,
  landmark text not null,

  shop_size text,
  display_mattress_count integer,
  staff_count integer,

  years_in_trade integer,
  brands_kept text[],
  brands_other text,
  monthly_sales_volume text,
  fv_monthly_count integer,

  gallery_commitment_accepted boolean not null default false,
  final_declaration_confirmed boolean not null default false,

  user_agent text,
  ip_address text,
  raw_payload jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists foamico_gallery_registrations_mobile_key
  on public.foamico_gallery_registrations (mobile);

alter table public.foamico_gallery_registrations enable row level security;
