-- Resume Tailor — initial schema
-- Single-user app: every table is owned by auth.users and gated by RLS so a
-- row is only visible to the user that created it (auth.uid() = user_id).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table career_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile jsonb not null,            -- roles[], skills[], education[], summary, target_roles[]
  voice_samples text[] not null default '{}', -- user's real bullets/writing, injected into tailoring
  updated_at timestamptz not null default now()
);

create table base_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,                -- e.g. "Master resume"
  sections jsonb not null,           -- contact, summary, experience[], education, skills, projects
  updated_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role_title text not null,
  job_description text not null,
  jd_extraction jsonb,               -- cached Haiku output
  status text not null default 'saved'
    check (status in ('saved','applied','interviewing','offer','rejected','accepted')),
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  base_resume_id uuid references base_resumes(id) on delete set null,
  doc_type text not null check (doc_type in ('resume','cover_letter')),
  version int not null,              -- unique per (application, doc_type)
  content jsonb not null,            -- resume sections shape, or cover-letter paragraphs[]
  score jsonb,                       -- snapshot: {total, categories, per_bullet[]}
  created_at timestamptz not null default now(),
  unique (application_id, doc_type, version)
);

create table suggestion_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references applications(id) on delete set null,
  ai_suggested text not null,
  user_final text not null,          -- what the user actually accepted after editing
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (foreign keys + common filters)
-- ---------------------------------------------------------------------------

create index career_memory_user_id_idx on career_memory (user_id);
create index base_resumes_user_id_idx on base_resumes (user_id);
create index applications_user_id_idx on applications (user_id);
create index applications_status_idx on applications (user_id, status);
create index documents_application_id_idx on documents (application_id);
create index documents_user_id_idx on documents (user_id);
create index suggestion_edits_user_id_idx on suggestion_edits (user_id);
create index suggestion_edits_recent_idx on suggestion_edits (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger career_memory_set_updated_at
  before update on career_memory
  for each row execute function set_updated_at();

create trigger base_resumes_set_updated_at
  before update on base_resumes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — single-user ownership on every table
-- ---------------------------------------------------------------------------

alter table career_memory    enable row level security;
alter table base_resumes     enable row level security;
alter table applications     enable row level security;
alter table documents        enable row level security;
alter table suggestion_edits enable row level security;

-- One policy per table covering all commands; row is the user's own.
create policy "own rows" on career_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on base_resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on suggestion_edits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
