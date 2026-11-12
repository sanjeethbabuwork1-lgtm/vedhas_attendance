"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/attendance/status-badge";
import { getHistory } from "@/lib/data";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import { formatDateShort, formatDuration, formatTime } from "@/lib/format";
import type { AttendanceRecord } from "@/types";

export default function StaffHistoryPage() {
  const router = useRouter();
  const { session } = useSession();
  const mounted = useMounted();
  const [history, setHistory] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (!session) router.replace("/login");
    else {
      let cancelled = false;
      getHistory(session.employeeId)
        .then((rows) => {
          if (!cancelled) setHistory(rows);
        })
        .catch(() => {
          if (!cancelled) setHistory([]);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [session, router]);

  if (!mounted) {
    return <BrandedLoading />;
  }

  if (!session) {
    return null;
  }

  return (
    <AppShell role={session.role} name={session.name} employeeId={session.employeeId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Attendance History
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Your last {history.length} attendance record
            {history.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <Card>
        <div className="hidden md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Check In</th>
                <th className="px-5 py-3">Check Out</th>
                <th className="px-5 py-3">Hours</th>
                <th className="px-5 py-3">Fine</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {formatDateShort(r.attendance_date)}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">
                    {formatTime(r.check_in_time)}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">
                    {formatTime(r.check_out_time)}
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-600">
                    {formatDuration(r.check_in_time, r.check_out_time)}
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold text-danger">
                    {r.fined
                      ? `₹${(r.fine_amount ?? 50).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}`
                      : r.permission_status === "accepted"
                        ? "Waived"
                        : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <StatusBadge status={r.check_in_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-50 md:hidden">
          {history.map((r) => (
            <div key={r.id} className="px-5 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  {formatDateShort(r.attendance_date)}
                </p>
                <StatusBadge status={r.check_in_status} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    In
                  </p>
                  <p className="font-mono text-xs font-semibold text-slate-700">
                    {formatTime(r.check_in_time)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Out
                  </p>
                  <p className="font-mono text-xs font-semibold text-slate-700">
                    {formatTime(r.check_out_time)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Hours
                  </p>
                  <p className="font-mono text-xs font-semibold text-slate-700">
                    {formatDuration(r.check_in_time, r.check_out_time)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {history.length === 0 && (
          <EmptyState
            title="No attendance records yet"
            description="Once you check in, your records will appear here."
          />
        )}
      </Card>
    </AppShell>
  );
}