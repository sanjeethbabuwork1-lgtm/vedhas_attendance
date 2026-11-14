"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getEmployeeLeaveRequests,
  getEmployeePermissionRequests,
} from "@/lib/data";
import { formatDateFull } from "@/lib/format";
import { groupLeaveRequestDays } from "@/lib/leave-request-groups";
import { useMounted } from "@/lib/use-mounted";
import { useSession } from "@/lib/use-session";
import {
  LEAVE_TYPE_LABELS,
  type LeaveRequest,
  type PermissionRequest,
} from "@/types";
import { cn } from "@/lib/utils";

type RequestStatus = "pending" | "approved" | "rejected";

function statusBadge(status: RequestStatus) {
  const classes =
    status === "approved"
      ? "bg-success-soft text-success"
      : status === "rejected"
        ? "bg-danger-soft text-danger"
        : "bg-amber-100 text-amber-700";

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        classes
      )}
    >
      {status === "pending"
        ? "Pending approval"
        : status === "approved"
          ? "Approved"
          : "Declined"}
    </span>
  );
}

function statusCounts<T extends { status: RequestStatus }>(rows: T[]) {
  return {
    pending: rows.filter((row) => row.status === "pending").length,
    approved: rows.filter((row) => row.status === "approved").length,
    rejected: rows.filter((row) => row.status === "rejected").length,
  };
}

export default function StaffRequestStatusPage() {
  const router = useRouter();
  const { session } = useSession();
  const mounted = useMounted();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.role !== "staff") {
      router.replace(session.role === "superadmin" ? "/superadmin" : "/admin");
      return;
    }
    const employeeId = session.employeeId;

    let cancelled = false;
    let requestInFlight = false;

    async function loadRequests() {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const [leaveRequests, permissionRequests] = await Promise.all([
          getEmployeeLeaveRequests(employeeId),
          getEmployeePermissionRequests(employeeId),
        ]);
        if (cancelled) return;
        setLeaves(leaveRequests);
        setPermissions(permissionRequests);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your request statuses."
        );
      } finally {
        requestInFlight = false;
        if (!cancelled) setLoading(false);
      }
    }

    const refresh = () => {
      void loadRequests();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router, session]);

  const leaveGroups = useMemo(
    () =>
      groupLeaveRequestDays(
        leaves.map((leave) => ({ leave, profile: null }))
      ).sort((a, b) => b.fromDate.localeCompare(a.fromDate)),
    [leaves]
  );
  const permissionCounts = statusCounts(permissions);
  const leaveCounts = statusCounts(leaves);

  if (!mounted) {
    return <BrandedLoading />;
  }

  if (!session || session.role !== "staff") return null;

  return (
    <AppShell
      role={session.role}
      name={session.name}
      employeeId={session.employeeId}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Request Status
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Track permission decisions and the dates approved or declined for
          your leave requests.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Permission status"
              subtitle={`${permissionCounts.pending} pending · ${permissionCounts.approved} approved · ${permissionCounts.rejected} declined`}
            />
            <CardBody>
              {permissions.length === 0 ? (
                error ? null : (
                  <EmptyState
                    title="No permission requests"
                    description="Permission requests you send will appear here."
                  />
                )
              ) : (
                <ul className="divide-y divide-slate-100">
                  {permissions.map((permission) => (
                    <li
                      key={permission.id}
                      className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800">
                          {formatDateFull(permission.attendance_date)}
                        </p>
                        {permission.reason && (
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {permission.reason}
                          </p>
                        )}
                      </div>
                      {statusBadge(permission.status)}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Leave request status"
              subtitle={`${leaveCounts.pending} pending · ${leaveCounts.approved} approved · ${leaveCounts.rejected} declined`}
            />
            <CardBody>
              {leaveGroups.length === 0 ? (
                error ? null : (
                  <EmptyState
                    title="No leave requests"
                    description="Leave requests you send will appear here."
                  />
                )
              ) : (
                <ul className="divide-y divide-slate-100">
                  {leaveGroups.map((group) => {
                    const leave = group.requests[0];
                    return (
                      <li
                        key={group.id}
                        className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">
                            {formatDateFull(group.fromDate)}
                            {group.toDate !== group.fromDate &&
                              ` – ${formatDateFull(group.toDate)}`}
                            {group.requests.length > 1 &&
                              ` · ${group.requests.length} days`}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {LEAVE_TYPE_LABELS[leave.type]}
                            {leave.reason ? ` · ${leave.reason}` : ""}
                          </p>
                        </div>
                        {statusBadge(leave.status)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
