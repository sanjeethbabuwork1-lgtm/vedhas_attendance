"use client";

import type { AttendanceRow } from "@/types";
import { EmptyState } from "@/components/ui/empty-state";
import { LocationBadge, StatusBadge } from "@/components/attendance/status-badge";
import { formatDateShort, formatDuration, formatTime } from "@/lib/format";

export function AttendanceTable({
  rows,
}: {
  rows: AttendanceRow[];
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No attendance records match your filters"
        description="Try widening the date range or clearing the staff / status filters."
      />
    );
  }

  const locationVerified = (row: AttendanceRow): boolean | null => {
    if (row.record.check_in_status === "rejected") return false;
    if (row.record.check_in_time && !row.record.check_out_time) return true;
    return row.record.check_out_status === "verified" ? true : null;
  };

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="px-5 py-3">Staff</th>
            <th className="px-5 py-3">Employee ID</th>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Check In</th>
            <th className="px-5 py-3">Check Out</th>
            <th className="px-5 py-3">Hours</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Fined</th>
            <th className="px-5 py-3">Permission</th>
            <th className="px-5 py-3">Permission Status</th>
            <th className="px-5 py-3">Face</th>
            <th className="px-5 py-3 text-right">Location</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map(({ record, profile }) => (
            <tr key={record.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3">
                <p className="font-semibold text-slate-800">
                  {profile.full_name}
                </p>
              </td>
              <td className="px-5 py-3 font-mono text-xs text-slate-600">
                {profile.employee_id}
              </td>
              <td className="px-5 py-3 text-xs text-slate-600">
                {formatDateShort(record.attendance_date)}
              </td>
              <td className="px-5 py-3 font-mono text-xs text-slate-600">
                {formatTime(record.check_in_time)}
              </td>
              <td className="px-5 py-3 font-mono text-xs text-slate-600">
                {formatTime(record.check_out_time)}
              </td>
              <td className="px-5 py-3 text-xs font-semibold text-slate-600">
                {formatDuration(record.check_in_time, record.check_out_time)}
              </td>
              <td className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={record.check_in_status} />
                  {record.manual_override === true && (
                    <span
                      title={record.manual_override_reason ?? "Manually marked"}
                      className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary"
                    >
                      Manual
                    </span>
                  )}
                </div>
              </td>
              <td className="px-5 py-3 text-xs font-semibold text-danger">
                {record.fined
                  ? `₹${(record.fine_amount ?? 50).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}`
                  : "No"}
              </td>
              <td className="px-5 py-3 text-xs font-medium text-slate-600">
                {record.permission ? "Yes" : "No"}
              </td>
              <td className="px-5 py-3 text-xs font-semibold">
                {record.permission_status === "accepted" ? (
                  <span className="text-success">Accepted</span>
                ) : record.permission_status === "not_accepted" ? (
                  <span className="text-warning">Not accepted</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-5 py-3">
                {record.check_in_face_detected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                    Verified
                  </span>
                ) : record.manual_override === true ? (
                  <span className="text-xs font-medium text-slate-400">
                    Not recorded
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
                    No face
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-right">
                <LocationBadge verified={locationVerified({ record, profile })} />
                {record.check_in_distance !== null && (
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {record.check_in_distance}m
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="divide-y divide-slate-50 md:hidden">
      {rows.map(({ record, profile }) => (
        <div key={record.id} className="px-5 py-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {profile.full_name}
              </p>
              <p className="text-xs text-slate-400">
                {profile.employee_id} · {formatDateShort(record.attendance_date)}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold">
                <span className={record.fined ? "text-danger" : "text-slate-400"}>
                  {record.fined
                    ? `Fined ₹${(record.fine_amount ?? 50).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}`
                    : "Not fined"}
                </span>
                <span className="text-slate-300">·</span>
                <span
                  className={
                    record.permission_status === "accepted"
                      ? "text-success"
                      : record.permission_status === "not_accepted"
                        ? "text-warning"
                        : "text-slate-400"
                  }
                >
                  {record.permission_status === "accepted"
                    ? "Permission accepted"
                    : record.permission_status === "not_accepted"
                      ? "Permission not accepted"
                      : "No permission"}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge status={record.check_in_status} />
              {record.manual_override === true && (
                <span
                  title={record.manual_override_reason ?? "Manually marked"}
                  className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary"
                >
                  Manual
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                In
              </p>
              <p className="font-mono text-xs font-semibold text-slate-700">
                {formatTime(record.check_in_time)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Out
              </p>
              <p className="font-mono text-xs font-semibold text-slate-700">
                {formatTime(record.check_out_time)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Hours
              </p>
              <p className="font-mono text-xs font-semibold text-slate-700">
                {formatDuration(record.check_in_time, record.check_out_time)}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-400">
              {record.check_in_distance !== null
                ? `${record.check_in_distance}m from organization`
                : "—"}
            </span>
            <LocationBadge verified={locationVerified({ record, profile })} />
          </div>
        </div>
      ))}
      </div>
    </>
  );
}