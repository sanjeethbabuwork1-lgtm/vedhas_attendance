"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, UserCheck } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { FilterBar } from "@/components/admin/filter-bar";
import { AttendanceTable } from "@/components/admin/attendance-table";
import {
  getAttendanceRows,
  getOrganization,
  getStaffProfiles,
  markAttendancePresent,
} from "@/lib/data";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import { todayKey } from "@/lib/format";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmployeeId, setManualEmployeeId] = useState("");
  const [manualDate, setManualDate] = useState(todayKey());
  const [manualReason, setManualReason] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);

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
      setLoadError(null);
    })().catch((error: unknown) => {
      if (!cancelled) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load attendance report."
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applied]);

  const handleApply = useCallback(() => {
    setApplied(filter);
    setLoadError(null);
  }, [filter]);

  async function handleManualMark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualError(null);
    setManualSaving(true);
    try {
      await markAttendancePresent({
        employeeId: manualEmployeeId,
        attendanceDate: manualDate,
        reason: manualReason,
      });
    } catch (error) {
      setManualError(
        error instanceof Error
          ? error.message
          : "Unable to mark attendance present."
      );
      setManualSaving(false);
      return;
    }

    setManualOpen(false);
    setManualReason("");
    setSuccessMessage("Attendance was saved as manually marked Present.");
    setManualSaving(false);
    try {
      setRows(await getAttendanceRows(applied));
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? `Attendance was saved, but the report could not refresh: ${error.message}`
          : "Attendance was saved, but the report could not refresh."
      );
    }
  }

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
            {session.role === "superadmin" && (
              <Button
                type="button"
                disabled={staff.length === 0}
                onClick={() => {
                  setManualError(null);
                  setManualOpen(true);
                }}
              >
                <UserCheck className="size-4" />
                Mark Present
              </Button>
            )}
          </div>
        </div>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {loadError}
        </p>
      )}
      {successMessage && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-success"
        >
          {successMessage}
        </p>
      )}

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

      {manualOpen && session.role === "superadmin" && (
        <Modal onClose={() => !manualSaving && setManualOpen(false)}>
          <form onSubmit={handleManualMark} className="p-5">
            <h2 className="text-lg font-bold text-slate-900">
              Manually mark Present
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              This does not invent a check-in time or GPS location. Existing
              check-in details are kept; the reason is recorded and the entry is
              labeled Manual.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="manual-employee">Staff member</Label>
                <Select
                  id="manual-employee"
                  value={manualEmployeeId}
                  onChange={(event) => setManualEmployeeId(event.target.value)}
                  required
                >
                  <option value="">Select staff</option>
                  {staff.map((member) => (
                    <option key={member.employee_id} value={member.employee_id}>
                      {member.full_name} ({member.employee_id})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="manual-date">Attendance date</Label>
                <DatePicker
                  id="manual-date"
                  value={manualDate}
                  onChange={setManualDate}
                  max={todayKey()}
                  placeholder="Select attendance date"
                />
              </div>

              <div>
                <Label htmlFor="manual-reason">Reason (required)</Label>
                <Input
                  id="manual-reason"
                  value={manualReason}
                  onChange={(event) => setManualReason(event.target.value)}
                  maxLength={500}
                  required
                  placeholder="Why is this attendance being corrected?"
                />
              </div>

              {manualError && (
                <p role="alert" className="text-sm font-medium text-danger">
                  {manualError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={manualSaving}
                  onClick={() => setManualOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={manualSaving}>
                  Mark Present
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}