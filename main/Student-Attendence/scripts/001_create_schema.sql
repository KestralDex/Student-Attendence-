-- QR-based Smart Attendance Management System Schema
-- Run this script in Supabase SQL Editor

-- Teachers table (linked to Supabase Auth users)
create table if not exists teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  department text,
  created_at timestamptz default now()
);

-- Students table
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  roll_no text unique not null,
  email text,
  year text check (year in ('FE','SE','TE','BE')) not null,
  qr_code text unique not null,
  created_at timestamptz default now()
);

-- Subjects table
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year text check (year in ('FE','SE','TE','BE')) not null,
  teacher_id uuid references teachers(id) on delete cascade,
  created_at timestamptz default now()
);

-- Attendance records table
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  status text check (status in ('present','absent')) default 'absent',
  session_date date not null default current_date,
  scanned_at timestamptz,
  exported boolean default false,
  created_at timestamptz default now(),
  unique(student_id, subject_id, session_date)
);

-- Enable Row Level Security
alter table teachers enable row level security;
alter table students enable row level security;
alter table subjects enable row level security;
alter table attendance_records enable row level security;

-- Teachers policies
create policy "teachers_select_own" on teachers for select using (auth.uid() = id);
create policy "teachers_insert_own" on teachers for insert with check (auth.uid() = id);
create policy "teachers_update_own" on teachers for update using (auth.uid() = id);

-- Students policies (teachers can view all students)
create policy "students_select_all" on students for select using (true);
create policy "students_insert_auth" on students for insert with check (auth.uid() is not null);
create policy "students_update_auth" on students for update using (auth.uid() is not null);
create policy "students_delete_auth" on students for delete using (auth.uid() is not null);

-- Subjects policies (teachers can only see/modify their own subjects)
create policy "subjects_select_own" on subjects for select using (auth.uid() = teacher_id);
create policy "subjects_insert_own" on subjects for insert with check (auth.uid() = teacher_id);
create policy "subjects_update_own" on subjects for update using (auth.uid() = teacher_id);
create policy "subjects_delete_own" on subjects for delete using (auth.uid() = teacher_id);

-- Attendance policies (tied to teacher's subjects)
create policy "attendance_select" on attendance_records for select 
  using (exists (select 1 from subjects where subjects.id = attendance_records.subject_id and subjects.teacher_id = auth.uid()));
create policy "attendance_insert" on attendance_records for insert 
  with check (exists (select 1 from subjects where subjects.id = attendance_records.subject_id and subjects.teacher_id = auth.uid()));
create policy "attendance_update" on attendance_records for update 
  using (exists (select 1 from subjects where subjects.id = attendance_records.subject_id and subjects.teacher_id = auth.uid()));
create policy "attendance_delete" on attendance_records for delete 
  using (exists (select 1 from subjects where subjects.id = attendance_records.subject_id and subjects.teacher_id = auth.uid()));

-- Trigger to auto-create teacher profile on signup
create or replace function public.handle_new_teacher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.teachers (id, name, email, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'department', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_teacher();
