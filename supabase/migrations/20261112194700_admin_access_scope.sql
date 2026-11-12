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
