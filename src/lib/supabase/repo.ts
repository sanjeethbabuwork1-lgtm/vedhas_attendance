import type {
  Advance,
  Allowance,
  AttendanceExemption,
  AttendanceRecord,
  Holiday,
  LeaveRequest,
  Organization,
  PermissionRequest,
  Profile,
  Salary,
  Session,
} from "@/types";
import { createBrowserClient } from "./client";
import { todayKey } from "@/lib/format";

const ORGANIZATION_TABLE = "location";
const PROFILES_TABLE = "profiles";
const ATTENDANCE_TABLE = "attendance_records";
const SALARY_TABLE = "salary";
const PERMISSIONS_TABLE = "permission_requests";
const LEAVES_TABLE = "leave_requests";
const HOLIDAYS_TABLE = "holidays";
const ALLOWANCES_TABLE = "allowances";
const ADVANCES_TABLE = "advances";

function client() {
  const c = createBrowserClient();
  if (!c) throw new Error("Supabase is not configured.");
  return c;
}

export async function fetchOrganization(): Promise<Organization | null> {
  const { data, error } = await client()
    .from(ORGANIZATION_TABLE)
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Organization) ?? null;
}

export async function saveOrganization(
  patch: Partial<Organization>
): Promise<Organization> {
  const existing = await fetchOrganization();
  const now = new Date().toISOString();
  const { data, error } = await client()
    .from(ORGANIZATION_TABLE)
    .upsert(
      {
        ...existing,
        ...patch,
        updated_at: now,
        created_at: existing?.created_at ?? now,
        is_modified: true,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Organization;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await client()
    .from(PROFILES_TABLE)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Profile[]) ?? [];
}

export async function fetchStaffProfiles(): Promise<Profile[]> {
  const all = await fetchProfiles();
  return all.filter((p) => p.role === "staff");
}

export async function fetchProfileByEmployeeId(
  employeeId: string
): Promise<Profile | null> {
  const { data, error } = await client()
    .from(PROFILES_TABLE)
    .select("*")
    .ilike("employee_id", employeeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}

export async function fetchProfileByAuthUserId(
  authUserId: string
): Promise<Profile | null> {
  const { data, error } = await client()
    .from(PROFILES_TABLE)
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}

export async function updateProfileLeaveEntitlement(
  employeeId: string,
  entitlement: number
): Promise<Profile> {
  const { data, error } = await client()
    .from(PROFILES_TABLE)
    .update({ monthly_leave_entitlement: entitlement })
    .eq("employee_id", employeeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function updateProfileBypassGeofence(
  employeeId: string,
  bypass: boolean
): Promise<Profile> {
  const { data, error } = await client()
    .rpc("set_profile_bypass_geofence", {
      p_employee_id: employeeId,
      p_bypass: bypass,
    })
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function updateProfileFineExempt(
  employeeId: string,
  exempt: boolean
): Promise<Profile> {
  const { data, error } = await client()
    .from(PROFILES_TABLE)
    .update({ fine_exempt: exempt })
    .eq("employee_id", employeeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function fetchLeaves(
  from?: string,
  to?: string
): Promise<LeaveRequest[]> {
  let query = client()
    .from(LEAVES_TABLE)
    .select("*")
    .order("attendance_date", { ascending: false });
  if (from) query = query.gte("attendance_date", from);
  if (to) query = query.lte("attendance_date", to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as LeaveRequest[]) ?? [];
}

export async function fetchApprovedAttendanceExemptions(): Promise<
  AttendanceExemption[]
> {
  const { data, error } = await client().rpc("approved_attendance_exemptions");
  if (error) throw new Error(error.message);
  return (data as AttendanceExemption[]) ?? [];
}

export async function insertLeave(leave: LeaveRequest): Promise<LeaveRequest> {
  const { data, error } = await client()
    .from(LEAVES_TABLE)
    .insert(leave)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as LeaveRequest;
}

export async function updateLeave(
  id: string,
  updates: Partial<Pick<LeaveRequest, "type" | "status" | "reason">>
): Promise<LeaveRequest> {
  const { data, error } = await client()
    .from(LEAVES_TABLE)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as LeaveRequest;
}

export async function deleteLeave(id: string): Promise<void> {
  const { error } = await client().from(LEAVES_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchHolidays(): Promise<Holiday[]> {
  const { data, error } = await client()
    .from(HOLIDAYS_TABLE)
    .select("*")
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Holiday[]) ?? [];
}

export async function insertHoliday(holiday: {
  date: string;
  name: string;
}): Promise<Holiday> {
  const { data, error } = await client()
    .from(HOLIDAYS_TABLE)
    .insert({
      id: crypto.randomUUID(),
      date: holiday.date,
      name: holiday.name.trim(),
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Holiday;
}

export async function deleteHoliday(id: string): Promise<void> {
  const { error } = await client().from(HOLIDAYS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchSalaries(): Promise<Salary[]> {
  const { data, error } = await client()
    .from(SALARY_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Salary[]) ?? [];
}

export async function fetchSalaryByEmployeeId(
  employeeId: string
): Promise<Salary | null> {
  const { data, error } = await client()
    .from(SALARY_TABLE)
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Salary) ?? null;
}

export async function upsertSalary(salary: Salary): Promise<Salary> {
  const { data, error } = await client()
    .from(SALARY_TABLE)
    .upsert(salary, { onConflict: "employee_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Salary;
}

export async function deleteSalary(employeeId: string): Promise<void> {
  const { error } = await client()
    .from(SALARY_TABLE)
    .delete()
    .eq("employee_id", employeeId);
  if (error) throw new Error(error.message);
}

export async function fetchAllowances(): Promise<Allowance[]> {
  const { data, error } = await client()
    .from(ALLOWANCES_TABLE)
    .select("*")
    .order("month", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Allowance[]) ?? [];
}

export async function fetchAllowanceByEmployeeAndMonth(
  employeeId: string,
  month: string
): Promise<Allowance | null> {
  const { data, error } = await client()
    .from(ALLOWANCES_TABLE)
    .select("*")
    .eq("employee_id", employeeId)
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Allowance) ?? null;
}

export async function upsertAllowance(allowance: Allowance): Promise<Allowance> {
  const { data, error } = await client()
    .from(ALLOWANCES_TABLE)
    .upsert(allowance, { onConflict: "employee_id,month" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Allowance;
}

export async function deleteAllowance(id: string): Promise<void> {
  const { error } = await client().from(ALLOWANCES_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchAdvances(): Promise<Advance[]> {
  const { data, error } = await client()
    .from(ADVANCES_TABLE)
    .select("*")
    .order("advance_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Advance[]) ?? [];
}

export async function insertAdvance(advance: Advance): Promise<Advance> {
  const { data, error } = await client()
    .from(ADVANCES_TABLE)
    .insert(advance)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Advance;
}

export async function deleteAdvance(id: string): Promise<void> {
  const { error } = await client().from(ADVANCES_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchPermissions(): Promise<PermissionRequest[]> {
  const { data, error } = await client()
    .from(PERMISSIONS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as PermissionRequest[]) ?? [];
}

export async function fetchPermissionByEmployeeAndDate(
  employeeId: string,
  attendanceDate: string
): Promise<PermissionRequest | null> {
  const { data, error } = await client()
    .from(PERMISSIONS_TABLE)
    .select("*")
    .eq("employee_id", employeeId)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PermissionRequest) ?? null;
}

export async function insertPermission(
  permission: PermissionRequest
): Promise<PermissionRequest> {
  const { data, error } = await client()
    .from(PERMISSIONS_TABLE)
    .insert(permission)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PermissionRequest;
}

export async function updatePermissionStatus(
  id: string,
  status: PermissionRequest["status"],
  resolvedAt: string
): Promise<PermissionRequest> {
  const { data, error } = await client()
    .from(PERMISSIONS_TABLE)
    .update({ status, resolved_at: resolvedAt })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PermissionRequest;
}

export async function fetchAttendance(): Promise<AttendanceRecord[]> {
  const { data, error } = await client()
    .from(ATTENDANCE_TABLE)
    .select("*")
    .order("attendance_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as AttendanceRecord[]) ?? [];
}

export async function fetchTodayAttendance(
  employeeId: string
): Promise<AttendanceRecord | null> {
  const { data, error } = await client()
    .from(ATTENDANCE_TABLE)
    .select("*")
    .eq("employee_id", employeeId)
    .eq("attendance_date", todayKey())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AttendanceRecord) ?? null;
}

export async function fetchHistory(employeeId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await client()
    .from(ATTENDANCE_TABLE)
    .select("*")
    .eq("employee_id", employeeId)
    .order("attendance_date", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as AttendanceRecord[]) ?? []).filter(
    (r) => r.check_in_status !== "rejected"
  );
}

export async function insertAttendanceRecord(
  record: AttendanceRecord
): Promise<AttendanceRecord> {
  const { data, error } = await client()
    .from(ATTENDANCE_TABLE)
    .insert(record)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AttendanceRecord;
}

export async function updateAttendanceRecord(
  record: AttendanceRecord
): Promise<AttendanceRecord> {
  const { data, error } = await client()
    .from(ATTENDANCE_TABLE)
    .update(record)
    .eq("id", record.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AttendanceRecord;
}

export async function upsertManualAttendancePresent(input: {
  employeeId: string;
  attendanceDate: string;
  reason: string;
}): Promise<AttendanceRecord> {
  const { data, error } = await client()
    .from(ATTENDANCE_TABLE)
    .upsert(
      {
        employee_id: input.employeeId,
        attendance_date: input.attendanceDate,
        check_in_status: "present",
        fined: false,
        fine_amount: null,
        manual_override: true,
        manual_override_reason: input.reason,
      },
      { onConflict: "employee_id,attendance_date" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AttendanceRecord;
}

export async function nextEmployeeIdFromDb(
  role: "staff" | "admin" = "staff"
): Promise<string> {
  const prefix = role === "admin" ? "ADM" : "VC";
  const profiles = await fetchProfiles();
  let max = 0;
  for (const p of profiles) {
    if (p.employee_id.startsWith(prefix)) {
      const num = parseInt(p.employee_id.slice(prefix.length), 10);
      if (!Number.isNaN(num) && num > max) max = num;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function buildSession(profile: Profile): Session {
  return {
    role: profile.role,
    name: profile.full_name,
    employeeId: profile.employee_id,
    authEmail: profile.auth_email ?? "",
  };
}