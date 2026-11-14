-- schema.sql: full bootstrap for a new or empty Supabase database.
-- Creates current VC tables, columns, functions, triggers, and access policies.
-- No existing tables or data are dropped.

begin;
create schema if not exists vc;

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
commit;

-- Consolidated from migrations\20261112170000_superadmin_auth.sql
begin;

alter table vc.profiles
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists auth_email text unique;

alter table vc.profiles drop constraint if exists profiles_role_check;
alter table vc.profiles
  add constraint profiles_role_check check (role in ('staff', 'admin', 'superadmin'));

create unique index if not exists profiles_employee_id_case_insensitive
  on vc.profiles (lower(trim(employee_id)));

insert into vc.profiles (
  employee_id,
  full_name,
  role,
  designation,
  monthly_leave_entitlement,
  bypass_geofence,
  fine_exempt
)
values (
  'superadmin@vc',
  'Super Admin',
  'superadmin',
  'Super Administrator',
  0,
  false,
  false
)
on conflict (employee_id) do nothing;

insert into vc.profiles (
  employee_id,
  full_name,
  role,
  designation,
  monthly_leave_entitlement,
  bypass_geofence,
  fine_exempt
)
values (
  'admin@vc',
  'Admin',
  'admin',
  'Administrator',
  0,
  false,
  false
)
on conflict (employee_id) do nothing;

create or replace function vc.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from vc.profiles p
  where p.auth_user_id = (select auth.uid())
  limit 1;
$$;

create or replace function vc.current_employee_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.employee_id
  from vc.profiles p
  where p.auth_user_id = (select auth.uid())
  limit 1;
$$;

create or replace function vc.resolve_login_email(p_employee_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.auth_email
  from vc.profiles p
  where lower(p.employee_id) = lower(trim(p_employee_id))
    and p.auth_user_id is not null
  limit 1;
$$;

revoke all on function vc.current_role() from public, anon;
revoke all on function vc.current_employee_id() from public, anon;
revoke all on function vc.resolve_login_email(text) from public;
grant execute on function vc.current_role() to authenticated;
grant execute on function vc.current_employee_id() to authenticated;
grant execute on function vc.resolve_login_email(text) to anon, authenticated;

create or replace function vc.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select vc.current_role()) in ('admin', 'superadmin'), false);
$$;

create or replace function vc.touch_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.modified_by = coalesce((select vc.current_employee_id()), 'system');
  new.is_modified = true;
  return new;
end;
$$;

create or replace function vc.audit_track()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := coalesce((select vc.current_employee_id()), 'system');
begin
  if actor <> 'system' and not (select vc.is_admin()) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
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

alter table vc.location enable row level security;
alter table vc.profiles enable row level security;
alter table vc.attendance_records enable row level security;
alter table vc.salary enable row level security;
alter table vc.permission_requests enable row level security;
alter table vc.leave_requests enable row level security;
alter table vc.holidays enable row level security;
alter table vc.allowances enable row level security;
alter table vc.advances enable row level security;
alter table vc.audit_log enable row level security;

revoke all on all tables in schema vc from public, anon;
revoke all on all sequences in schema vc from public, anon;
revoke all on all routines in schema vc from public, anon, authenticated;
grant usage on schema vc to anon, authenticated;
grant select, insert, update, delete on all tables in schema vc to authenticated;
grant usage, select on all sequences in schema vc to authenticated;
grant execute on function vc.current_role() to authenticated;
grant execute on function vc.current_employee_id() to authenticated;
grant execute on function vc.resolve_login_email(text) to anon, authenticated;
grant execute on function vc.is_admin() to authenticated;
grant execute on function vc.touch_audit() to authenticated;
grant execute on function vc.audit_track() to authenticated;

drop policy if exists profiles_read on vc.profiles;
create policy profiles_read on vc.profiles
  for select to authenticated
  using (
    (select vc.current_role()) in ('admin', 'superadmin')
    or auth_user_id = (select auth.uid())
  );
drop policy if exists profiles_superadmin_write on vc.profiles;
create policy profiles_superadmin_write on vc.profiles
  for all to authenticated
  using ((select vc.current_role()) = 'superadmin')
  with check ((select vc.current_role()) = 'superadmin');

drop policy if exists location_read on vc.location;
create policy location_read on vc.location
  for select to authenticated using (true);
drop policy if exists location_superadmin_write on vc.location;
create policy location_superadmin_write on vc.location
  for all to authenticated
  using ((select vc.current_role()) = 'superadmin')
  with check ((select vc.current_role()) = 'superadmin');

drop policy if exists attendance_read on vc.attendance_records;
create policy attendance_read on vc.attendance_records
  for select to authenticated
  using (
    (select vc.current_role()) in ('admin', 'superadmin')
    or employee_id = (select vc.current_employee_id())
  );
drop policy if exists attendance_staff_insert on vc.attendance_records;
create policy attendance_staff_insert on vc.attendance_records
  for insert to authenticated
  with check (
    (select vc.current_role()) = 'superadmin'
    or (
      (select vc.current_role()) = 'staff'
      and employee_id = (select vc.current_employee_id())
    )
  );
drop policy if exists attendance_staff_update on vc.attendance_records;
create policy attendance_staff_update on vc.attendance_records
  for update to authenticated
  using (
    (select vc.current_role()) = 'superadmin'
    or (
      (select vc.current_role()) = 'staff'
      and employee_id = (select vc.current_employee_id())
    )
  )
  with check (
    (select vc.current_role()) = 'superadmin'
    or (
      (select vc.current_role()) = 'staff'
      and employee_id = (select vc.current_employee_id())
    )
  );
drop policy if exists attendance_superadmin_delete on vc.attendance_records;
create policy attendance_superadmin_delete on vc.attendance_records
  for delete to authenticated
  using ((select vc.current_role()) = 'superadmin');

drop policy if exists salary_read on vc.salary;
create policy salary_read on vc.salary
  for select to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'));
drop policy if exists salary_superadmin_write on vc.salary;
create policy salary_superadmin_write on vc.salary
  for all to authenticated
  using ((select vc.current_role()) = 'superadmin')
  with check ((select vc.current_role()) = 'superadmin');

drop policy if exists permissions_read on vc.permission_requests;
create policy permissions_read on vc.permission_requests
  for select to authenticated
  using (
    (select vc.current_role()) in ('admin', 'superadmin')
    or employee_id = (select vc.current_employee_id())
  );
drop policy if exists permissions_staff_insert on vc.permission_requests;
create policy permissions_staff_insert on vc.permission_requests
  for insert to authenticated
  with check (
    (select vc.current_role()) = 'superadmin'
    or (
      (select vc.current_role()) = 'staff'
      and employee_id = (select vc.current_employee_id())
    )
  );
drop policy if exists permissions_superadmin_write on vc.permission_requests;
create policy permissions_superadmin_write on vc.permission_requests
  for update to authenticated
  using ((select vc.current_role()) = 'superadmin')
  with check ((select vc.current_role()) = 'superadmin');
drop policy if exists permissions_superadmin_delete on vc.permission_requests;
create policy permissions_superadmin_delete on vc.permission_requests
  for delete to authenticated
  using ((select vc.current_role()) = 'superadmin');

drop policy if exists leaves_read on vc.leave_requests;
create policy leaves_read on vc.leave_requests
  for select to authenticated
  using (
    (select vc.current_role()) in ('admin', 'superadmin')
    or employee_id = (select vc.current_employee_id())
  );
drop policy if exists leaves_staff_insert on vc.leave_requests;
create policy leaves_staff_insert on vc.leave_requests
  for insert to authenticated
  with check (
    (select vc.current_role()) = 'superadmin'
    or (
      (select vc.current_role()) = 'staff'
      and employee_id = (select vc.current_employee_id())
    )
  );
drop policy if exists leaves_superadmin_write on vc.leave_requests;
create policy leaves_superadmin_write on vc.leave_requests
  for update to authenticated
  using ((select vc.current_role()) = 'superadmin')
  with check ((select vc.current_role()) = 'superadmin');
drop policy if exists leaves_superadmin_delete on vc.leave_requests;
create policy leaves_superadmin_delete on vc.leave_requests
  for delete to authenticated
  using ((select vc.current_role()) = 'superadmin');

drop policy if exists holidays_read on vc.holidays;
create policy holidays_read on vc.holidays
  for select to authenticated using (true);
drop policy if exists holidays_superadmin_write on vc.holidays;
create policy holidays_superadmin_write on vc.holidays
  for all to authenticated
  using ((select vc.current_role()) = 'superadmin')
  with check ((select vc.current_role()) = 'superadmin');

drop policy if exists allowances_read on vc.allowances;
create policy allowances_read on vc.allowances
  for select to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'));
drop policy if exists allowances_superadmin_write on vc.allowances;
create policy allowances_superadmin_write on vc.allowances
  for all to authenticated
  using ((select vc.current_role()) = 'superadmin')
  with check ((select vc.current_role()) = 'superadmin');

drop policy if exists advances_read on vc.advances;
create policy advances_read on vc.advances
  for select to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'));
drop policy if exists advances_superadmin_write on vc.advances;
create policy advances_superadmin_write on vc.advances
  for all to authenticated
  using ((select vc.current_role()) = 'superadmin')
  with check ((select vc.current_role()) = 'superadmin');

drop policy if exists audit_log_read on vc.audit_log;
create policy audit_log_read on vc.audit_log
  for select to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'));
drop policy if exists audit_log_superadmin_write on vc.audit_log;
create policy audit_log_superadmin_write on vc.audit_log
  for all to authenticated
  using ((select vc.current_role()) = 'superadmin')
  with check ((select vc.current_role()) = 'superadmin');

notify pgrst, 'reload schema';

commit;


-- Consolidated from migrations\20261112194700_admin_access_scope.sql
begin;

drop policy if exists salary_read on vc.salary;
create policy salary_read on vc.salary
  for select to authenticated
  using ((select vc.current_role()) = 'superadmin');

drop policy if exists allowances_read on vc.allowances;
create policy allowances_read on vc.allowances
  for select to authenticated
  using ((select vc.current_role()) = 'superadmin');

drop policy if exists advances_read on vc.advances;
create policy advances_read on vc.advances
  for select to authenticated
  using ((select vc.current_role()) = 'superadmin');

drop policy if exists audit_log_read on vc.audit_log;
create policy audit_log_read on vc.audit_log
  for select to authenticated
  using ((select vc.current_role()) = 'superadmin');

drop policy if exists permissions_read on vc.permission_requests;
create policy permissions_read on vc.permission_requests
  for select to authenticated
  using (
    (select vc.current_role()) = 'superadmin'
    or employee_id = (select vc.current_employee_id())
  );

drop policy if exists leaves_read on vc.leave_requests;
create policy leaves_read on vc.leave_requests
  for select to authenticated
  using (
    (select vc.current_role()) = 'superadmin'
    or employee_id = (select vc.current_employee_id())
  );

create or replace function vc.approved_attendance_exemptions()
returns table(employee_id text, attendance_date date, exemption_type text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.employee_id,
    l.attendance_date,
    case when l.type = 'comp' then 'comp_leave'::text else 'leave'::text end
  from vc.leave_requests l
  where l.status = 'approved'
    and (
      (select vc.current_role()) in ('admin', 'superadmin')
      or l.employee_id = (select vc.current_employee_id())
    )
  union all
  select p.employee_id, p.attendance_date, 'permission'::text
  from vc.permission_requests p
  where p.status = 'approved'
    and (
      (select vc.current_role()) in ('admin', 'superadmin')
      or p.employee_id = (select vc.current_employee_id())
    );
$$;

revoke all on function vc.approved_attendance_exemptions() from public, anon;
grant execute on function vc.approved_attendance_exemptions() to authenticated;

notify pgrst, 'reload schema';

commit;


-- Consolidated from migrations\20261112194800_manual_attendance_and_pay_period.sql
alter table vc.attendance_records
  add column if not exists manual_override boolean not null default false,
  add column if not exists manual_override_reason text;

create or replace function vc.enforce_manual_attendance_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.manual_override and (select vc.current_role()) is distinct from 'superadmin' then
    raise exception 'Only the Superadmin can create manual attendance overrides'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.manual_override
    and (select vc.current_role()) is distinct from 'superadmin' then
    raise exception 'Only the Superadmin can modify manual attendance overrides'
      using errcode = '42501';
  end if;

  if new.manual_override then
    if new.check_in_status is distinct from 'present'
      or nullif(btrim(new.manual_override_reason), '') is null
      or char_length(new.manual_override_reason) > 500 then
      raise exception 'Manual attendance requires Present status and a reason of 1 to 500 characters'
        using errcode = '22023';
    end if;
  else
    new.manual_override_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_manual_override_guard
  on vc.attendance_records;
create trigger attendance_manual_override_guard
  before insert or update on vc.attendance_records
  for each row execute function vc.enforce_manual_attendance_override();


-- Consolidated from migrations\20261112194900_admin_expenses_upcoming_off.sql
begin;

drop policy if exists allowances_read on vc.allowances;
create policy allowances_read on vc.allowances
  for select to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'));

drop policy if exists allowances_superadmin_write on vc.allowances;
create policy allowances_admin_write on vc.allowances
  for all to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'))
  with check ((select vc.current_role()) in ('admin', 'superadmin'));

drop policy if exists advances_read on vc.advances;
create policy advances_read on vc.advances
  for select to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'));

drop policy if exists advances_superadmin_write on vc.advances;
create policy advances_admin_write on vc.advances
  for all to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'))
  with check ((select vc.current_role()) in ('admin', 'superadmin'));

drop policy if exists leaves_read on vc.leave_requests;
create policy leaves_read on vc.leave_requests
  for select to authenticated
  using (
    (select vc.current_role()) in ('admin', 'superadmin')
    or employee_id = (select vc.current_employee_id())
  );

drop policy if exists leaves_superadmin_write on vc.leave_requests;
create policy leaves_admin_write on vc.leave_requests
  for update to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'))
  with check ((select vc.current_role()) in ('admin', 'superadmin'));

revoke update on vc.leave_requests from authenticated;
grant update (status, type, updated_at) on vc.leave_requests to authenticated;

notify pgrst, 'reload schema';

commit;


-- Consolidated from migrations\20261112195000_admin_no_coordinate_staff.sql
begin;

create or replace function vc.set_profile_bypass_geofence(
  p_employee_id text,
  p_bypass boolean
)
returns setof vc.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile vc.profiles%rowtype;
begin
  if coalesce(
    (select vc.current_role()) not in ('admin', 'superadmin'),
    true
  ) then
    raise exception 'Not authorized to change geofence exemptions.';
  end if;

  update vc.profiles p
  set bypass_geofence = p_bypass
  where p.employee_id = p_employee_id
    and p.role = 'staff'
  returning p.* into updated_profile;

  if not found then
    raise exception 'Staff member not found.';
  end if;

  return next updated_profile;
end;
$$;

revoke all on function vc.set_profile_bypass_geofence(text, boolean)
  from public, anon, authenticated;
grant execute on function vc.set_profile_bypass_geofence(text, boolean)
  to authenticated;

notify pgrst, 'reload schema';

commit;


-- Consolidated from expense_allowance_updates.sql
begin;

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

alter table vc.professional_expenses enable row level security;
grant select, insert, update, delete on vc.professional_expenses to authenticated;

drop policy if exists professional_expenses_read on vc.professional_expenses;
create policy professional_expenses_read on vc.professional_expenses
  for select to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'));

drop policy if exists professional_expenses_admin_write on vc.professional_expenses;
create policy professional_expenses_admin_write on vc.professional_expenses
  for all to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'))
  with check ((select vc.current_role()) in ('admin', 'superadmin'));

drop trigger if exists professional_expenses_audit_touch on vc.professional_expenses;
create trigger professional_expenses_audit_touch
  before update on vc.professional_expenses
  for each row execute function vc.touch_audit();

alter table vc.allowances
  add column if not exists organization text,
  add column if not exists allowance_date date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'allowances_organization_check'
      and conrelid = 'vc.allowances'::regclass
  ) then
    alter table vc.allowances
      add constraint allowances_organization_check
      check (organization in ('VC', 'VCD'));
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'vc'
      and table_name = 'allowances'
      and column_name = 'note'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'vc'
      and table_name = 'allowances'
      and column_name = 'particulars'
  ) then
    alter table vc.allowances rename column note to particulars;
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'vc'
      and table_name = 'allowances'
      and column_name = 'particulars'
  ) then
    alter table vc.allowances add column particulars text;
  end if;
end;
$$;

update vc.allowances
set allowance_date = to_date(month || '-01', 'YYYY-MM-DD')
where allowance_date is null;

update vc.allowances
set particulars = 'Allowance'
where particulars is null or btrim(particulars) = '';

alter table vc.allowances
  alter column allowance_date set default current_date,
  alter column allowance_date set not null,
  alter column particulars set not null;

grant select, insert, update, delete on vc.allowances to authenticated;

drop policy if exists allowances_read on vc.allowances;
create policy allowances_read on vc.allowances
  for select to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'));

drop policy if exists allowances_superadmin_write on vc.allowances;
drop policy if exists allowances_admin_write on vc.allowances;
create policy allowances_admin_write on vc.allowances
  for all to authenticated
  using ((select vc.current_role()) in ('admin', 'superadmin'))
  with check ((select vc.current_role()) in ('admin', 'superadmin'));

notify pgrst, 'reload schema';

commit;


