-- ============================================================
-- Vedhas Attendance — Supabase schema (single source of truth)
-- Tables: location (geofence + in-time window), profiles (staff),
--         permission_requests, leave_requests, holidays,
--         attendance_records (report), salary, allowances,
--         advances, professional_expenses, audit_log
-- All tables live in the vc schema
--
-- WARNING: DESTRUCTIVE. This file drops and recreates every table.
-- Use it ONLY for a brand-new setup or a full rebuild. For an
-- existing database, apply only the statements you need
-- (e.g. geofence_accuracy column, allowances/advances tables).

--mail:sanjeethbabuwork1@gmail.com
-- ============================================================

create schema if not exists vc;

-- ======================================a======================
-- DROP ALL TABLES (recreate everything as new)
-- Dependencies (FKs, triggers) are dropped with cascade.
-- ============================================================
drop table if exists vc.attendance_records cascade;
drop table if exists vc.permission_requests cascade;
drop table if exists vc.leave_requests cascade;
drop table if exists vc.holidays cascade;
drop table if exists vc.allowances cascade;
drop table if exists vc.advances cascade;
drop table if exists vc.professional_expenses cascade;
drop table if exists vc.profiles cascade;
drop table if exists vc.salary cascade;
drop table if exists vc.location cascade;
drop table if exists vc.audit_log cascade;

-- ---------- AUDIT LOG (only admin changes are tracked) ----------
create table if not exists vc.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('insert','update','delete')),
  field_name text,
  old_value text,
  new_value text,
  changed_by text,
  created_at timestamptz not null default now()
);

-- ---------- LOCATION (geofence + in-time window config) ----------
-- attendance_from / attendance_to = start & end of the in-time window.
-- Check-in after attendance_to is marked late.
-- geofence_radius = max distance (m) from the org coordinates; beyond it
-- check-in is rejected.
-- geofence_accuracy = GPS accuracy (m) of the device that set the
-- coordinates. It is added to the radius at check-in time so the geofence
-- stays accurate when coordinates are set from a laptop vs checked in from
-- a phone (and vice versa).
create table if not exists vc.location (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  geofence_radius integer not null default 50,
  geofence_accuracy integer not null default 0,
  attendance_from text not null default '09:45',
  attendance_to text not null default '10:00',
  late_fine numeric(12,2) not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modified_by text,
  is_modified boolean not null default false
);

-- ---------- PROFILES (staff details, keyed by employee_id) ----------
-- bypass_geofence : true = remote/outstation staff who can check in/out
--                   from anywhere; their GPS is still recorded & monitored.
-- fine_exempt     : true = staff exempt from the late fine.
create table if not exists vc.profiles (
  employee_id text primary key,
  full_name text not null,
  role text not null check (role in ('staff','admin')),
  designation text,
  monthly_leave_entitlement integer not null default 0,
  bypass_geofence boolean not null default false,
  fine_exempt boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modified_by text,
  is_modified boolean not null default false
);

-- ---------- PERMISSION_REQUESTS (staff late permission, approved by admin) ----------
create table if not exists vc.permission_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id text references vc.profiles(employee_id) on delete cascade,
  attendance_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  modified_by text,
  is_modified boolean not null default false,
  unique (employee_id, attendance_date)
);

-- ---------- LEAVE_REQUESTS (admin-approved/assigned leave on specific dates) ----------
-- Leave requests: staff request leave; admin approves it as either PTO
-- (paid time off - no deduction) or LOP (loss of pay - deducted).
-- type: casual = staff request, admin decides pto/lop on approval.
--       pto = paid time off, lop = loss of pay, comp = compensatory off,
--       sick = sick leave. Paid types = pto, comp, sick. lop is deducted.
create table if not exists vc.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id text references vc.profiles(employee_id) on delete cascade,
  attendance_date date not null,
  reason text,
  type text not null default 'pto' check (type in ('casual','pto','lop','comp','sick')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modified_by text,
  is_modified boolean not null default false,
  unique (employee_id, attendance_date)
);

-- ---------- HOLIDAYS (company off-days given by the admin) ----------
-- On these days staff see "You are off today" and can request a comp off.
-- Holidays are not counted as working/absent days in payroll.
create table if not exists vc.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modified_by text,
  is_modified boolean not null default false
);

-- ---------- ATTENDANCE_RECORDS (report: check-in + check-out) ----------
-- fined             : true when marked late without an accepted permission
-- permission        : reference to the day's permission request (if any)
-- permission_status : 'accepted' when admin approved, else 'not_accepted'
-- fine_amount       : fine in rupees (₹50 per late day)
create table if not exists vc.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id text references vc.profiles(employee_id) on delete cascade,
  attendance_date date not null,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_latitude double precision,
  check_in_longitude double precision,
  check_in_accuracy double precision,
  check_in_distance double precision,
  check_out_latitude double precision,
  check_out_longitude double precision,
  check_out_accuracy double precision,
  check_out_distance double precision,
  check_in_face_detected boolean not null default false,
  check_out_face_detected boolean not null default false,
  check_in_status text check (check_in_status in ('present','late','absent','rejected')),
  check_out_status text check (check_out_status in ('verified','rejected')),
  fined boolean not null default false,
  permission uuid references vc.permission_requests(id) on delete set null,
  permission_status text check (permission_status in ('accepted','not_accepted')),
  fine_amount numeric(12,2),
  manual_override boolean not null default false,
  manual_override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modified_by text,
  is_modified boolean not null default false,
  unique (employee_id, attendance_date)
);

-- ---------- SALARY (per-staff pay for payslips) ----------
create table if not exists vc.salary (
  id uuid primary key default gen_random_uuid(),
  employee_id text references vc.profiles(employee_id) on delete cascade,
  employee_name text not null,
  salary numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modified_by text,
  is_modified boolean not null default false,
  unique (employee_id)
);

-- ---------- ALLOWANCES (add-on to salary, never deducted) ----------
-- A fixed monthly allowance given per staff member. It is added to the
-- monthly pay (e.g. travel / phone / special allowance) and is not
-- subtracted from salary.
create table if not exists vc.allowances (
  id uuid primary key default gen_random_uuid(),
  employee_id text references vc.profiles(employee_id) on delete cascade,
  month text not null, -- 'YYYY-MM' the month the allowance applies to
  organization text check (organization in ('VC', 'VCD')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modified_by text,
  is_modified boolean not null default false,
  unique (employee_id, month)
);

-- ---------- ADVANCES (money given to staff ahead of pay, deducted) ----------
-- Each row is one advance given to a staff member on a specific date.
-- All advances given within a month are summed and deducted from that
-- month's net pay in the Salary to Pay screen.
create table if not exists vc.advances (
  id uuid primary key default gen_random_uuid(),
  employee_id text references vc.profiles(employee_id) on delete cascade,
  advance_date date not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modified_by text,
  is_modified boolean not null default false
);

-- ---------- PROFESSIONAL EXPENSES ----------
create table if not exists vc.professional_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  organization text not null check (organization in ('VC', 'VCD')),
  person text not null check (length(trim(person)) between 1 and 150),
  particulars text not null check (length(trim(particulars)) between 1 and 500),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modified_by text,
  is_modified boolean not null default false
);

-- ============================================================
-- AUDIT TRIGGERS — log only changes made by an admin
-- ============================================================

-- Returns true when the acting user is an admin
create or replace function vc.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from vc.profiles p
    where p.employee_id = coalesce(auth.jwt() ->> 'employee_id', '')
      and p.role = 'admin'
  );
$$;

create or replace function vc.audit_track()
returns trigger
language plpgsql
as $$
declare
  actor text := coalesce(auth.jwt() ->> 'employee_id', 'system');
begin
  -- Only admin-driven changes are recorded
  if actor <> 'system' and not vc.is_admin() then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    insert into vc.audit_log (table_name, record_id, action, changed_by)
    values (tg_table_name, new.employee_id::text, 'insert', actor);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into vc.audit_log (table_name, record_id, action, field_name, old_value, new_value, changed_by)
    select tg_table_name, new.employee_id::text, 'update', key, old_val, new_val, actor
    from jsonb_each_text(to_jsonb(old) - 'updated_at' - 'modified_by' - 'is_modified') as o(key, old_val)
    join jsonb_each_text(to_jsonb(new) - 'updated_at' - 'modified_by' - 'is_modified') as n(key, new_val) using (key)
    where old_val is distinct from new_val;
    return new;
  elsif tg_op = 'DELETE' then
    insert into vc.audit_log (table_name, record_id, action, old_value, changed_by)
    values (tg_table_name, old.employee_id::text, 'delete', to_jsonb(old)::text, actor);
    return old;
  end if;
  return null;
end;
$$;

-- Updated-at + modified flags
create or replace function vc.touch_audit()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.modified_by = coalesce(auth.jwt() ->> 'employee_id', 'system');
  new.is_modified = true;
  return new;
end;
$$;

create trigger location_audit_touch
  before update on vc.location
  for each row execute function vc.touch_audit();
create trigger profiles_audit_touch
  before update on vc.profiles
  for each row execute function vc.touch_audit();
create trigger attendance_audit_touch
  before update on vc.attendance_records
  for each row execute function vc.touch_audit();
create trigger salary_audit_touch
  before update on vc.salary
  for each row execute function vc.touch_audit();
create trigger permission_audit_touch
  before update on vc.permission_requests
  for each row execute function vc.touch_audit();
create trigger leave_audit_touch
  before update on vc.leave_requests
  for each row execute function vc.touch_audit();
create trigger allowances_audit_touch
  before update on vc.allowances
  for each row execute function vc.touch_audit();
create trigger advances_audit_touch
  before update on vc.advances
  for each row execute function vc.touch_audit();
create trigger professional_expenses_audit_touch
  before update on vc.professional_expenses
  for each row execute function vc.touch_audit();

create trigger profiles_audit_log
  after insert or update or delete on vc.profiles
  for each row execute function vc.audit_track();
create trigger attendance_audit_log
  after insert or update or delete on vc.attendance_records
  for each row execute function vc.audit_track();
create trigger salary_audit_log
  after insert or update or delete on vc.salary
  for each row execute function vc.audit_track();

-- Lock down the base schema until the auth migration adds policies.
-- Do not expose application tables directly to the anon key.
alter table vc.location enable row level security;
alter table vc.profiles enable row level security;
alter table vc.attendance_records enable row level security;
alter table vc.salary enable row level security;
alter table vc.permission_requests enable row level security;
alter table vc.leave_requests enable row level security;
alter table vc.holidays enable row level security;
alter table vc.allowances enable row level security;
alter table vc.advances enable row level security;
alter table vc.professional_expenses enable row level security;
alter table vc.audit_log enable row level security;

revoke all on all tables in schema vc from public, anon, authenticated;
revoke all on all sequences in schema vc from public, anon, authenticated;
revoke all on all routines in schema vc from public, anon, authenticated;
grant usage on schema vc to anon, authenticated, service_role;
grant all privileges on all tables in schema vc to service_role;
grant all privileges on all sequences in schema vc to service_role;
grant all privileges on all routines in schema vc to service_role;

-- ---------- DEFAULT ADMIN (admin@vc) ----------
insert into vc.profiles (employee_id, full_name, role, designation)
values ('admin@vc', 'Admin', 'admin', 'Administrator');