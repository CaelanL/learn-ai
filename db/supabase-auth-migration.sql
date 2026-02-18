-- Migration: Switch from custom users table to Supabase auth
-- Run this in the Supabase SQL Editor

-- Drop the custom users table and update courses to use auth.users
alter table courses drop constraint if exists courses_user_id_fkey;
drop index if exists idx_courses_user_id;
drop table if exists users;

-- Re-add foreign key pointing to Supabase auth users
alter table courses
  add constraint courses_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create index idx_courses_user_id on courses(user_id);
