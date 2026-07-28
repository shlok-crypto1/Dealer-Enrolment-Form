-- Run this once in the Supabase project's SQL editor (or via `supabase db
-- push` if you're using the CLI) before /api/submit-registration will work.
-- It is not applied automatically — nothing in this repo has your project
-- credentials or the ability to reach your Supabase project.

create table if not exists dealer_registrations (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  dealer_code text unique,

  mobile text not null,
  mobile_verified boolean not null default false,
  verified_mobile text,

  owner_name text not null,
  dob text not null,
  unmarried boolean not null default false,
  anniversary text,
  alt_number text,
  email text not null,

  pincode text not null,
  district text,
  state text,
  address text not null,
  landmark text not null,

  shop_size text,
  display_count integer,
  staff_count integer,

  years_in_trade integer,
  brands text[] not null default '{}',
  brands_other text,
  monthly_volume text,
  monthly_fv_count integer,

  gallery_accept boolean not null default false,
  confirmed boolean not null default false,
  lang text not null default 'en'
);

-- Row Level Security is enabled with no policies defined, so the table has
-- zero access for the anon/public role. Only the service_role key (used
-- exclusively by /api/submit-registration, never sent to the browser) can
-- read or write it. This is intentional: the client never talks to
-- Supabase directly, only through that one serverless function.
alter table dealer_registrations enable row level security;
