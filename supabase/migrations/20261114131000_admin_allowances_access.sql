begin;

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
