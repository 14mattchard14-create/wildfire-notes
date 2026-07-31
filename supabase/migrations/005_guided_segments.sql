-- Guided Entry redesign: per-segment progress/photos + satellite pre-flight analysis.

create table if not exists guided_segments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  segment_key text not null,
  photo_url text,
  ai_suggestions text,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (property_id, segment_key)
);

alter table properties
  add column if not exists satellite_analysis text,
  add column if not exists satellite_analyzed_at timestamptz;
