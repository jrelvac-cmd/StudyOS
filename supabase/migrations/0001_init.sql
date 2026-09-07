-- StudyOS — schéma initial. À exécuter dans l'éditeur SQL de Supabase.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- Matières -----------------------------------------------------------------

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Titre d'événement Google (normalisé) -> matière. Mémorisé une fois pour toutes.
create table subject_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique,
  subject_id uuid not null references subjects(id) on delete cascade
);

-- Google Calendar ------------------------------------------------------------

create table google_tokens (
  id int primary key default 1 check (id = 1),
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz not null,
  email text,
  calendar_id text not null default 'primary',
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  google_id text unique,
  source text not null check (source in ('google', 'manual')),
  title text not null,
  subject_id uuid references subjects(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_events_starts_idx on calendar_events (starts_at);

-- Chapitres et cours ---------------------------------------------------------

create table chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  title text not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'to_verify')),
  created_at timestamptz not null default now(),
  unique (subject_id, title)
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects(id) on delete set null,
  calendar_event_id uuid references calendar_events(id) on delete set null,
  title text not null default '',
  course_date date not null,
  content_html text not null default '',
  content_text text not null default '',
  docx_path text,
  docx_name text,
  -- draft : en cours de saisie ; analyzing : pipeline IA en cours ; ready ; error
  status text not null default 'draft' check (status in ('draft', 'analyzing', 'ready', 'error')),
  -- pending : pas encore classé ; to_verify : proposé par l'IA sans certitude ;
  -- confirmed : sûr ou validé par Julien ; annex : cours annexe hors chapitre
  classification_status text not null default 'pending'
    check (classification_status in ('pending', 'to_verify', 'confirmed', 'annex')),
  ai_summary text,
  ai_error text,
  tsv tsvector generated always as (to_tsvector('french', coalesce(title, '') || ' ' || coalesce(content_text, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_date_idx on courses (course_date desc);
create index courses_subject_idx on courses (subject_id);
create index courses_tsv_idx on courses using gin (tsv);

-- Un cours peut couvrir plusieurs chapitres (un nouveau chapitre commence en cours de séance).
create table course_chapters (
  course_id uuid not null references courses(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  position int not null default 0,
  primary key (course_id, chapter_id)
);
create index course_chapters_chapter_idx on course_chapters (chapter_id);

-- Passages indexés pour l'agent (embeddings Voyage 1024 dims + plein texte).
create table course_chunks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  position int not null,
  content text not null,
  embedding vector(1024),
  tsv tsvector generated always as (to_tsvector('french', content)) stored
);
create index course_chunks_course_idx on course_chunks (course_id);
create index course_chunks_tsv_idx on course_chunks using gin (tsv);
create index course_chunks_embedding_idx on course_chunks using hnsw (embedding vector_cosine_ops);

-- Fiches de révision ---------------------------------------------------------

create table revision_sheets (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  format text not null check (format in ('condense', 'complet')),
  title text not null,
  content_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index revision_sheets_chapter_idx on revision_sheets (chapter_id);

-- Fonctions de recherche -----------------------------------------------------

create or replace function match_chunks(query_embedding vector(1024), match_count int default 8, min_similarity float default 0.15)
returns table (chunk_id uuid, course_id uuid, content text, score float)
language sql stable as $$
  select c.id, c.course_id, c.content, 1 - (c.embedding <=> query_embedding) as score
  from course_chunks c
  where c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function search_chunks_fts(query text, match_count int default 8)
returns table (chunk_id uuid, course_id uuid, content text, score float)
language sql stable as $$
  select c.id, c.course_id, c.content, ts_rank(c.tsv, websearch_to_tsquery('french', query))::float as score
  from course_chunks c
  where c.tsv @@ websearch_to_tsquery('french', query)
  order by score desc
  limit match_count;
$$;

-- Stockage des fichiers Word originaux -----------------------------------------

insert into storage.buckets (id, name, public)
values ('courses', 'courses', false)
on conflict (id) do nothing;
