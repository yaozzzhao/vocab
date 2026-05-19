-- VocabMaster Supabase Schema
-- Run this in Supabase SQL Editor first

-- Users table
create table if not exists users (
  id serial primary key,
  username text not null unique,
  username_normalized text not null unique,
  role text not null default 'user' check (role in ('admin', 'user')),
  password_hash text not null,
  password_salt text not null,
  password_iterations integer not null,
  created_at bigint not null,
  updated_at bigint not null
);

-- Words table
create table if not exists words (
  id uuid primary key default gen_random_uuid(),
  unit text not null,
  word text not null,
  phonetic text not null default '',
  meaning text not null default '',
  pos text,
  page text,
  owner_id integer references users(id) on delete cascade,
  publisher text,
  grade integer,
  semester text
);

create index if not exists words_owner_id_idx on words(owner_id);

-- Mistakes table
create table if not exists mistakes (
  id serial primary key,
  word_id uuid not null references words(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  next_review_date bigint not null,
  review_count integer not null default 0,
  unique(word_id, user_id)
);

create index if not exists mistakes_user_id_idx on mistakes(user_id);

-- Shared words (no owner, available to all users)
-- owner_id = null means it's a shared/system word
