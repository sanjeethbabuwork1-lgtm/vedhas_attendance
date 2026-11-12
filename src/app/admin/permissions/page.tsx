"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, ShieldCheck, X } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  approvePermission,
  getPendingPermissions,
  getStaffProfiles,
  rejectPermission,
} from "@/lib/data";
import { formatDateFull } from "@/lib/format";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import type { PermissionRequest, Profile } from "@/types";

interface Row {
  permission: PermissionRequest;
  staffName?: string;
}

export default function AdminPermissionsPage() {
  const router = useRouter();
  const { session } = useSession();
  const mounted = useMounted();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [permissions, staff] = await Promise.all([
        getPendingPermissions(),
        getStaffProfiles().catch(() => [] as Profile[]),
      ]);
      const nameMap = new Map(staff.map((p) => [p.employee_id, p.full_name]));
      setRows(
        permissions.map((permission) => ({
          permission,
          staffName: nameMap.get(permission.employee_id) ?? permission.employee_id,
        }))
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [permissions, staff] = await Promise.all([
          getPendingPermissions(),
          getStaffProfiles().catch(() => [] as Profile[]),
        ]);
        if (cancelled) return;
        const nameMap = new Map(staff.map((p) => [p.employee_id, p.full_name]));
        setRows(
          permissions.map((permission) => ({
            permission,
            staffName:
              nameMap.get(permission.employee_id) ?? permission.employee_id,
          }))
        );
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
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

  async function handleDecision(id: string, decision: "approve" | "reject") {
    setError(null);
    setBusyId(id);
    const result =
      decision === "approve"
        ? await approvePermission(id)
        : await rejectPermission(id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    load();
  }

  return (
    <AppShell
      role={session.role}
      name={session.name}
      employeeId={session.employeeId}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Permission Requests
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Approve to waive the late fine for the day
          </p>
        </div>
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
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <ShieldCheck className="size-3.5" />
          {rows.length} pending
          {rows.length === 1 ? " request" : " requests"}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No pending permission requests"
          description="Staff late-permission requests will appear here for approval."
        />
      ) : (
        <Card>
          <CardHeader
            title="Pending requests"
            subtitle="Approved requests waive the late fine for that day"
          />
          <CardBody>
            <ul className="space-y-2">
              {rows.map(({ permission, staffName }) => (
                <li
                  key={permission.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                    {(staffName ?? "")
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {staffName}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {permission.employee_id} ·{" "}
                      {formatDateFull(permission.attendance_date)}
                    </p>
                    {permission.reason && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        “{permission.reason}”
                      </p>
                    )}
                  </div>
                  {session.role === "superadmin" && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === permission.id}
                      onClick={() => handleDecision(permission.id, "reject")}
                    >
                      <X className="size-3.5" />
                      Reject
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      loading={busyId === permission.id}
                      onClick={() => handleDecision(permission.id, "approve")}
                    >
                      <Check className="size-3.5" />
                      Approve
                    </Button>
                  </div>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </AppShell>
  );
}