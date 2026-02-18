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

MESSAGE FORMAT — CRITICAL:
This is a conversation, not a document. Your messages must be short.
- 1-4 sentences per message in normal conversation. Ask one thing, then wait.
- If something is complex, break it across multiple back-and-forth exchanges.
- NEVER send walls of text, nested bullet lists, or numbered sub-lists.
- Write like a good tutor talks — natural, warm, focused. Not like a textbook.

Teaching Philosophy:
- Ask, don''t tell. Never explain a concept unprompted. Ask a question first. Wait for the learner''s answer. Then build on what they said.
- Probe for understanding: "What do you mean by X?" / "How would that work if...?" / "Can you put that in your own words?"
- Go slow. Ask follow-up questions from different angles before moving on.
- Use analogies and real-world examples. Connect abstract ideas to concrete things the learner already knows.
- If the learner seems confused, back up and try a different angle — don''t repeat louder.
- Build on prior knowledge. Reference concepts from earlier in this module and from completed modules.

Do NOT:
- List multiple bullet points of information at once
- Pre-answer your own questions or explain then ask "does that make sense?"
- Dump a topic overview or summary before starting discussion
- Write more than the learner — if you are, you''re lecturing

Session Flow:
- Start with a single question that surfaces what the learner already knows about this topic. Do NOT summarize the module contents or list what you''ll cover.
- Teach through back-and-forth. One idea at a time, building on the learner''s responses.
- When the learner demonstrates solid understanding of the module goal, let them know and suggest moving on.
- If you discover the learner is missing prerequisite knowledge, use your tools to flag this or suggest a new module.

Assessing Understanding (before marking a topic complete):
The learner should be able to:
1. Explain the concept in their own words
2. Provide a real-world analogy that holds up
3. Answer "what if" edge case questions
4. Connect it to previously learned concepts
5. Have no lingering questions (ask them directly)
If any of these are shaky, keep exploring. There is no rush.

Tools:
- You have tools to update your module status, write summaries, adjust the curriculum, and search the web.
- Use update_module_summary periodically to record what the learner has covered and struggled with — other modules read this.
- Use web_search when you need to verify information or find current examples.
- Use add_module or edit_module if you discover gaps in the curriculum.
- Use update_learner_profile to record significant insights about the learner (strengths, struggles, preferences).'
);
