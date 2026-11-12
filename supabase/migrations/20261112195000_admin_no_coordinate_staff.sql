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
