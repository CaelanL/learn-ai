-- Learning AI — Database Schema
-- Run this in the Supabase SQL Editor

-- Config table for global settings (system prompt, etc.)
create table config (
  id serial primary key,
  key text unique not null,
  value text not null,
  updated_at timestamptz default now()
);

-- Users table (simple for now, no auth)
create table users (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  created_at timestamptz default now()
);

-- Courses table
create table courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  topic text not null,
  end_goal text,
  status text not null default 'scoping' check (status in ('scoping', 'active', 'completed')),
  learner_profile jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Modules table (the blackboard rows)
create table modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  position int not null,
  title text not null,
  goal text,
  material text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  summary text,
  is_course_setup boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages table
-- Stores text messages, tool calls, and tool results in a single timeline.
-- type: 'text' (user/assistant messages), 'tool_call' (model invoked a tool),
--       'tool_result' (our code returned a result)
-- metadata: JSONB for structured tool data (call_id, name, arguments)
create table messages (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'tool')),
  type text not null default 'text' check (type in ('text', 'tool_call', 'tool_result')),
  content text,
  metadata jsonb,
  is_summary boolean default false,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index idx_courses_user_id on courses(user_id);
create index idx_modules_course_id on modules(course_id);
create index idx_modules_course_position on modules(course_id, position);
create index idx_messages_module_id on messages(module_id);
create index idx_messages_module_created on messages(module_id, created_at);

-- Auto-update updated_at on courses
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger courses_updated_at
  before update on courses
  for each row execute function update_updated_at();

create trigger modules_updated_at
  before update on modules
  for each row execute function update_updated_at();

-- DEPRECATED: System prompt previously lived here in the config table.
-- It is now built from role-specific pieces in src/lib/prompts.ts.
-- See .claude/brainstorming/agent-context-overhaul.md for why.
