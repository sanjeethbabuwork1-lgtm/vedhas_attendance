import type {
  Advance,
  Allowance,
  AttendanceFilter,
  AttendanceRecord,
  AttendanceRow,
  Holiday,
  LeaveRequest,
  LeaveType,
  Organization,
  PermissionRequest,
  PermissionStatus,
  Profile,
  Salary,
  Session,
} from "@/types";
import { PAID_LEAVE_TYPES } from "@/types";
import {
  checkIn as validateCheckIn,
  checkOut as validateCheckOut,
  type AttendanceActionResult,
  type LocationInput,
} from "./attendance";
import { getSession, saveSession } from "./session";
import {
  buildSession,
  deleteAdvance,
  deleteAllowance,
  deleteHoliday,
  deleteLeave,
  deleteProfile,
  deleteSalary,
  fetchAdvances,
  fetchAllowances,
  fetchAllowanceByEmployeeAndMonth,
  fetchAttendance,
  fetchHistory,
  fetchHolidays,
  fetchLeaves,
  fetchOrganization,
  fetchPermissions,
  fetchPermissionByEmployeeAndDate,
  fetchProfileByEmployeeId,
  fetchProfiles,
  fetchSalaries,
  fetchSalaryByEmployeeId,
  fetchStaffProfiles,
  fetchTodayAttendance,
  insertAdvance,
  insertAttendanceRecord,
  insertHoliday,
  insertLeave,
  insertPermission,
  insertProfile,
  nextEmployeeIdFromDb,
  saveOrganization,
  updateAttendanceRecord,
  updateLeave,
  updatePermissionStatus,
  updateProfileBypassGeofence,
  updateProfileFineExempt,
  updateProfileLeaveEntitlement,
  upsertAllowance,
  upsertSalary,
} from "./supabase/repo";
import { getMonthCalendar, monthPrefix, type MonthCalendar } from "./calendar";
import { todayKey, toDateInputValue } from "./format";

export async function getOrganization(): Promise<Organization | null> {
  return fetchOrganization();
}

export async function updateOrganization(
  patch: Partial<Organization>
): Promise<Organization | null> {
  return saveOrganization(patch);
}

export async function getProfiles(): Promise<Profile[]> {
  return fetchProfiles();
}

export async function getStaffProfiles(): Promise<Profile[]> {
  return fetchStaffProfiles();
}

export async function getProfileById(
  employeeId: string
): Promise<Profile | null> {
  return fetchProfileByEmployeeId(employeeId);
}

export async function getTodayAttendance(
  employeeId: string
): Promise<AttendanceRecord | null> {
  const record = await fetchTodayAttendance(employeeId);
  if (!record) return null;
  const ctx = await fetchFineExemptContext();
  return suppressFine(record, ctx);
}

export async function getHistory(
  employeeId: string
): Promise<AttendanceRecord[]> {
  const records = await fetchHistory(employeeId);
  const ctx = await fetchFineExemptContext();
  return records.map((r) => suppressFine(r, ctx));
}

function applyFilter(
  rows: AttendanceRow[],
  filter: AttendanceFilter
): AttendanceRow[] {
  return rows.filter(({ record }) => {
    if (
      filter.employeeIds.length > 0 &&
      !filter.employeeIds.includes(record.employee_id)
    ) {
      return false;
    }
    if (
      filter.status !== "all" &&
      record.check_in_status !== filter.status
    ) {
      return false;
    }
    if (filter.from && record.attendance_date < filter.from) return false;
    if (filter.to && record.attendance_date > filter.to) return false;
    return true;
  });
}

export async function getAttendanceRows(
  filter: AttendanceFilter
): Promise<AttendanceRow[]> {
  const profiles = await getProfiles();
  const profileMap = new Map(profiles.map((p) => [p.employee_id, p]));
  const records = await fetchAttendance();
  const ctx = await fetchFineExemptContext();
  const rows: AttendanceRow[] = records
    .map((record) => {
      const profile = profileMap.get(record.employee_id);
      if (!profile) return null;
      return { record: suppressFine(record, ctx), profile };
    })
    .filter((r): r is AttendanceRow => r !== null);

  return applyFilter(rows, filter).sort((a, b) =>
    b.record.attendance_date.localeCompare(a.record.attendance_date)
  );
}

export interface AdminStats {
  totalStaff: number;
  present: number;
  late: number;
  absent: number;
}

export async function getAdminStats(
  organization: Organization | null,
  filter: AttendanceFilter
): Promise<AdminStats> {
  const staff = await getStaffProfiles();
  const totalStaff = staff.length;

  if (!organization) {
    return { totalStaff, present: 0, late: 0, absent: 0 };
  }

  const rows = await getAttendanceRows(filter);
  const present = rows.filter((r) => r.record.check_in_status === "present").length;
  const late = rows.filter((r) => r.record.check_in_status === "late").length;

  const absent = staff.filter((s) => {
    return !rows.some((r) => r.record.employee_id === s.employee_id);
  }).length;

  return { totalStaff, present, late, absent };
}

export async function performCheckIn(
  employeeId: string,
  input: LocationInput,
  faceDetected: boolean
): Promise<AttendanceActionResult> {
  const organization = await getOrganization();
  const profile = await getProfileById(employeeId);
  if (!organization || !profile) {
    return { ok: false, code: "error", message: "Setup incomplete." };
  }

  const records = await fetchAttendance();
  const permission = await getTodayPermission(employeeId);
  const result = validateCheckIn(
    profile,
    organization,
    input,
    records,
    faceDetected,
    { permission, bypassGeofence: profile.bypass_geofence }
  );
  if (!result.ok) return result;

  const ctx = await fetchFineExemptContext();
  if (isFineExempt(todayKey(), employeeId, ctx)) {
    result.record.fined = false;
    result.record.fine_amount = null;
  }

  try {
    const existingToday = records.some(
      (r) =>
        r.employee_id === employeeId && r.attendance_date === todayKey()
    );
    if (existingToday) {
      await updateAttendanceRecord(result.record);
    } else {
      await insertAttendanceRecord(result.record);
    }
  } catch (err) {
    return {
      ok: false,
      code: "error",
      message:
        err instanceof Error ? err.message : "Unable to save attendance.",
    };
  }
  return result;
}

export async function performCheckOut(
  employeeId: string,
  input: LocationInput,
  faceDetected: boolean
): Promise<AttendanceActionResult> {
  const organization = await getOrganization();
  const profile = await getProfileById(employeeId);
  if (!organization || !profile) {
    return { ok: false, code: "error", message: "Setup incomplete." };
  }

  const records = await fetchAttendance();
  const result = validateCheckOut(
    profile,
    organization,
    input,
    records,
    faceDetected,
    { bypassGeofence: profile.bypass_geofence }
  );
  if (!result.ok) return result;

  try {
    await updateAttendanceRecord(result.record);
  } catch (err) {
    return {
      ok: false,
      code: "error",
      message:
        err instanceof Error ? err.message : "Unable to save check-out.",
    };
  }
  return result;
}

export function logout(): void {
  saveSession(null);
}

export function getActiveSession(): Session | null {
  return getSession();
}

interface FineExemptContext {
  holidaySet: Set<string>;
  exemptLeaveMap: Map<string, Set<string>>;
  fineExemptStaff: Set<string>;
}

async function fetchFineExemptContext(): Promise<FineExemptContext> {
  const [holidays, leaves, profiles] = await Promise.all([
    fetchHolidays().catch(() => []),
    fetchLeaves().catch(() => []),
    fetchProfiles().catch(() => []),
  ]);
  const holidaySet = new Set(holidays.map((h) => h.date));
  const exemptLeaveMap = new Map<string, Set<string>>();
  for (const l of leaves) {
    if (l.status === "approved" && l.type !== "comp") {
      const set = exemptLeaveMap.get(l.employee_id) ?? new Set<string>();
      set.add(l.attendance_date);
      exemptLeaveMap.set(l.employee_id, set);
    }
  }
  const fineExemptStaff = new Set(
    profiles.filter((p) => p.fine_exempt).map((p) => p.employee_id)
  );
  return { holidaySet, exemptLeaveMap, fineExemptStaff };
}

function isFineExempt(
  date: string,
  employeeId: string,
  ctx: FineExemptContext
): boolean {
  if (ctx.holidaySet.has(date)) return true;
  if (ctx.fineExemptStaff.has(employeeId)) return true;
  return ctx.exemptLeaveMap.get(employeeId)?.has(date) ?? false;
}

function suppressFine(
  record: AttendanceRecord,
  ctx: FineExemptContext
): AttendanceRecord {
  if (isFineExempt(record.attendance_date, record.employee_id, ctx)) {
    return { ...record, fined: false, fine_amount: null };
  }
  return record;
}

export async function nextEmployeeId(
  role: "staff" | "admin" = "staff"
): Promise<string> {
  return nextEmployeeIdFromDb(role);
}

export async function addStaffMember(input: {
  fullName: string;
  employeeId: string;
  designation: string;
}): Promise<{ ok: true; profile: Profile } | { ok: false; message: string }> {
  const profiles = await getProfiles();
  if (
    profiles.some((p) => p.employee_id === input.employeeId.trim().toUpperCase())
  ) {
    return {
      ok: false,
      message: "A staff member with this Employee ID already exists.",
    };
  }

  const now = new Date().toISOString();
  const profile: Profile = {
    full_name: input.fullName.trim(),
    role: "staff",
    employee_id: input.employeeId.trim().toUpperCase(),
    designation: input.designation.trim() || undefined,
    monthly_leave_entitlement: 0,
    bypass_geofence: false,
    fine_exempt: false,
    created_at: now,
  };

  try {
    const saved = await insertProfile(profile);
    return { ok: true, profile: saved };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Unable to add staff member.",
    };
  }
}

export async function removeStaffMember(
  employeeId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const profiles = await getProfiles();
  const target = profiles.find((p) => p.employee_id === employeeId);
  if (!target) {
    return { ok: false, message: "Staff member not found." };
  }
  if (target.role === "admin") {
    return { ok: false, message: "Admin accounts cannot be removed." };
  }

  try {
    await deleteProfile(employeeId);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Unable to remove staff member.",
    };
  }
}

export async function getSalaries(): Promise<Salary[]> {
  return fetchSalaries();
}

export async function saveSalary(input: {
  employeeId: string;
  employeeName: string;
  salary: number;
}): Promise<{ ok: true; salary: Salary } | { ok: false; message: string }> {
  const now = new Date().toISOString();
  const record: Salary = {
    id: crypto.randomUUID(),
    employee_id: input.employeeId,
    employee_name: input.employeeName,
    salary: input.salary,
    created_at: now,
    updated_at: now,
  };

  try {
    const existing = await fetchSalaryByEmployeeId(input.employeeId);
    const saved = await upsertSalary({
      ...record,
      id: existing?.id ?? record.id,
      created_at: existing?.created_at ?? now,
    });
    return { ok: true, salary: saved };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to save salary.",
    };
  }
}

export async function removeSalary(
  employeeId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteSalary(employeeId);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to remove salary.",
    };
  }
}

export interface PayrollRow {
  profile: Profile;
  salary: number;
  dailySalary: number;
  attendedDays: number;
  approvedLeaveDays: number;
  paidDays: number;
  leaveBalance: number;
  absentDays: number;
  lopDays: number;
  lateDays: number;
  fineAmount: number;
  absenceDeduction: number;
  allowance: number;
  advance: number;
  netPay: number;
}

export async function getPayrollRows(
  year: number,
  month: number
): Promise<{ calendar: MonthCalendar; rows: PayrollRow[] }> {
  const calendar = getMonthCalendar(year, month);
  const prefix = monthPrefix(year, month);
  const [staff, salaries, records] = await Promise.all([
    getStaffProfiles(),
    getSalaries(),
    fetchAttendance(),
  ]);
  const [leaves, permissions, organization, holidays, allowances, advances] =
    await Promise.all([
      fetchLeaves().catch(() => []),
      fetchPermissions().catch(() => []),
      getOrganization().catch(() => null),
      fetchHolidays().catch(() => []),
      fetchAllowances().catch(() => []),
      fetchAdvances().catch(() => []),
    ]);
  const salaryMap = new Map(salaries.map((s) => [s.employee_id, s.salary]));
  const allowanceMap = new Map(
    allowances
      .filter((a) => a.month === prefix)
      .map((a) => [a.employee_id, a.amount])
  );
  const advanceMap = new Map<string, number>();
  for (const a of advances) {
    if (!a.advance_date.startsWith(prefix)) continue;
    advanceMap.set(
      a.employee_id,
      (advanceMap.get(a.employee_id) ?? 0) + a.amount
    );
  }
  const lateFine = organization?.late_fine ?? 50;
  const holidaySet = new Set(holidays.map((h) => h.date));
  const fineExemptStaff = new Set(
    staff.filter((s) => s.fine_exempt).map((s) => s.employee_id)
  );

  const rows = staff.map((profile) => {
    const salary = salaryMap.get(profile.employee_id) ?? 0;
    const dailySalary = calendar.workingDays > 0 ? salary / calendar.workingDays : 0;
    const entitlement = profile.monthly_leave_entitlement ?? 0;

    const monthRecords = records.filter(
      (r) =>
        r.employee_id === profile.employee_id &&
        r.attendance_date.startsWith(prefix)
    );
    const attendedDates = new Set(monthRecords.map((r) => r.attendance_date));
    const permissionDates = new Set(
      permissions
        .filter(
          (p) =>
            p.employee_id === profile.employee_id &&
            p.status === "approved" &&
            p.attendance_date.startsWith(prefix)
        )
        .map((p) => p.attendance_date)
    );
    const leaveDates = leaves
      .filter(
        (l) =>
          l.employee_id === profile.employee_id &&
          l.status === "approved" &&
          PAID_LEAVE_TYPES.includes(l.type) &&
          l.attendance_date.startsWith(prefix)
      )
      .map((l) => l.attendance_date);
    const leaveSet = new Set(leaveDates);
    const lopDates = new Set(
      leaves
        .filter(
          (l) =>
            l.employee_id === profile.employee_id &&
            l.status === "approved" &&
            l.type === "lop" &&
            l.attendance_date.startsWith(prefix)
        )
        .map((l) => l.attendance_date)
    );

    let attendedDays = 0;
    let approvedLeaveDays = 0;
    let lopDays = 0;
    let absentDays = 0;

    const todayIso = todayKey();

    for (const date of calendar.workingDates) {
      if (date > todayIso) continue;
      if (holidaySet.has(date)) continue;
      if (attendedDates.has(date) || permissionDates.has(date)) {
        attendedDays++;
      } else if (leaveSet.has(date)) {
        approvedLeaveDays++;
      } else if (lopDates.has(date)) {
        lopDays++;
      } else {
        absentDays++;
      }
    }

    const workingSet = new Set(calendar.workingDates);

    const noFineLeaveDates = new Set(
      leaves
        .filter(
          (l) =>
            l.employee_id === profile.employee_id &&
            l.status === "approved" &&
            l.type !== "comp" &&
            l.attendance_date.startsWith(prefix)
        )
        .map((l) => l.attendance_date)
    );

    const finedRecords = monthRecords.filter(
      (r) =>
        r.fined &&
        workingSet.has(r.attendance_date) &&
        !holidaySet.has(r.attendance_date) &&
        !noFineLeaveDates.has(r.attendance_date) &&
        !fineExemptStaff.has(r.employee_id)
    );
    const lateDays = finedRecords.length;
    const fineAmount = finedRecords.reduce(
      (sum, r) => sum + (r.fine_amount ?? lateFine),
      0
    );
    const paidDays = attendedDays + approvedLeaveDays;
    const deductionDays = absentDays + lopDays;
    const absenceDeduction = deductionDays * dailySalary;

    const allowance = allowanceMap.get(profile.employee_id) ?? 0;
    const advance = advanceMap.get(profile.employee_id) ?? 0;

    return {
      profile,
      salary,
      dailySalary,
      attendedDays,
      approvedLeaveDays,
      paidDays,
      leaveBalance: Math.max(0, entitlement - approvedLeaveDays),
      absentDays,
      lopDays,
      lateDays,
      fineAmount,
      absenceDeduction,
      allowance,
      advance,
      netPay: Math.max(
        0,
        dailySalary * paidDays - fineAmount - advance
      ),
    };
  });

  return { calendar, rows };
}

export async function getAllowances(): Promise<Allowance[]> {
  return fetchAllowances();
}

export async function saveAllowance(input: {
  employeeId: string;
  month: string;
  amount: number;
  note?: string;
}): Promise<{ ok: true; allowance: Allowance } | { ok: false; message: string }> {
  const now = new Date().toISOString();
  try {
    const existing = await fetchAllowanceByEmployeeAndMonth(
      input.employeeId,
      input.month
    );
    const allowance: Allowance = {
      id: existing?.id ?? crypto.randomUUID(),
      employee_id: input.employeeId,
      month: input.month,
      amount: input.amount,
      note: input.note?.trim() || undefined,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    const saved = await upsertAllowance(allowance);
    return { ok: true, allowance: saved };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to save allowance.",
    };
  }
}

export async function removeAllowance(
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteAllowance(id);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Unable to remove allowance.",
    };
  }
}

export async function getAdvances(): Promise<Advance[]> {
  return fetchAdvances();
}

export async function addAdvance(input: {
  employeeId: string;
  advanceDate: string;
  amount: number;
  note?: string;
}): Promise<{ ok: true; advance: Advance } | { ok: false; message: string }> {
  const now = new Date().toISOString();
  const advance: Advance = {
    id: crypto.randomUUID(),
    employee_id: input.employeeId,
    advance_date: input.advanceDate,
    amount: input.amount,
    note: input.note?.trim() || undefined,
    created_at: now,
    updated_at: now,
  };
  try {
    const saved = await insertAdvance(advance);
    return { ok: true, advance: saved };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to add advance.",
    };
  }
}

export async function removeAdvance(
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteAdvance(id);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Unable to remove advance.",
    };
  }
}

export async function getLeaves(): Promise<LeaveRequest[]> {
  return fetchLeaves();
}

export async function fetchAttendanceForPayroll(): Promise<AttendanceRecord[]> {
  return fetchAttendance();
}

export async function grantLeave(input: {
  employeeId: string;
  attendanceDate: string;
  reason?: string;
}): Promise<
  { ok: true; leave: LeaveRequest } | { ok: false; message: string }
> {
  try {
    const leave: LeaveRequest = {
      id: crypto.randomUUID(),
      employee_id: input.employeeId,
      attendance_date: input.attendanceDate,
      reason: input.reason?.trim() || undefined,
      type: "pto",
      status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const saved = await insertLeave(leave);
    return { ok: true, leave: saved };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to grant leave.",
    };
  }
}

export async function requestLeave(input: {
  employeeId: string;
  from: string;
  to: string;
  reason?: string;
  type?: LeaveType;
}): Promise<{ ok: true; days: number } | { ok: false; message: string }> {
  try {
    const dates = eachDate(input.from, input.to);
    if (dates.length === 0) {
      return { ok: false, message: "Enter valid leave dates." };
    }
    const now = new Date().toISOString();
    for (const attendanceDate of dates) {
      const leave: LeaveRequest = {
        id: crypto.randomUUID(),
        employee_id: input.employeeId,
        attendance_date: attendanceDate,
        reason: input.reason?.trim() || undefined,
        type: input.type ?? "casual",
        status: "pending",
        created_at: now,
        updated_at: now,
      };
      await insertLeave(leave);
    }
    return { ok: true, days: dates.length };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to request leave.";
    if (message.toLowerCase().includes("duplicate")) {
      return {
        ok: false,
        message: "A leave already exists for one of those dates.",
      };
    }
    return { ok: false, message };
  }
}

function eachDate(from: string, to: string): string[] {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) {
    return [];
  }
  const out: string[] = [];
  const cur = a;
  while (cur <= b) {
    out.push(toDateInputValue(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function getHolidays(): Promise<Holiday[]> {
  return fetchHolidays();
}

export async function addHoliday(input: {
  date: string;
  name: string;
}): Promise<{ ok: true; holiday: Holiday } | { ok: false; message: string }> {
  try {
    const holiday = await insertHoliday(input);
    return { ok: true, holiday };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to add holiday.";
    if (message.toLowerCase().includes("duplicate")) {
      return { ok: false, message: "A holiday already exists for that date." };
    }
    return { ok: false, message };
  }
}

export async function addHolidayRange(input: {
  from: string;
  to: string;
  name: string;
}): Promise<{ ok: true; added: number } | { ok: false; message: string }> {
  try {
    const dates = eachDate(input.from, input.to);
    if (dates.length === 0) {
      return { ok: false, message: "Enter valid holiday dates." };
    }
    let added = 0;
    for (const date of dates) {
      await insertHoliday({ date, name: input.name });
      added++;
    }
    return { ok: true, added };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to add holiday.";
    if (message.toLowerCase().includes("duplicate")) {
      return {
        ok: false,
        message: "A holiday already exists for one of those dates.",
      };
    }
    return { ok: false, message };
  }
}

export async function removeHoliday(
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteHoliday(id);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to remove holiday.",
    };
  }
}

export async function getUpcomingLeaveRequests(): Promise<
  { leave: LeaveRequest; profile: Profile | null }[]
> {
  const [leaves, staff] = await Promise.all([
    fetchLeaves().catch(() => [] as LeaveRequest[]),
    getStaffProfiles().catch(() => [] as Profile[]),
  ]);
  const today = todayKey();
  const profileMap = new Map(staff.map((p) => [p.employee_id, p]));
  return leaves
    .filter((l) => l.attendance_date >= today)
    .sort((a, b) => a.attendance_date.localeCompare(b.attendance_date))
    .map((leave) => ({ leave, profile: profileMap.get(leave.employee_id) ?? null }));
}

export async function approveLeave(
  id: string,
  type: LeaveType
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await updateLeave(id, { status: "approved", type });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to approve leave.",
    };
  }
}

export async function rejectLeave(
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await updateLeave(id, { status: "rejected" });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to reject leave.",
    };
  }
}

export async function grantLeaveForAll(input: {
  attendanceDate: string;
  reason?: string;
}): Promise<{ ok: true; granted: number } | { ok: false; message: string }> {
  try {
    const [staff, existing] = await Promise.all([
      getStaffProfiles(),
      fetchLeaves(),
    ]);
    const already = new Set(
      existing
        .filter((l) => l.attendance_date === input.attendanceDate)
        .map((l) => l.employee_id)
    );
    const now = new Date().toISOString();
    let granted = 0;
    for (const profile of staff) {
      if (already.has(profile.employee_id)) continue;
      const leave: LeaveRequest = {
        id: crypto.randomUUID(),
        employee_id: profile.employee_id,
        attendance_date: input.attendanceDate,
        reason: input.reason?.trim() || undefined,
        type: "pto",
        status: "approved",
        created_at: now,
        updated_at: now,
      };
      await insertLeave(leave);
      granted++;
    }
    return { ok: true, granted };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to grant leave.",
    };
  }
}

export async function revokeLeave(
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteLeave(id);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to revoke leave.",
    };
  }
}

export async function setLeaveEntitlement(
  employeeId: string,
  entitlement: number
): Promise<{ ok: true; profile: Profile } | { ok: false; message: string }> {
  try {
    const profile = await updateProfileLeaveEntitlement(
      employeeId,
      Math.max(0, Math.floor(entitlement))
    );
    return { ok: true, profile };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Unable to update leave balance.",
    };
  }
}

export async function setBypassGeofence(
  employeeId: string,
  bypass: boolean
): Promise<{ ok: true; profile: Profile } | { ok: false; message: string }> {
  try {
    const profile = await updateProfileBypassGeofence(employeeId, bypass);
    return { ok: true, profile };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Unable to update staff setting.",
    };
  }
}

export async function setFineExempt(
  employeeId: string,
  exempt: boolean
): Promise<{ ok: true; profile: Profile } | { ok: false; message: string }> {
  try {
    const profile = await updateProfileFineExempt(employeeId, exempt);
    return { ok: true, profile };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Unable to update staff setting.",
    };
  }
}

export async function getPermissions(): Promise<PermissionRequest[]> {
  return fetchPermissions();
}

export async function getPendingPermissions(): Promise<PermissionRequest[]> {
  const all = await getPermissions();
  return all
    .filter((p) => p.status === "pending")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getTodayPermission(
  employeeId: string
): Promise<PermissionRequest | null> {
  return fetchPermissionByEmployeeAndDate(employeeId, todayKey());
}

export async function requestPermission(
  employeeId: string,
  reason: string
): Promise<
  { ok: true; permission: PermissionRequest } | { ok: false; message: string }
> {
  const existing = await getTodayPermission(employeeId);
  if (
    existing &&
    (existing.status === "pending" || existing.status === "approved")
  ) {
    return {
      ok: false,
      message:
        existing.status === "approved"
          ? "Your permission is already approved for today."
          : "You already requested permission for today. Please wait for admin approval.",
    };
  }

  const now = new Date().toISOString();
  const permission: PermissionRequest = {
    id: crypto.randomUUID(),
    employee_id: employeeId,
    attendance_date: todayKey(),
    reason: reason.trim() || undefined,
    status: "pending",
    created_at: now,
    resolved_at: null,
  };

  try {
    const saved = await insertPermission(permission);
    return { ok: true, permission: saved };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Unable to request permission.",
    };
  }
}

export async function approvePermission(
  id: string
): Promise<
  { ok: true; permission: PermissionRequest } | { ok: false; message: string }
> {
  try {
    const updated = await setPermissionStatus(id, "approved");
    await applyPermissionToAttendance(updated);
    return { ok: true, permission: updated };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Unable to approve permission.",
    };
  }
}

export async function rejectPermission(
  id: string
): Promise<
  { ok: true; permission: PermissionRequest } | { ok: false; message: string }
> {
  try {
    const updated = await setPermissionStatus(id, "rejected");
    return { ok: true, permission: updated };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Unable to reject permission.",
    };
  }
}

async function setPermissionStatus(
  id: string,
  status: PermissionStatus
): Promise<PermissionRequest> {
  const now = new Date().toISOString();
  return updatePermissionStatus(id, status, now);
}

async function applyPermissionToAttendance(
  permission: PermissionRequest
): Promise<void> {
  if (permission.status !== "approved") return;
  const records = await fetchAttendance();
  const target = records.find(
    (r) =>
      r.employee_id === permission.employee_id &&
      r.attendance_date === permission.attendance_date
  );
  if (target) {
    if (target.check_in_status === "late") {
      await updateAttendanceRecord({
        ...target,
        check_in_status: "present",
        permission: permission.id,
        permission_status: "accepted",
        fined: false,
        fine_amount: null,
      });
    }
    return;
  }
  const now = new Date().toISOString();
  await insertAttendanceRecord({
    id: crypto.randomUUID(),
    employee_id: permission.employee_id,
    attendance_date: permission.attendance_date,
    check_in_time: null,
    check_out_time: null,
    check_in_latitude: null,
    check_in_longitude: null,
    check_in_accuracy: null,
    check_in_distance: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_accuracy: null,
    check_out_distance: null,
    check_in_face_detected: false,
    check_out_face_detected: false,
    check_in_status: "present",
    check_out_status: null,
    permission: permission.id,
    permission_status: "accepted",
    fined: false,
    fine_amount: null,
    created_at: now,
    updated_at: now,
  });
}