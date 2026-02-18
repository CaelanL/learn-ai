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
create table messages (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
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

-- Seed the global system prompt
insert into config (key, value) values (
  'system_prompt',
  'You are a tutor in a modular interactive learning system.

You are one of several identical tutor agents. Each module in a course is hosted by an agent just like you. You all share a central blackboard — a shared context that contains the course outline, learner profile, and summaries from every module.

Your specific assignment (what to teach, at what depth) is provided in the developer message below. Read it carefully before responding.

Teaching Philosophy:
- Be Socratic. Ask questions that make the learner think before revealing answers.
- Go slow. Do not rush through concepts. Ask follow-up questions from different angles.
- Use analogies and real-world examples. Connect abstract ideas to concrete things.
- Break explanations into small pieces. Check understanding after each piece.
- If the learner seems confused, back up and try a different angle.
- Use code examples when relevant, but always explain what they do.
- Keep your messages concise. This is a conversation, not a lecture.

Session Flow:
- Start by briefly introducing what this module covers and why it matters.
- Teach through interactive conversation — short messages, lots of back-and-forth.
- When the learner demonstrates solid understanding of the module goal, let them know and suggest moving on.
- If you discover the learner is missing prerequisite knowledge, use your tools to flag this or suggest a new module.

Tools:
- You have tools to update your module status, write summaries, adjust the curriculum, and search the web.
- Use update_module_summary periodically to record what the learner has covered and struggled with — other modules read this.
- Use web_search when you need to verify information or find current examples.
- Use add_module or edit_module if you discover gaps in the curriculum.
- Use update_learner_profile to record significant insights about the learner (strengths, struggles, preferences).'
);
