import type {
  AttendanceRecord,
  Organization,
  PermissionRequest,
  Profile,
} from "@/types";
import { calculateDistance, isInsideGeofence } from "./geofence";
import { isTimeAfter, todayKey } from "./format";

export type AttendanceErrorCode =
  | "outside_geofence"
  | "low_accuracy"
  | "already_checked_in"
  | "already_checked_out"
  | "no_check_in"
  | "error";

export type AttendanceActionResult =
  | { ok: true; record: AttendanceRecord }
  | { ok: false; code: AttendanceErrorCode; message: string; distance?: number };

export interface LocationInput {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const LATE_FINE = 50;

export function getCheckInStatus(
  organization: Organization,
  now: Date
): "present" | "late" {
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  return isTimeAfter(timeStr, organization.attendance_to) ? "late" : "present";
}

export function validateLocation(
  organization: Organization,
  input: LocationInput,
  opts?: { bypassGeofence?: boolean }
): { ok: true; distance: number } | { ok: false; code: AttendanceErrorCode; message: string; distance: number } {
  const distance = calculateDistance(
    input.latitude,
    input.longitude,
    organization.latitude,
    organization.longitude
  );

  const centerAccuracy = organization.geofence_accuracy ?? 0;
  const allowance =
    organization.geofence_radius + input.accuracy + centerAccuracy;

  if (
    !opts?.bypassGeofence &&
    !isInsideGeofence(
      distance,
      organization.geofence_radius,
      input.accuracy,
      centerAccuracy
    )
  ) {
    return {
      ok: false,
      code: "outside_geofence",
      message: `You are outside the organization premises. Distance: ${distance}m. Allowed: within ${allowance}m (radius ${organization.geofence_radius}m + ${input.accuracy + centerAccuracy}m GPS tolerance).`,
      distance,
    };
  }

  return { ok: true, distance };
}

export function checkIn(
  profile: Profile,
  organization: Organization,
  input: LocationInput,
  todayRecords: AttendanceRecord[],
  faceDetected: boolean,
  opts?: { permission?: PermissionRequest | null; bypassGeofence?: boolean }
): AttendanceActionResult {
  const now = new Date();

  const existing = todayRecords.find(
    (r) =>
      r.employee_id === profile.employee_id &&
      r.attendance_date === todayKey()
  );
  if (existing?.check_in_time) {
    return {
      ok: false,
      code: "already_checked_in",
      message: "You have already checked in today.",
    };
  }

  const location = validateLocation(organization, input, opts);
  if (!location.ok) {
    return { ...location };
  }

  const permission = opts?.permission ?? null;
  const approved = permission?.status === "approved";

  const status = approved ? "present" : getCheckInStatus(organization, now);

  const fined = status === "late";
  const fineAmount = fined ? (organization.late_fine ?? LATE_FINE) : null;

  const base = existing ?? {
    id: crypto.randomUUID(),
    employee_id: profile.employee_id,
    attendance_date: todayKey(),
    created_at: now.toISOString(),
  };

  const record: AttendanceRecord = {
    ...base,
    check_in_time: now.toISOString(),
    check_out_time: existing?.check_out_time ?? null,
    check_in_latitude: input.latitude,
    check_in_longitude: input.longitude,
    check_in_accuracy: input.accuracy,
    check_in_distance: location.distance,
    check_out_latitude: existing?.check_out_latitude ?? null,
    check_out_longitude: existing?.check_out_longitude ?? null,
    check_out_accuracy: existing?.check_out_accuracy ?? null,
    check_out_distance: existing?.check_out_distance ?? null,
    check_in_face_detected: faceDetected,
    check_out_face_detected: existing?.check_out_face_detected ?? false,
    check_in_status: status,
    check_out_status: existing?.check_out_status ?? null,
    permission: permission?.id ?? existing?.permission ?? null,
    permission_status: permission
      ? approved
        ? "accepted"
        : "not_accepted"
      : existing?.permission_status ?? null,
    fined,
    fine_amount: fineAmount,
    updated_at: now.toISOString(),
  };

  return { ok: true, record };
}

export function checkOut(
  profile: Profile,
  organization: Organization,
  input: LocationInput,
  todayRecords: AttendanceRecord[],
  faceDetected: boolean,
  opts?: { bypassGeofence?: boolean }
): AttendanceActionResult {
  const now = new Date();

  const existing = todayRecords.find(
    (r) =>
      r.employee_id === profile.employee_id &&
      r.attendance_date === todayKey()
  );
  if (!existing?.check_in_time) {
    return {
      ok: false,
      code: "no_check_in",
      message: "You need to check in before checking out.",
    };
  }

  if (existing.check_out_time) {
    return {
      ok: false,
      code: "already_checked_out",
      message: "You have already checked out today.",
    };
  }

  const location = validateLocation(organization, input, opts);
  if (!location.ok) {
    return { ...location };
  }

  const updated: AttendanceRecord = {
    ...existing,
    check_out_time: now.toISOString(),
    check_out_latitude: input.latitude,
    check_out_longitude: input.longitude,
    check_out_accuracy: input.accuracy,
    check_out_distance: location.distance,
    check_out_face_detected: faceDetected,
    check_out_status: "verified",
    updated_at: now.toISOString(),
  };

  return { ok: true, record: updated };
}