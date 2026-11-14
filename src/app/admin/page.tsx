"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  UserCheck,
  UserX,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { StatCard } from "@/components/admin/stat-card";
import {
  getApprovedAttendanceExemptions,
  getAttendanceRows,
  getHolidays,
  getOrganization,
  getStaffProfiles,
  getUpcomingLeaveRequests,
} from "@/lib/data";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import { formatDateFull, isTimeAfter, toDateInputValue } from "@/lib/format";
import {
  LEAVE_TYPE_LABELS,
  type AttendanceRow,
  type AttendanceExemption,
  type Holiday,
  type Organization,
  type Profile,
} from "@/types";
import {
  groupLeaveRequestDays,
  type LeaveRequestGroup,
} from "@/lib/leave-request-groups";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { session } = useSession();

  const [now, setNow] = useState(() => new Date());
  const today = toDateInputValue(now);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [todayRows, setTodayRows] = useState<AttendanceRow[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [exemptions, setExemptions] = useState<AttendanceExemption[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [upcomingOff, setUpcomingOff] = useState<LeaveRequestGroup[]>([]);
  const [upcomingOffError, setUpcomingOffError] = useState<string | null>(null);
  const [upcomingOffLoading, setUpcomingOffLoading] = useState(true);
  const [selected, setSelected] = useState<"present" | "late" | "absent" | null>(
    null
  );

  useEffect(() => {
    if (session?.role !== "admin" && session?.role !== "superadmin") return;
    let cancelled = false;
    let upcomingOffRequestInFlight = false;
    const loadUpcomingOff = async () => {
      if (upcomingOffRequestInFlight) return;
      upcomingOffRequestInFlight = true;
      try {
        const rows = await getUpcomingLeaveRequests();
        if (cancelled) return;
        setUpcomingOff(
          groupLeaveRequestDays(
            rows.filter(
              ({ leave }) =>
                leave.status === "approved" || leave.status === "pending"
            )
          )
        );
        setUpcomingOffError(null);
      } catch (error) {
        if (cancelled) return;
        setUpcomingOffError(
          error instanceof Error
            ? error.message
            : "Unable to load upcoming leave."
        );
      } finally {
        upcomingOffRequestInFlight = false;
        if (!cancelled) setUpcomingOffLoading(false);
      }
    };

    const loadDashboard = async () => {
      const todayFilter = {
        from: today,
        to: today,
        employeeIds: [] as string[],
        status: "all" as const,
      };
      try {
        const [
          org,
          staffProfiles,
          attendanceExemptions,
          holidayRecords,
          rows,
        ] = await Promise.all([
          getOrganization(),
          getStaffProfiles(),
          getApprovedAttendanceExemptions(),
          getHolidays(),
          getAttendanceRows(todayFilter),
        ]);
        if (cancelled) return;
        setOrganization(org);
        setStaff(staffProfiles);
        setExemptions(attendanceExemptions);
        setHolidays(holidayRecords);
        setTodayRows(rows);
        setNow(new Date());
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load today's attendance."
        );
      }
    };

    void loadDashboard();
    void loadUpcomingOff();
    const refreshDashboard = () => {
      void loadDashboard();
    };
    const refreshUpcomingOff = () => {
      void loadUpcomingOff();
    };
    const refreshUpcomingOffWhenVisible = () => {
      if (document.visibilityState === "visible") refreshUpcomingOff();
    };

    const dashboardRefreshInterval = window.setInterval(
      refreshDashboard,
      60_000
    );
    const upcomingOffRefreshInterval = window.setInterval(
      refreshUpcomingOff,
      15_000
    );
    window.addEventListener("focus", refreshUpcomingOff);
    document.addEventListener(
      "visibilitychange",
      refreshUpcomingOffWhenVisible
    );

    return () => {
      cancelled = true;
      window.clearInterval(dashboardRefreshInterval);
      window.clearInterval(upcomingOffRefreshInterval);
      window.removeEventListener("focus", refreshUpcomingOff);
      document.removeEventListener(
        "visibilitychange",
        refreshUpcomingOffWhenVisible
      );
    };
  }, [session?.role, today]);

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

  const hasCheckedIn = new Set(
    todayRows
      .filter(
        (row) =>
          row.record.check_in_time !== null ||
          (row.record.manual_override === true &&
            row.record.check_in_status === "present")
      )
      .map((row) => row.record.employee_id)
  );
  const excused = new Set([
    ...exemptions
      .filter((exemption) => exemption.attendance_date === today)
      .map((exemption) => exemption.employee_id),
    ...todayRows
      .filter((row) => row.record.permission_status === "accepted")
      .map((row) => row.record.employee_id),
  ]);
  const waitingForCheckIn = staff.filter(
    (profile) =>
      !hasCheckedIn.has(profile.employee_id) &&
      !excused.has(profile.employee_id)
  );
  const isHoliday = holidays.some((holiday) => holiday.date === today);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  const absenceCutoffPassed =
    organization !== null &&
    isTimeAfter(currentTime, organization.attendance_to);
  const absentProfiles =
    absenceCutoffPassed && !isHoliday ? waitingForCheckIn : [];
  const pendingProfiles =
    !absenceCutoffPassed && !isHoliday ? waitingForCheckIn : [];
  const stats = {
    totalStaff: staff.length,
    present: todayRows.filter(
      (row) => row.record.check_in_status === "present"
    ).length,
    late: todayRows.filter((row) => row.record.check_in_status === "late").length,
    absent: absentProfiles.length,
  };
  const checkedIn = stats.present + stats.late;
  const attendanceRate =
    stats.totalStaff > 0 ? Math.round((checkedIn / stats.totalStaff) * 100) : 0;
  const presentShare = stats.totalStaff > 0 ? (stats.present / stats.totalStaff) * 100 : 0;
  const lateShare = stats.totalStaff > 0 ? (stats.late / stats.totalStaff) * 100 : 0;
  const absentShare = stats.totalStaff > 0 ? (stats.absent / stats.totalStaff) * 100 : 0;

  const presentProfiles = todayRows
    .filter((r) => r.record.check_in_status === "present")
    .map((r) => r.profile);
  const lateProfiles = todayRows
    .filter((r) => r.record.check_in_status === "late")
    .map((r) => r.profile);
  const attendanceList = isHoliday
    ? []
    : absenceCutoffPassed
      ? absentProfiles
      : pendingProfiles;
  const attendanceListTitle = isHoliday
    ? "Holiday Today"
    : absenceCutoffPassed
      ? "Absent Today"
      : pendingProfiles.length > 0
        ? "Not Checked In Yet"
        : "No Pending Check-Ins";
  const attendanceListSubtitle = isHoliday
    ? "Attendance is not expected today"
    : absenceCutoffPassed
      ? "Staff without a check-in by the in-time deadline"
      : "Staff who have not checked in before the in-time deadline";

  const selectedProfiles =
    selected === "present"
      ? presentProfiles
      : selected === "late"
        ? lateProfiles
        : selected === "absent"
          ? absentProfiles
          : [];

  const selectedTitle =
    selected === "present"
      ? "Present Today"
      : selected === "late"
        ? "Late Today"
        : selected === "absent"
          ? "Absent Today"
          : "";

  const displayedAttendanceList = selected ? selectedProfiles : attendanceList;
  const pendingUpcomingOff = upcomingOff.filter(
    (group) => group.requests[0].status === "pending"
  );
  const approvedUpcomingOff = upcomingOff.filter(
    (group) => group.requests[0].status === "approved"
  );
  const pendingUpcomingOffCount = pendingUpcomingOff.length;
  const approvedUpcomingOffCount = approvedUpcomingOff.length;
  const displayedAttendanceListTitle = selected
    ? selectedTitle
    : attendanceListTitle;
  const displayedAttendanceListSubtitle = selected
    ? `${selectedProfiles.length} staff in this category today`
    : attendanceListSubtitle;

  function renderUpcomingOffList(
    groups: LeaveRequestGroup[],
    emptyMessage: string
  ) {
    if (groups.length === 0) {
      return <p className="py-3 text-sm text-slate-500">{emptyMessage}</p>;
    }

    return (
      <ul className="divide-y divide-slate-100">
        {groups.map((group) => {
          const leave = group.requests[0];
          const name = group.profile?.full_name ?? leave.employee_id;
          return (
            <li
              key={group.id}
              className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                {name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {name}
                </p>
                <p className="text-xs text-slate-400">
                  {leave.employee_id} · {formatDateFull(group.fromDate)}
                  {group.toDate !== group.fromDate &&
                    ` – ${formatDateFull(group.toDate)}`}
                  {group.requests.length > 1 &&
                    ` · ${group.requests.length} days`}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {LEAVE_TYPE_LABELS[leave.type]}
              </span>
              <span
                className={
                  leave.status === "approved"
                    ? "rounded-full bg-success-soft px-2 py-1 text-xs font-semibold text-success"
                    : "rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
                }
              >
                {leave.status === "approved" ? "Approved" : "Pending approval"}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <AppShell role={session.role} name={session.name} employeeId={session.employeeId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Attendance Insights
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            A quick view of how the organization is doing today
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {formatDateFull(today)}
          </p>
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

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Staff"
          value={stats.totalStaff}
          icon={UsersRound}
          tone="blue"
        />
        <StatCard
          label="Present Today"
          value={stats.present}
          icon={CalendarCheck2}
          tone="green"
          onClick={() => setSelected(selected === "present" ? null : "present")}
        />
        <StatCard
          label="Late Today"
          value={stats.late}
          icon={CalendarClock}
          tone="amber"
          onClick={() => setSelected(selected === "late" ? null : "late")}
        />
        <StatCard
          label="Absent Today"
          value={stats.absent}
          icon={CalendarX2}
          tone="red"
          onClick={() => setSelected(selected === "absent" ? null : "absent")}
        />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Attendance Rate"
            subtitle="Share of staff present or late today"
          />
          <CardBody>
            <p className="text-4xl font-bold tracking-tight text-slate-900">
              {attendanceRate}%
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {checkedIn} of {stats.totalStaff} staff recorded as present or late
            </p>
            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="bg-success transition-all"
                style={{ width: `${presentShare}%` }}
              />
              <div
                className="bg-warning transition-all"
                style={{ width: `${lateShare}%` }}
              />
              <div
                className="bg-danger transition-all"
                style={{ width: `${absentShare}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-success" /> Present ({stats.present})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-warning" /> Late ({stats.late})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-danger" /> Absent ({stats.absent})
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={displayedAttendanceListTitle}
            subtitle={displayedAttendanceListSubtitle}
            action={
              selected ? (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Clear filter
                </button>
              ) : isHoliday ? (
                <span className="text-xs font-medium text-slate-400">
                  Holiday
                </span>
              ) : attendanceList.length > 0 ? (
                <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                  <UserX className="size-3.5" />
                  {attendanceList.length}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <UserCheck className="size-3.5" />
                  Done
                </span>
              )
            }
          />
          <CardBody>
            {!selected && isHoliday ? (
              <p className="text-sm text-slate-500">
                No attendance check-in is expected today.
              </p>
            ) : displayedAttendanceList.length === 0 ? (
              <p className="text-sm text-slate-500">
                {selected
                  ? `No staff recorded as ${selected} today.`
                  : "Everyone expected has checked in or has approved leave or permission, or was manually marked present."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {displayedAttendanceList.map((s) => (
                  <li
                    key={s.employee_id}
                    className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                      {s.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {s.full_name}
                      </p>
                      <p className="truncate text-xs text-slate-400">{s.designation}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-medium text-slate-400">
                      {s.employee_id}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Upcoming Off"
          subtitle={`${pendingUpcomingOffCount} pending · ${approvedUpcomingOffCount} approved`}
          action={
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                <CalendarDays className="size-3.5" />
                {upcomingOff.length}
              </span>
              <Link
                href="/admin/upcoming-off"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Review requests
              </Link>
            </div>
          }
        />
        <CardBody>
          {upcomingOffError && (
            <p
              role="alert"
              className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {upcomingOffError}
            </p>
          )}
          {upcomingOffLoading ? (
            <p className="text-sm text-slate-500">Loading upcoming leave…</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <section aria-labelledby="pending-upcoming-off">
                <h3
                  id="pending-upcoming-off"
                  className="mb-2 text-sm font-semibold text-slate-800"
                >
                  Pending approval ({pendingUpcomingOffCount})
                </h3>
                {renderUpcomingOffList(
                  pendingUpcomingOff,
                  "No pending upcoming leave."
                )}
              </section>
              <section aria-labelledby="approved-upcoming-off">
                <h3
                  id="approved-upcoming-off"
                  className="mb-2 text-sm font-semibold text-slate-800"
                >
                  Approved ({approvedUpcomingOffCount})
                </h3>
                {renderUpcomingOffList(
                  approvedUpcomingOff,
                  "No approved upcoming leave."
                )}
              </section>
            </div>
          )}
        </CardBody>
      </Card>

    </AppShell>
  );
}