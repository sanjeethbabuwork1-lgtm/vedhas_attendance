"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
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
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/admin/stat-card";
import {
  getAdminStats,
  getAttendanceRows,
  getOrganization,
  getStaffProfiles,
  type AdminStats,
} from "@/lib/data";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import { formatDateFull, toDateInputValue } from "@/lib/format";
import {
  type AttendanceRow,
  type Profile,
} from "@/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { session } = useSession();

  const today = toDateInputValue(new Date());

  const [staff, setStaff] = useState<Profile[]>([]);
  const [todayRows, setTodayRows] = useState<AttendanceRow[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalStaff: 0,
    present: 0,
    late: 0,
    absent: 0,
  });
  const [selected, setSelected] = useState<"present" | "late" | "absent" | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getOrganization();
      const st = await getStaffProfiles();
      const todayFilter = {
        from: today,
        to: today,
        employeeIds: [] as string[],
        status: "all" as const,
      };
      const [todayStats, todayRowsResult] = await Promise.all([
        getAdminStats(s, todayFilter),
        getAttendanceRows(todayFilter),
      ]);
      if (cancelled) return;
      setStaff(st);
      setTodayRows(todayRowsResult);
      setStats(todayStats);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [today]);

  useEffect(() => {
    if (!session) router.replace("/login");
    else if (session.role !== "admin") router.replace("/staff");
  }, [session, router]);

  const mounted = useMounted();

  if (!mounted) {
    return <BrandedLoading />;
  }

  if (!session) {
    return null;
  }

  if (session.role !== "admin") {
    return null;
  }

  const checkedIn = stats.present + stats.late;
  const attendanceRate =
    stats.totalStaff > 0 ? Math.round((checkedIn / stats.totalStaff) * 100) : 0;
  const notCheckedIn = staff.filter(
    (s) => !todayRows.some((r) => r.record.employee_id === s.employee_id)
  );
  const presentShare = stats.totalStaff > 0 ? (stats.present / stats.totalStaff) * 100 : 0;
  const lateShare = stats.totalStaff > 0 ? (stats.late / stats.totalStaff) * 100 : 0;
  const absentShare = stats.totalStaff > 0 ? (stats.absent / stats.totalStaff) * 100 : 0;

  const presentProfiles = todayRows
    .filter((r) => r.record.check_in_status === "present")
    .map((r) => r.profile);
  const lateProfiles = todayRows
    .filter((r) => r.record.check_in_status === "late")
    .map((r) => r.profile);
  const absentProfiles = staff.filter(
    (s) => !todayRows.some((r) => r.record.employee_id === s.employee_id)
  );

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

  const selectedTone =
    selected === "present"
      ? "text-success"
      : selected === "late"
        ? "text-warning"
        : "text-danger";

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
            subtitle="Share of staff checked in today"
          />
          <CardBody>
            <p className="text-4xl font-bold tracking-tight text-slate-900">
              {attendanceRate}%
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {checkedIn} of {stats.totalStaff} staff checked in today
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
            title={notCheckedIn.length > 0 ? "Not Checked In Yet" : "All Staff Checked In"}
            subtitle="Staff without a record for today"
            action={
              notCheckedIn.length > 0 ? (
                <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                  <UserX className="size-3.5" />
                  {notCheckedIn.length}
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
            {notCheckedIn.length === 0 ? (
              <p className="text-sm text-slate-500">
                Everyone on the staff list has an attendance record for today.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notCheckedIn.map((s) => (
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

      {selected && (
        <SelectedStaffModal
          title={selectedTitle}
          count={selectedProfiles.length}
          tone={selectedTone}
          profiles={selectedProfiles}
          onClose={() => setSelected(null)}
        />
      )}

    </AppShell>
  );
}

function SelectedStaffModal({
  title,
  count,
  tone,
  profiles,
  onClose,
}: {
  title: string;
  count: number;
  tone: string;
  profiles: Profile[];
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      panelClassName="flex max-h-[80vh] flex-col overflow-hidden"
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className={`font-semibold ${tone}`}>{count} staff</span> in
            this category today
          </p>
        </div>
      </div>
        <div className="overflow-y-auto p-4">
          {profiles.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No staff members in this category today.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {profiles.map((s) => (
                <li
                  key={s.employee_id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
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
                    <p className="truncate text-xs text-slate-400">
                      {s.employee_id}
                      {s.designation ? ` · ${s.designation}` : ""}
                    </p>
                  </div>
                </li>
              ))}
</ul>
        )}
      </div>
    </Modal>
  );
}