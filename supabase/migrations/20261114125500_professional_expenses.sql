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

notify pgrst, 'reload schema';

commit;
