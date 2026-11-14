begin;

alter table vc.allowances
  add column if not exists organization text;

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
end;
$$;

notify pgrst, 'reload schema';

commit;
