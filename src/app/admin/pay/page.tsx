"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CircleDollarSign,
  Gift,
  HandCoins,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { getPayrollRows, type PayrollRow } from "@/lib/data";
import { getMonthCalendar } from "@/lib/calendar";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";

function formatMoney(value: number): string {
  return `₹${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function AdminPayPage() {
  const router = useRouter();
  const { session } = useSession();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const [rows, setRows] = useState<PayrollRow[]>([]);

  const calendar = useMemo(
    () => getMonthCalendar(year, month),
    [year, month]
  );

  const loadPayroll = useCallback(async () => {
    try {
      const res = await getPayrollRows(year, month);
      setRows(res.rows);
    } catch {
      // keep the last known figures if a refresh fails
    }
  }, [year, month]);

  useEffect(() => {
    let cancelled = false;
    getPayrollRows(year, month)
      .then((res) => {
        if (!cancelled) {
          setRows(res.rows);
        }
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  useEffect(() => {
    const id = setInterval(() => {
      loadPayroll();
    }, 30000);
    return () => clearInterval(id);
  }, [loadPayroll]);

  useEffect(() => {
    if (!session) router.replace("/login");
    else if (session.role === "staff") router.replace("/staff");
  }, [session, router]);

  const mounted = useMounted();

  const monthLabel = `${MONTHS[month - 1]} ${year}`;

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          salary: acc.salary + r.salary,
          fineAmount: acc.fineAmount + r.fineAmount,
          absenceDeduction: acc.absenceDeduction + r.absenceDeduction,
          allowance: acc.allowance + r.allowance,
          advance: acc.advance + r.advance,
          netPay: acc.netPay + r.netPay,
        }),
        {
          salary: 0,
          fineAmount: 0,
          absenceDeduction: 0,
          allowance: 0,
          advance: 0,
          netPay: 0,
        }
      ),
    [rows]
  );

  if (!mounted) {
    return <BrandedLoading />;
  }

  if (!session) {
    return null;
  }

  if (session.role === "staff") {
    return null;
  }

  return (
    <AppShell role={session.role} name={session.name} employeeId={session.employeeId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Salary to Pay
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {monthLabel} · working days = calendar days − Sundays
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total Salary"
          value={formatMoney(totals.salary)}
          icon={Wallet}
          tone="blue"
        />
        <StatCard
          label="Fine Deduction"
          value={formatMoney(totals.fineAmount)}
          icon={Banknote}
          tone="amber"
        />
        <StatCard
          label="Absence Deduction"
          value={formatMoney(totals.absenceDeduction)}
          icon={CircleDollarSign}
          tone="red"
        />
        <StatCard
          label="Total Allowance"
          value={formatMoney(totals.allowance)}
          icon={Gift}
          tone="green"
        />
        <StatCard
          label="Total Advance"
          value={formatMoney(totals.advance)}
          icon={HandCoins}
          tone="red"
        />
        <StatCard
          label="Net to Pay"
          value={formatMoney(totals.netPay)}
          icon={Wallet}
          tone="green"
        />
      </div>

      <Card>
        <CardHeader
          title={`${monthLabel} Working Days`}
          subtitle="Approved leave is not deducted from pay"
          action={
            <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
              <Banknote className="size-3.5" />
              {calendar.workingDays} working days
            </span>
          }
        />
        <CardBody>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Calendar days
              </p>
              <p className="text-lg font-bold text-slate-800">
                {calendar.calendarDays}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Sundays
              </p>
              <p className="text-lg font-bold text-slate-800">
                {calendar.sundayCount}
              </p>
            </div>
            <div className="rounded-xl bg-primary-soft py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-primary">
                Working days
              </p>
              <p className="text-lg font-bold text-primary">
                {calendar.workingDays}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-5">
        <Card>
          <CardHeader
            title="Monthly Payroll"
            subtitle="Pay = per-day × paid days (check-in + approved permission + approved leave) − fines − advance. Allowance is paid separately and is not part of net pay"
            action={
              <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                <Banknote className="size-3.5" />
                {rows.length} staff
              </span>
            }
          />
          <CardBody>
            {rows.length === 0 ? (
              <EmptyState
                title="No staff to pay"
                description={`No staff with a salary for ${monthLabel}. Set each staff member's salary on the Staff tab.`}
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3 text-right">Staff</th>
                        <th className="px-4 py-3 text-right">Salary</th>
                        <th className="px-4 py-3 text-right">Per-day</th>
                        <th className="px-4 py-3 text-right">Attended</th>
                        <th className="px-4 py-3 text-right">Leave</th>
                        <th className="px-4 py-3 text-right">Absent</th>
                        <th className="px-4 py-3 text-right">LOP</th>
                        <th className="px-4 py-3 text-right">Late</th>
                        <th className="px-4 py-3 text-right">Fine</th>
                        <th className="px-4 py-3 text-right">Abs. Ded.</th>
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
                          dailySalary,
                          attendedDays,
                          approvedLeaveDays,
                          absentDays,
                          lopDays,
                          lateDays,
                          fineAmount,
                          absenceDeduction,
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
                              {salary > 0 ? formatMoney(salary) : "—"}
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
                            <td className="px-4 py-3 text-right font-semibold text-danger">
                              {absenceDeduction > 0
                                ? formatMoney(absenceDeduction)
                                : "—"}
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
                      dailySalary,
                      attendedDays,
                      approvedLeaveDays,
                      absentDays,
                      lopDays,
                      lateDays,
                      fineAmount,
                      absenceDeduction,
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
                              Salary
                            </p>
                            <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-700">
                              {salary > 0 ? formatMoney(salary) : "—"}
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
                              Abs. ded.
                            </p>
                            <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-danger">
                              {absenceDeduction > 0
                                ? formatMoney(absenceDeduction)
                                : "—"}
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
      </div>
    </AppShell>
  );
}