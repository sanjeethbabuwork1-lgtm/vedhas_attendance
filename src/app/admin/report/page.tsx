"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/admin/filter-bar";
import { AttendanceTable } from "@/components/admin/attendance-table";
import {
  getAttendanceRows,
  getOrganization,
  getStaffProfiles,
} from "@/lib/data";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import { exportRowsToXls } from "@/lib/xls";
import type { AttendanceFilter, AttendanceRow, Organization, Profile } from "@/types";

export default function AdminReportPage() {
  const router = useRouter();
  const { session } = useSession();

  const [filter, setFilter] = useState<AttendanceFilter>({
    from: "",
    to: "",
    employeeIds: [],
    status: "all",
  });
  const [applied, setApplied] = useState<AttendanceFilter>(filter);
  const [exporting, setExporting] = useState(false);

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, st, r] = await Promise.all([
        getOrganization(),
        getStaffProfiles(),
        getAttendanceRows(applied),
      ]);
      if (cancelled) return;
      setOrganization(s);
      setStaff(st);
      setRows(r);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applied]);

  const handleApply = useCallback(() => {
    setApplied(filter);
  }, [filter]);

  useEffect(() => {
    if (!session) router.replace("/login");
    else if (session.role === "staff") router.replace("/staff");
  }, [session, router]);

  const mounted = useMounted();

  if (!mounted) {
    return <BrandedLoading />;
  }

  if (!session) {
    return null;
  }

  if (session.role === "staff") {
    return null;
  }

  function handleExport() {
    setExporting(true);
    setTimeout(() => {
      try {
        exportRowsToXls(
          rows,
          organization,
          `attendance-report-${applied.from || "start"}-to-${applied.to || "end"}.xlsx`
        );
      } finally {
        setExporting(false);
      }
    }, 50);
  }

  const summary = `${rows.length} record${rows.length === 1 ? "" : "s"}`;

  return (
    <AppShell role={session.role} name={session.name} employeeId={session.employeeId}>
      <div className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Attendance Report
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Filter by date range, staff and status ·{" "}
              <span className="font-medium text-slate-600">{summary}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
              {organization?.name}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <FilterBar
          filter={filter}
          onChange={setFilter}
          staff={staff}
          onApply={handleApply}
          onExport={handleExport}
          exporting={exporting}
        />
      </div>

      <Card>
        <CardHeader
          title="Attendance Records"
          subtitle={
            applied.from && applied.to
              ? `From ${applied.from} to ${applied.to}`
              : "Pick a date range to see attendance records"
          }
          action={
            <span className="hidden items-center gap-1 text-xs font-medium text-slate-400 sm:flex">
              <ClipboardList className="size-3.5" />
              {applied.employeeIds.length === 0
                ? "All staff"
                : "Filtered by staff"}
            </span>
          }
        />
        <AttendanceTable rows={rows} />
        {rows.length === 0 && (
          <EmptyState
            title="No records for this selection"
            description="Adjust the filters to see attendance data."
          />
        )}
      </Card>
    </AppShell>
  );
}