import * as XLSX from "xlsx-js-style";
import type {
  Allowance,
  AttendanceRow,
  Organization,
  Profile,
} from "@/types";
import { formatDateFull, formatDuration, formatTime } from "./format";

export interface XlsColumn {
  key: string;
  label: string;
}

export const REPORT_COLUMNS: XlsColumn[] = [
  { key: "date", label: "Date" },
  { key: "staffName", label: "Staff Name" },
  { key: "employeeId", label: "Employee ID" },
  { key: "checkIn", label: "Check In Time" },
  { key: "checkOut", label: "Check Out Time" },
  { key: "workingHours", label: "Working Hours" },
  { key: "status", label: "Status" },
  { key: "attendanceSource", label: "Attendance Source" },
  { key: "manualReason", label: "Manual Reason" },
  { key: "fine", label: "Fine" },
  { key: "fined", label: "Fined" },
  { key: "permission", label: "Permission" },
  { key: "permissionStatus", label: "Permission Status" },
  { key: "checkInLatitude", label: "Check In Latitude" },
  { key: "checkInLongitude", label: "Check In Longitude" },
  { key: "checkInAccuracy", label: "Check In Accuracy (m)" },
  { key: "checkInDistance", label: "Check In Distance (m)" },
  { key: "checkOutLatitude", label: "Check Out Latitude" },
  { key: "checkOutLongitude", label: "Check Out Longitude" },
  { key: "checkOutAccuracy", label: "Check Out Accuracy (m)" },
  { key: "checkOutDistance", label: "Check Out Distance (m)" },
  { key: "location", label: "Location Verification" },
  { key: "checkInFaceDetected", label: "Check In Face" },
  { key: "checkOutFaceDetected", label: "Check Out Face" },
];

export function buildReportRows(
  rows: AttendanceRow[],
  organization: Organization | null
): Record<string, string | number>[] {
  return rows.map(({ record, profile }) => {
    const status =
      record.check_in_status === "present"
        ? "Present"
        : record.check_in_status === "late"
          ? "Late"
          : record.check_in_status === "rejected"
            ? "Rejected"
            : "Absent";

    const fine =
      record.fined
        ? `₹${(record.fine_amount ?? organization?.late_fine ?? 50).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}`
        : record.permission_status === "accepted"
          ? "Waived"
          : "";

    const location =
      record.check_in_status === "rejected"
        ? "Rejected"
        : record.check_out_status === "verified" ||
          (record.check_in_time && !record.check_out_time)
          ? "Verified"
          : "Not Verified";

    const radius = organization?.geofence_radius ?? 100;

    return {
      date: formatDateFull(record.attendance_date),
      staffName: profile.full_name,
      employeeId: profile.employee_id,
      checkIn: formatTime(record.check_in_time),
      checkOut: formatTime(record.check_out_time),
      workingHours: formatDuration(record.check_in_time, record.check_out_time),
      status,
      attendanceSource: record.manual_override === true ? "Manual" : "Check-in",
      manualReason:
        record.manual_override === true
          ? record.manual_override_reason ?? ""
          : "",
      fine,
      fined: record.fined ? "Yes" : "No",
      permission: record.permission ? "Yes" : "No",
      permissionStatus:
        record.permission_status === "accepted"
          ? "Accepted"
          : record.permission_status === "not_accepted"
            ? "Not accepted"
            : "",
      checkInLatitude: record.check_in_latitude ?? "",
      checkInLongitude: record.check_in_longitude ?? "",
      checkInAccuracy: record.check_in_accuracy ?? "",
      checkInDistance: record.check_in_distance ?? "",
      checkOutLatitude: record.check_out_latitude ?? "",
      checkOutLongitude: record.check_out_longitude ?? "",
      checkOutAccuracy: record.check_out_accuracy ?? "",
      checkOutDistance: record.check_out_distance ?? "",
      location,
      checkInFaceDetected: record.check_in_face_detected ? "Yes" : "No",
      checkOutFaceDetected: record.check_out_face_detected ? "Yes" : "No",
      _radius: radius,
    };
  });
}

function toAttendanceSheetData(
  rows: AttendanceRow[],
  organization: Organization | null
): Record<string, string | number>[] {
  return buildReportRows(rows, organization).map((row) => {
    const out: Record<string, string | number> = {};
    for (const col of REPORT_COLUMNS) {
      out[col.label] = row[col.key] ?? "";
    }
    return out;
  });
}

function setColumnWidths(ws: XLSX.WorkSheet, columns: XlsColumn[]): void {
  ws["!cols"] = columns.map((c) => {
    const length = Math.min(28, Math.max(c.label.length + 2, 10));
    return { wch: length };
  });
}

export function exportRowsToXls(
  rows: AttendanceRow[],
  organization: Organization | null,
  fileName: string
): void {
  const sheetData = toAttendanceSheetData(rows, organization);

  const worksheet = XLSX.utils.json_to_sheet(sheetData, {
    header: REPORT_COLUMNS.map((c) => c.label),
  });
  setColumnWidths(worksheet, REPORT_COLUMNS);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
  XLSX.writeFile(workbook, fileName, { compression: true });
}

export function exportExpensesToXls(params: {
  allowances: Allowance[];
  staff: Profile[];
  monthLabel: string;
  fileName: string;
}): void {
  const staffById = new Map(
    params.staff.map((profile) => [
      profile.employee_id.trim().toLowerCase(),
      profile.full_name,
    ])
  );
  const headers = ["S.NO", "PERSONS", "PARTICULARS", "AMOUNT"];
  const allowanceRows = params.allowances.map((allowance) => {
    const person = staffById.get(allowance.employee_id.trim().toLowerCase());
    if (!person) {
      throw new Error(
        "Cannot export the expense report because an allowance staff profile could not be found."
      );
    }
    return {
      "S.NO": 0,
      PERSONS: person,
      PARTICULARS:
        allowance.particulars.trim() || `Allowance - ${params.monthLabel}`,
      AMOUNT: allowance.amount,
    };
  });
  const rows: Record<string, string | number>[] = allowanceRows.map(
    (row, index) => ({ ...row, "S.NO": index + 1 })
  );

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 36 },
    { wch: 16 },
  ];
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:D1");
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let column = range.s.c; column <= range.e.c; column++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[cellAddress] ?? { t: "s", v: "" };
      cell.s = {
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
        ...(row === range.s.r
          ? {
              font: { bold: true },
              fill: {
                patternType: "solid",
                fgColor: { rgb: "D5D5D5" },
              },
            }
          : {}),
      };
      worksheet[cellAddress] = cell;
    }
  }
  const workbook = XLSX.utils.book_new();
  const sheetName = params.monthLabel.trim().split(/\s+/)[0].slice(0, 3).toUpperCase();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, params.fileName, { compression: true });
}

export function exportAllDataToXls(params: {
  attendance: AttendanceRow[];
  staff: Profile[];
  organization: Organization | null;
}): void {
  const workbook = XLSX.utils.book_new();

  const attendanceSheet = XLSX.utils.json_to_sheet(
    toAttendanceSheetData(params.attendance, params.organization),
    { header: REPORT_COLUMNS.map((c) => c.label) }
  );
  setColumnWidths(attendanceSheet, REPORT_COLUMNS);
  XLSX.utils.book_append_sheet(workbook, attendanceSheet, "Attendance");

  const staffColumns = [
    { key: "name", label: "Staff Name" },
    { key: "employeeId", label: "Employee ID" },
    { key: "designation", label: "Designation" },
    { key: "role", label: "Role" },
    { key: "addedOn", label: "Added On" },
  ];
  const staffSheetData = params.staff.map((p) => ({
    "Staff Name": p.full_name,
    "Employee ID": p.employee_id,
    Designation: p.designation ?? "",
    Role: p.role === "admin" ? "Admin" : "Staff",
    "Added On": formatDateFull(p.created_at),
  }));
  const staffSheet = XLSX.utils.json_to_sheet(staffSheetData, {
    header: staffColumns.map((c) => c.label),
  });
  setColumnWidths(staffSheet, staffColumns);
  XLSX.utils.book_append_sheet(workbook, staffSheet, "Staff");

  const organizationColumns = [
    { key: "name", label: "Organization Name" },
    { key: "latitude", label: "Latitude" },
    { key: "longitude", label: "Longitude" },
    { key: "radius", label: "Geofence Radius (m)" },
    { key: "from", label: "In-time From" },
    { key: "to", label: "In-time To" },
  ];
  const o = params.organization;
  const organizationSheetData = [
    {
      "Organization Name": o?.name ?? "",
      Latitude: o?.latitude ?? "",
      Longitude: o?.longitude ?? "",
      "Geofence Radius (m)": o?.geofence_radius ?? "",
      "In-time From": o?.attendance_from ?? "",
      "In-time To": o?.attendance_to ?? "",
    },
  ];
  const organizationSheet = XLSX.utils.json_to_sheet(organizationSheetData, {
    header: organizationColumns.map((c) => c.label),
  });
  setColumnWidths(organizationSheet, organizationColumns);
  XLSX.utils.book_append_sheet(workbook, organizationSheet, "Organization Settings");

  XLSX.writeFile(workbook, "vedhas_attendance-all-data.xlsx", { compression: true });
}