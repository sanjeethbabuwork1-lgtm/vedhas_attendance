"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, X, XCircle } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  approveLeave,
  getUpcomingLeaveRequests,
  rejectLeave,
} from "@/lib/data";
import { formatDateFull } from "@/lib/format";
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
  const isSuperAdmin = session?.role === "superadmin";
  const mounted = useMounted();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getUpcomingLeaveRequests();
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getUpcomingLeaveRequests()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) router.replace("/login");
    else if (session.role === "staff") router.replace("/staff");
  }, [session, router]);

  if (!mounted) {
    return <BrandedLoading />;
  }

  if (!session || session.role === "staff") return null;

  async function handleDecide(
    leave: LeaveRequest,
    action: "pto" | "lop" | "reject" | "approve"
  ) {
    setError(null);
    setBusyId(leave.id);
    const result =
      action === "reject"
        ? await rejectLeave(leave.id)
        : action === "approve"
          ? await approveLeave(leave.id, leave.type)
          : await approveLeave(leave.id, action);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    load();
  }

  const pending = rows.filter((r) => r.leave.status === "pending");
  const approved = rows.filter((r) => r.leave.status === "approved");
  const rejected = rows.filter((r) => r.leave.status === "rejected");

  function renderList(list: Row[], emptyText: string) {
    if (list.length === 0) {
      return <p className="mt-2 text-sm text-slate-500">{emptyText}</p>;
    }
    return (
      <div className="mt-3 space-y-2">
        {list.map(({ leave, profile }) => (
          <div
            key={leave.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
              leave.status === "approved"
                ? "border-slate-200 bg-white"
                : leave.status === "rejected"
                  ? "border-slate-100 bg-slate-50"
                  : "border-amber-200 bg-amber-50/60"
            )}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                {profile?.full_name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {profile?.full_name ?? leave.employee_id}
              </p>
              <p className="font-mono text-[10px] text-slate-400">
                {leave.employee_id} · {formatDateFull(leave.attendance_date)}
              </p>
              {leave.reason && (
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {leave.reason}
                </p>
              )}
            </div>
            {typeBadge(leave.type)}
            {statusBadge(leave.status)}
            {isSuperAdmin &&
              leave.status === "pending" &&
              leave.type === "casual" && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={busyId === leave.id}
                  disabled={busyId !== null}
                  onClick={() => handleDecide(leave, "pto")}
                  className="border-success/40 text-success hover:bg-success-soft"
                >
                  <Check className="size-3.5" />
                  PTO
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={busyId === leave.id}
                  disabled={busyId !== null}
                  onClick={() => handleDecide(leave, "lop")}
                  className="border-danger/40 text-danger hover:bg-danger-soft"
                >
                  <XCircle className="size-3.5" />
                  LOP
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={busyId === leave.id}
                  disabled={busyId !== null}
                  onClick={() => handleDecide(leave, "reject")}
                >
                  <X className="size-3.5" />
                  Reject
                </Button>
              </div>
            )}
            {isSuperAdmin &&
              leave.status === "pending" &&
              leave.type !== "casual" && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={busyId === leave.id}
                  disabled={busyId !== null}
                  onClick={() => handleDecide(leave, "approve")}
                  className="border-success/40 text-success hover:bg-success-soft"
                >
                  <Check className="size-3.5" />
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={busyId === leave.id}
                  disabled={busyId !== null}
                  onClick={() => handleDecide(leave, "reject")}
                >
                  <X className="size-3.5" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))}
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
          {rows.length} upcoming
          {rows.length === 1 ? " off" : " offs"}
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
    </AppShell>
  );
}