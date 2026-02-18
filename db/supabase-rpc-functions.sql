-- Atomic RPC functions for concurrent-safe operations.
-- Run this in the Supabase SQL Editor.

-- Atomic append for module material.
-- Prevents lost-update when two orchestrators (different modules) both
-- call add_content_to_module targeting the same module, or when
-- Promise.all executes multiple appends in the same tool-calling round.
create or replace function append_module_material(
  p_module_id uuid,
  p_content text
) returns void as $$
begin
  update modules
  set material = case
    when material is null or material = '' then p_content
    else material || E'\n\n' || p_content
  end
  where id = p_module_id;
end;
$$ language plpgsql;

-- Atomic JSONB merge for learner profile.
-- Prevents lost-update when two modules in the same course both call
-- update_learner_profile simultaneously.
create or replace function merge_learner_profile(
  p_course_id uuid,
  p_updates jsonb
) returns void as $$
begin
  update courses
  set learner_profile = coalesce(learner_profile, '{}'::jsonb) || p_updates
  where id = p_course_id;
end;
$$ language plpgsql;
