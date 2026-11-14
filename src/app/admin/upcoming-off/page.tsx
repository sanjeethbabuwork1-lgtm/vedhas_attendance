"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, X, XCircle } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import {
  approveLeave,
  getUpcomingLeaveRequests,
  rejectLeave,
} from "@/lib/data";
import { formatDateFull } from "@/lib/format";
import {
  groupLeaveRequestDays,
  type LeaveRequestGroup,
} from "@/lib/leave-request-groups";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import {
  LEAVE_TYPE_LABELS,
  PAID_LEAVE_TYPES,
  type LeaveRequest,
  type Profile,
} from "@/types";
import { cn } from "@/lib/utils";

interface Row {
  leave: LeaveRequest;
  profile: Profile | null;
}

function typeBadge(type: LeaveRequest["type"]) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
        type === "casual"
          ? "bg-slate-200 text-slate-600"
          : PAID_LEAVE_TYPES.includes(type)
            ? "bg-success-soft text-success"
            : "bg-danger-soft text-danger"
      )}
    >
      {LEAVE_TYPE_LABELS[type]}
    </span>
  );
}

function statusBadge(status: LeaveRequest["status"]) {
  if (status === "pending")
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
        Pending
      </span>
    );
  if (status === "approved")
    return (
      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase text-success">
        Approved
      </span>
    );
  return (
    <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase text-danger">
      Rejected
    </span>
  );
}

export default function AdminUpcomingOffPage() {
  const router = useRouter();
  const { session } = useSession();
  const canManageLeaveRequests =
    session?.role === "admin" || session?.role === "superadmin";
  const mounted = useMounted();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] =
    useState<LeaveRequestGroup | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getUpcomingLeaveRequests();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load upcoming leave."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManageLeaveRequests) return;
    let cancelled = false;
    getUpcomingLeaveRequests()
      .then((data) => {
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load upcoming leave."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageLeaveRequests]);

  useEffect(() => {
    if (!session) router.replace("/login");
    else if (session.role === "staff") router.replace("/staff");
  }, [session, router]);

  if (!mounted) {
    return <BrandedLoading />;
  }

  if (!session || !canManageLeaveRequests) return null;

  async function handleDecide(
    group: LeaveRequestGroup,
    action: "pto" | "lop" | "reject" | "approve"
  ) {
    setError(null);
    setBusyId(group.id);
    for (const leave of group.requests) {
      const result =
        action === "reject"
          ? await rejectLeave(leave.id)
          : action === "approve"
            ? await approveLeave(leave.id, leave.type)
            : await approveLeave(leave.id, action);
      if (!result.ok) {
        await load();
        setBusyId(null);
        setSelectedGroup(null);
        setError(
          `Some dates may already have been updated. Could not process ${formatDateFull(leave.attendance_date)}: ${result.message}`
        );
        return;
      }
    }
    setBusyId(null);
    setSelectedGroup(null);
    window.dispatchEvent(new Event("vedhas:refresh-notifications"));
    await load();
  }

  const groups = groupLeaveRequestDays(rows);
  const pending = groups.filter(
    (group) => group.requests[0].status === "pending"
  );
  const approved = groups.filter(
    (group) => group.requests[0].status === "approved"
  );
  const rejected = groups.filter(
    (group) => group.requests[0].status === "rejected"
  );

  function renderList(list: LeaveRequestGroup[], emptyText: string) {
    if (list.length === 0) {
      return <p className="mt-2 text-sm text-slate-500">{emptyText}</p>;
    }
    return (
      <div className="mt-3 space-y-2">
        {list.map((group) => {
          const leave = group.requests[0];
          const name = group.profile?.full_name ?? leave.employee_id;
          return (
            <button
              type="button"
              key={group.id}
              aria-haspopup="dialog"
              onClick={() => setSelectedGroup(group)}
              className={cn(
                "flex w-full flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-white",
                leave.status === "approved"
                  ? "border-slate-200 bg-white"
                  : leave.status === "rejected"
                    ? "border-slate-100 bg-slate-50"
                    : "border-amber-200 bg-amber-50/60"
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {name
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 2)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {name}
                </p>
                <p className="font-mono text-[10px] text-slate-400">
                  {leave.employee_id} · {formatDateFull(group.fromDate)}
                  {group.toDate !== group.fromDate &&
                    ` – ${formatDateFull(group.toDate)}`}
                  {group.requests.length > 1 &&
                    ` · ${group.requests.length} days`}
                </p>
                {leave.reason && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {leave.reason}
                  </p>
                )}
              </div>
              {typeBadge(leave.type)}
              {statusBadge(leave.status)}
              <span className="text-xs font-semibold text-primary">View</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <AppShell
      role={session.role}
      name={session.name}
      employeeId={session.employeeId}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Upcoming Staff Off
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Upcoming leave requests — Casual Leave is decided as PTO (paid) or
          LOP (loss of pay); Sick Leave and Comp Off are approved as requested.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            load();
          }}
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
        <span className="text-xs text-slate-400">
          {groups.length} upcoming
          {groups.length === 1 ? " request" : " requests"}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No upcoming leave"
          description="There are no future leave requests yet."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardHeader title="Pending approval" />
            <CardBody>{renderList(pending, "No pending requests.")}</CardBody>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Approved" />
            <CardBody>{renderList(approved, "No approved future leave.")}</CardBody>
          </Card>
          <Card>
            <CardHeader title="Rejected" />
            <CardBody>
              {renderList(
                rejected,
                "No rejected future requests."
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {selectedGroup && (
        <Modal
          ariaLabelledBy="leave-request-dialog-title"
          onClose={() => {
            if (busyId === null) setSelectedGroup(null);
          }}
          panelClassName="p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2
                id="leave-request-dialog-title"
                className="text-lg font-bold text-slate-900"
              >
                Leave request
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {selectedGroup.profile?.full_name ??
                  selectedGroup.requests[0].employee_id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedGroup(null)}
              disabled={busyId !== null}
              aria-label="Close leave request"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Dates
              </span>
              <span className="text-right text-sm font-semibold text-slate-800">
                {formatDateFull(selectedGroup.fromDate)}
                {selectedGroup.toDate !== selectedGroup.fromDate &&
                  ` – ${formatDateFull(selectedGroup.toDate)}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Leave type
              </span>
              {typeBadge(selectedGroup.requests[0].type)}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Status
              </span>
              {statusBadge(selectedGroup.requests[0].status)}
            </div>
            {selectedGroup.requests[0].reason && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Reason
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {selectedGroup.requests[0].reason}
                </p>
              </div>
            )}
          </div>
          {canManageLeaveRequests &&
            selectedGroup.requests[0].status === "pending" && (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {selectedGroup.requests[0].type === "casual" ? (
                  <>
                    <Button
                      type="button"
                      size="md"
                      loading={busyId === selectedGroup.id}
                      disabled={busyId !== null}
                      onClick={() => handleDecide(selectedGroup, "pto")}
                      className="border-success/40 text-success hover:bg-success-soft"
                      variant="outline"
                    >
                      <Check className="size-4" />
                      Approve as PTO
                    </Button>
                    <Button
                      type="button"
                      size="md"
                      loading={busyId === selectedGroup.id}
                      disabled={busyId !== null}
                      onClick={() => handleDecide(selectedGroup, "lop")}
                      className="border-danger/40 text-danger hover:bg-danger-soft"
                      variant="outline"
                    >
                      <XCircle className="size-4" />
                      Approve as LOP
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="md"
                    loading={busyId === selectedGroup.id}
                    disabled={busyId !== null}
                    onClick={() => handleDecide(selectedGroup, "approve")}
                    className="border-success/40 text-success hover:bg-success-soft"
                    variant="outline"
                  >
                    <Check className="size-4" />
                    Approve
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  loading={busyId === selectedGroup.id}
                  disabled={busyId !== null}
                  onClick={() => handleDecide(selectedGroup, "reject")}
                  className="text-danger hover:bg-danger-soft"
                >
                  <X className="size-4" />
                  Decline
                </Button>
              </div>
            )}
        </Modal>
      )}
    </AppShell>
  );
}