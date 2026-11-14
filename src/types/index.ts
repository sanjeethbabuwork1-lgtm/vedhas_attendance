export type Role = "staff" | "admin" | "superadmin";

export type AttendanceStatus = "present" | "late" | "absent" | "rejected";

export type LocationVerification = "verified" | "rejected" | "not_required";

export interface Organization {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  geofence_radius: number;
  geofence_accuracy: number;
  attendance_from: string;
  attendance_to: string;
  late_fine: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  employee_id: string;
  full_name: string;
  role: Role;
  auth_user_id?: string | null;
  auth_email?: string | null;
  designation?: string;
  monthly_leave_entitlement: number;
  bypass_geofence: boolean;
  fine_exempt: boolean;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;

  check_in_time: string | null;
  check_out_time: string | null;

  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy: number | null;
  check_in_distance: number | null;

  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_accuracy: number | null;
  check_out_distance: number | null;

  check_in_face_detected: boolean;
  check_out_face_detected: boolean;

  check_in_status: AttendanceStatus | null;
  check_out_status: "verified" | "rejected" | null;

  permission: string | null;
  permission_status: "accepted" | "not_accepted" | null;
  fined: boolean;
  fine_amount: number | null;
  manual_override?: boolean;
  manual_override_reason?: string | null;

  created_at: string;
  updated_at: string;
}

export type PermissionStatus = "pending" | "approved" | "rejected";

export interface PermissionRequest {
  id: string;
  employee_id: string;
  attendance_date: string;
  reason?: string;
  status: PermissionStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface AttendanceExemption {
  employee_id: string;
  attendance_date: string;
  exemption_type: "leave" | "comp_leave" | "permission";
}

export type LeaveStatus = "pending" | "approved" | "rejected";
export type LeaveType = "casual" | "pto" | "lop" | "comp" | "sick";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  casual: "Casual Leave",
  pto: "PTO",
  lop: "LOP",
  comp: "Comp Off",
  sick: "Sick Leave",
};

export const PAID_LEAVE_TYPES: LeaveType[] = ["pto", "comp", "sick"];

export interface LeaveRequest {
  id: string;
  employee_id: string;
  attendance_date: string;
  reason?: string;
  type: LeaveType;
  status: LeaveStatus;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  created_at: string;
}

export interface AttendanceRow {
  record: AttendanceRecord;
  profile: Profile;
}

export interface Salary {
  id: string;
  employee_id: string;
  employee_name: string;
  salary: number;
  created_at: string;
  updated_at: string;
}

export interface Allowance {
  id: string;
  employee_id: string;
  month: string;
  allowance_date: string;
  organization: ExpenseOrganization | null;
  amount: number;
  particulars: string;
  created_at: string;
  updated_at: string;
}

export type ExpenseOrganization = "VC" | "VCD";

export interface ProfessionalExpense {
  id: string;
  expense_date: string;
  organization: ExpenseOrganization;
  person: string;
  particulars: string;
  amount: number;
  created_at: string;
  updated_at: string;
  modified_by?: string;
  is_modified?: boolean;
}

export interface Advance {
  id: string;
  employee_id: string;
  advance_date: string;
  amount: number;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeoState {
  status: "idle" | "loading" | "success" | "error";
  fix: LocationFix | null;
  distance: number | null;
  inside: boolean | null;
  error: "permission_denied" | "timeout" | "unavailable" | null;
  message: string | null;
}

export type AttendanceFilter = {
  from: string;
  to: string;
  employeeIds: string[];
  status: "all" | AttendanceStatus;
};

export interface Session {
  role: Role;
  name: string;
  employeeId: string;
  authEmail: string;
}