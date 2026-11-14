"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/input";
import { StatCard } from "@/components/admin/stat-card";
import { getPayrollRows, type PayrollRow } from "@/lib/data";
import type { DateRangeCalendar } from "@/lib/calendar";
import { formatDateFull, todayKey } from "@/lib/format";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import { SalarySlipPanel } from "./salary-slip-panel";

function formatMoney(value: number): string {
  return `₹${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function AdminPayPage() {
  const router = useRouter();
  const { session } = useSession();

  const [filter, setFilter] = useState(() => {
    const today = todayKey();
    return { from: `${today.slice(0, 7)}-01`, to: today };
  });
  const [applied, setApplied] = useState(filter);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [calendar, setCalendar] = useState<DateRangeCalendar | null>(null);
  const [activeView, setActiveView] = useState<"payroll" | "slip">("payroll");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPayrollRows(applied.from, applied.to);
      setRows(res.rows);
      setCalendar(res.calendar);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load payroll."
      );
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    let cancelled = false;
    getPayrollRows(applied.from, applied.to)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setCalendar(res.calendar);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Unable to load payroll."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied]);

  useEffect(() => {
    const id = setInterval(() => {
      void loadPayroll();
    }, 30000);
    return () => clearInterval(id);
  }, [loadPayroll]);

  useEffect(() => {
    if (!session) router.replace("/login");
    else if (session.role === "staff") router.replace("/staff");
    else if (session.role === "admin") router.replace("/admin");
  }, [session, router]);

  const mounted = useMounted();

  const today = todayKey();
  const periodLabel = `${formatDateFull(applied.from)} to ${formatDateFull(
    applied.to
  )}`;

  const totals = useMemo(
    () => rows.reduce((total, row) => total + row.netPay, 0),
    [rows]
  );

  function applyDateRange() {
    if (!filter.from || !filter.to || filter.from > filter.to) {
      setLoadError("Choose a valid date range.");
      return;
    }
    setLoadError(null);
    setLoading(true);
    setApplied(filter);
  }

  if (!mounted) {
    return <BrandedLoading />;
  }

  if (!session) {
    return null;
  }

  if (session.role !== "superadmin") {
    return null;
  }

  return (
    <AppShell role={session.role} name={session.name} employeeId={session.employeeId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {activeView === "payroll" ? "Salary to Pay" : "Salary Slip"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {periodLabel} · selected dates are inclusive
          </p>
        </div>
        <p className="text-xs text-slate-400">
          {loading ? "Updating payroll…" : `${rows.length} staff`}
        </p>
      </div>

      <div
        role="group"
        aria-label="Payroll views"
        className="mb-5 flex w-fit gap-1 rounded-xl bg-slate-100 p-1"
      >
        <button
          type="button"
          aria-pressed={activeView === "payroll"}
          onClick={() => setActiveView("payroll")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeView === "payroll"
              ? "bg-white text-primary shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Salary to Pay
        </button>
        <button
          type="button"
          aria-pressed={activeView === "slip"}
          onClick={() => setActiveView("slip")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeView === "slip"
              ? "bg-white text-primary shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Salary Slip
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="pay-from">From date</Label>
            <DatePicker
              id="pay-from"
              value={filter.from}
              onChange={(from) => setFilter({ ...filter, from })}
              max={filter.to || today}
              placeholder="Select start date"
            />
          </div>
          <div>
            <Label htmlFor="pay-to">To date</Label>
            <DatePicker
              id="pay-to"
              value={filter.to}
              onChange={(to) => setFilter({ ...filter, to })}
              min={filter.from || undefined}
              max={today}
              placeholder="Select end date"
            />
          </div>
          <Button
            type="button"
            onClick={applyDateRange}
            disabled={!filter.from || !filter.to || filter.from > filter.to}
          >
            Apply dates
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Salary is calculated only for workdays in this range. Each month uses
          its own working-day rate; Sundays and holidays are not counted as
          payable days. For a partial first month, set the start date to the
          employee&apos;s joining date.
        </p>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {loadError}
        </p>
      )}

      {activeView === "payroll" && (
        <>
          <div className="mb-5 max-w-sm">
            <StatCard
              label="Need to Pay"
              value={formatMoney(totals)}
              icon={Wallet}
              tone="green"
            />
          </div>
          <p className="mb-5 -mt-2 text-xs text-slate-500">
            The Allowance column shows each staff member&apos;s full recorded
            amount separately. It is not included in Net Pay or Need to Pay.
          </p>
        </>
      )}

      {activeView === "payroll" && (
        <Card className="mt-5">
          <CardHeader
            title="Payroll for Selected Period"
            subtitle="Net pay uses attended days and approved leave, less absence/LOP deductions, fines and advances dated in the range. Allowances are shown separately."
            action={
              <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                <Wallet className="size-3.5" />
                {rows.length} staff
              </span>
            }
          />
          <CardBody>
            {rows.length === 0 ? (
              <EmptyState
                title="No staff to pay"
                description="No staff profiles were found. Add staff and set each person's monthly salary to calculate payroll."
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3 text-right">Staff</th>
                        <th className="px-4 py-3 text-right">Base (period)</th>
                        <th className="px-4 py-3 text-right">Avg. per-day</th>
                        <th className="px-4 py-3 text-right">Attended</th>
                        <th className="px-4 py-3 text-right">Leave</th>
                        <th className="px-4 py-3 text-right">Absent</th>
                        <th className="px-4 py-3 text-right">LOP</th>
                        <th className="px-4 py-3 text-right">Late</th>
                        <th className="px-4 py-3 text-right">Fine</th>
                        <th className="px-4 py-3 text-right">Allowance</th>
                        <th className="px-4 py-3 text-right">Advance</th>
                        <th className="px-4 py-3 text-right">Net Pay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map(
                        ({
                          profile,
                          salary,
                          periodSalary,
                          dailySalary,
                          attendedDays,
                          approvedLeaveDays,
                          absentDays,
                          lopDays,
                          lateDays,
                          fineAmount,
                          allowance,
                          advance,
                          netPay,
                        }) => (
                          <tr
                            key={profile.employee_id}
                            className="hover:bg-slate-50/60"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                                  {profile.full_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join("")}
                                </span>
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {profile.full_name}
                                  </p>
                                  <p className="font-mono text-[10px] text-slate-400">
                                    {profile.employee_id}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">
                              {salary > 0 ? formatMoney(periodSalary) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">
                              {salary > 0 ? formatMoney(dailySalary) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">
                              {attendedDays}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">
                              {approvedLeaveDays > 0 ? approvedLeaveDays : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-danger">
                              {absentDays > 0 ? absentDays : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">
                              {lopDays > 0 ? lopDays : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">
                              {lateDays > 0 ? lateDays : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-danger">
                              {fineAmount > 0 ? formatMoney(fineAmount) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-success">
                              {allowance > 0 ? formatMoney(allowance) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-danger">
                              {advance > 0 ? formatMoney(advance) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-success">
                              {salary > 0 ? (
                                formatMoney(netPay)
                              ) : (
                                <span className="font-medium text-slate-400">
                                  No salary
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-50 md:hidden">
                  {rows.map(
                    ({
                      profile,
                      salary,
                      periodSalary,
                      dailySalary,
                      attendedDays,
                      approvedLeaveDays,
                      absentDays,
                      lopDays,
                      lateDays,
                      fineAmount,
                      allowance,
                      advance,
                      netPay,
                    }) => (
                      <div key={profile.employee_id} className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {profile.full_name}
                            </p>
                            <p className="truncate text-xs text-slate-400">
                              {profile.employee_id}
                              {profile.designation
                                ? ` · ${profile.designation}`
                                : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Net pay
                            </p>
                            <p className="whitespace-nowrap text-[clamp(0.75rem,3.8vw,0.9375rem)] font-bold tabular-nums text-success">
                              {salary > 0 ? formatMoney(netPay) : "No salary"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-slate-50 px-1 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Base (period)
                            </p>
                            <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-700">
                              {salary > 0 ? formatMoney(periodSalary) : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-1 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Per-day
                            </p>
                            <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-700">
                              {salary > 0 ? formatMoney(dailySalary) : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-1 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Attended
                            </p>
                            <p className="text-xs font-semibold text-slate-700">
                              {attendedDays}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-1 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Leave
                            </p>
                            <p className="text-xs font-semibold text-slate-700">
                              {approvedLeaveDays > 0 ? approvedLeaveDays : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-1 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Absent
                            </p>
                            <p className="text-xs font-semibold text-danger">
                              {absentDays > 0 ? absentDays : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-1 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              LOP
                            </p>
                            <p className="text-xs font-semibold text-danger">
                              {lopDays > 0 ? lopDays : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-1 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Late
                            </p>
                            <p className="text-xs font-semibold text-slate-700">
                              {lateDays > 0 ? lateDays : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-1 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Fine
                            </p>
                            <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-danger">
                              {fineAmount > 0 ? formatMoney(fineAmount) : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-1 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Allowance
                            </p>
                            <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-success">
                              {allowance > 0 ? formatMoney(allowance) : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-1 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Advance
                            </p>
                            <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-danger">
                              {advance > 0 ? formatMoney(advance) : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}
      {activeView === "slip" && (
        <SalarySlipPanel rows={rows} calendar={calendar} loading={loading} />
      )}
    </AppShell>
  );
}