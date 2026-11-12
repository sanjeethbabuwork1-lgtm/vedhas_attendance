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
