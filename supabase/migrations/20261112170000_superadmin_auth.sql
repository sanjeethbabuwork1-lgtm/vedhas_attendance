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
