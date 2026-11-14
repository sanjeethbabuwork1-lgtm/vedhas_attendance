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
