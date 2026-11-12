"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Banknote,
  CalendarPlus,
  CheckCircle2,
  Clock,
  History,
  LogIn,
  LogOut,
  MapPin,
  PartyPopper,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/attendance/status-badge";
import { LocationPanel } from "@/components/attendance/location-panel";
import { CameraCapture } from "@/components/attendance/camera-capture";
import { LeaveRequestModal } from "@/components/staff/leave-request-modal";
import {
  getHolidays,
  getOrganization,
  getProfileById,
  getTodayAttendance,
  getTodayPermission,
  performCheckIn,
  performCheckOut,
  requestPermission,
} from "@/lib/data";
import { validateLocation, type LocationInput } from "@/lib/attendance";
import { useGeo } from "@/lib/use-geo";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import {
  formatClockTime,
  formatDuration,
  formatMinutesShort,
  formatTime,
  greetingForTime,
  minutesUntil,
  parseTimeToMs,
  todayKey,
} from "@/lib/format";
import type {
  AttendanceRecord,
  Holiday,
  LocationFix,
  Organization,
  PermissionRequest,
} from "@/types";

type ActionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function StaffDashboardPage() {
  const router = useRouter();
  const { session } = useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [permission, setPermission] = useState<PermissionRequest | null>(null);
  const [action, setAction] = useState<ActionState>({ status: "idle" });
  const [pending, setPending] = useState<{
    type: "check_in" | "check_out";
    input: LocationInput;
  } | null>(null);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [bypassGeofence, setBypassGeofence] = useState(false);
  const [permissionReason, setPermissionReason] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const { geo, requestFix } = useGeo(organization);

  useEffect(() => {
    let cancelled = false;
    getOrganization()
      .then((s) => {
        if (!cancelled) setOrganization(s);
      })
      .catch(() => {});
    if (session) {
      getTodayAttendance(session.employeeId)
        .then((r) => {
          if (!cancelled) setToday(r);
        })
        .catch(() => {});
      getTodayPermission(session.employeeId)
        .then((p) => {
          if (!cancelled) setPermission(p);
        })
        .catch(() => {});
      getProfileById(session.employeeId)
        .then((p) => {
          if (!cancelled) setBypassGeofence(Boolean(p?.bypass_geofence));
        })
        .catch(() => {});
      getHolidays()
        .then((h) => {
          if (!cancelled) setHolidays(h);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [session]);

  const startTime = useMemo(
    () =>
      today?.check_in_time ? formatTime(today.check_in_time) : "—",
    [today]
  );

  const minutesLeft = useMemo(() => {
    if (!organization || today?.check_in_time) return null;
    const now = new Date();
    const nowMs =
      now.getHours() * 3600000 +
      now.getMinutes() * 60000 +
      now.getSeconds() * 1000;
    if (nowMs < parseTimeToMs(organization.attendance_from)) return null;
    return minutesUntil(organization.attendance_to, now);
  }, [organization, today]);

  const lateBy = useMemo(() => {
    if (!organization || today?.check_in_time) return null;
    const now = new Date();
    const nowMs =
      now.getHours() * 3600000 +
      now.getMinutes() * 60000 +
      now.getSeconds() * 1000;
    if (nowMs <= parseTimeToMs(organization.attendance_to)) return null;
    return Math.floor(
      (nowMs - parseTimeToMs(organization.attendance_to)) / 60000
    );
  }, [organization, today]);

  const canRequestPermission =
    !permission ||
    (permission.status !== "pending" && permission.status !== "approved");

  const permissionLabel =
    permission?.status === "approved"
      ? "Permission is accepted"
      : permission?.status === "rejected"
        ? "Permission rejected"
        : permission?.status === "pending"
          ? "You sent for Permission Request"
          : null;

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  useEffect(() => {
    if (!organization) return;
    requestFix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.latitude, organization?.longitude, organization?.geofence_radius, organization?.geofence_accuracy]);

  const mounted = useMounted();

  if (!mounted) {
    return <BrandedLoading />;
  }

  if (!session) {
    return null;
  }

  if (!organization) {
    return (
      <AppShell role={session.role} name={session.name} employeeId={session.employeeId}>
        <Card>
          <CardBody className="text-center text-sm text-slate-500">
            Location is not configured yet. Ask an admin to set it up.
          </CardBody>
        </Card>
      </AppShell>
    );
  }

  const checkedIn = Boolean(today?.check_in_time);
  const checkedOut = Boolean(today?.check_out_time);
  const canAct =
    geo.status === "success" && (geo.inside === true || bypassGeofence);

  async function obtainFix(): Promise<LocationFix | null> {
    let fix = geo.status === "success" && geo.fix ? geo.fix : null;
    if (!fix) {
      const fresh = await requestFix();
      if (fresh.status === "success" && fresh.fix) fix = fresh.fix;
    }
    return fix;
  }

  async function handleAction(type: "check_in" | "check_out") {
    if (!session) return;

    if (type === "check_in" && today?.check_in_time) {
      setAction({
        status: "error",
        message: `You have already checked in today at ${formatTime(today.check_in_time)}.`,
      });
      return;
    }
    if (type === "check_out") {
      if (!today?.check_in_time) {
        setAction({
          status: "error",
          message: "You need to check in before checking out.",
        });
        return;
      }
      if (today.check_out_time) {
        setAction({
          status: "error",
          message: "You have already checked out today.",
        });
        return;
      }
    }

    setAction({ status: "loading" });

    const fix = await obtainFix();
    if (!fix) {
      setAction({
        status: "error",
        message:
          geo.error === "permission_denied"
            ? "Location permission is required to mark attendance. Please enable location and try again."
            : "Unable to determine your location. Please try again.",
      });
      return;
    }

    const freshOrganization = await getOrganization();
    if (!freshOrganization) {
      setAction({ status: "error", message: "Location is not configured." });
      return;
    }

    const input = {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
    };

    const pre = validateLocation(freshOrganization, input, {
      bypassGeofence,
    });
    if (!pre.ok) {
      setAction({ status: "error", message: pre.message });
      return;
    }

    setPending({ type, input });
  }

  async function handlePhoto() {
    if (!session || !pending) return;

    // A live photo is mandatory to check in / out, so the face is always
    // considered detected regardless of the device's FaceDetector support.
    const result =
      pending.type === "check_in"
        ? await performCheckIn(session.employeeId, pending.input, true)
        : await performCheckOut(session.employeeId, pending.input, true);

    const attemptedType = pending.type;
    setPending(null);

    setToday(await getTodayAttendance(session.employeeId));

    if (result.ok) {
      setAction({
        status: "success",
        message:
          attemptedType === "check_in"
            ? `Attendance marked. Check-in: ${formatTime(result.record.check_in_time)}`
            : `Check-out recorded. Working duration: ${formatDuration(
                result.record.check_in_time,
                result.record.check_out_time
              )}`,
      });
    } else {
      setAction({ status: "error", message: result.message });
    }
  }

  function handleCancelPhoto() {
    setPending(null);
    setAction({ status: "idle" });
  }

  async function handleRequestPermission() {
    if (!session) return;
    setPermissionError(null);
    setRequesting(true);
    try {
      const result = await requestPermission(
        session.employeeId,
        permissionReason
      );
      if (result.ok) {
        setPermission(result.permission);
        setPermissionOpen(false);
        setPermissionReason("");
      } else {
        setPermissionError(result.message);
      }
    } catch {
      setPermissionError("Unable to request permission. Please try again.");
    } finally {
      setRequesting(false);
    }
  }

  const todayIso = todayKey();
  const isSundayOff = new Date().getDay() === 0;
  const todayHoliday = holidays.find((h) => h.date === todayIso) ?? null;
  const isOffToday = isSundayOff || Boolean(todayHoliday);

  return (
    <AppShell role={session.role} name={session.name} employeeId={session.employeeId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{greetingForTime()},</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {session.name.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            Staff ID: {session.employeeId}
          </p>
          {permission && (
            <p
            className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              permission.status === "approved"
                ? "bg-success-soft text-success"
                : permission.status === "rejected"
                  ? "bg-danger-soft text-danger"
                  : "bg-warning-soft text-warning"
            }`}
          >
            <ShieldCheck className="size-3.5" />
            {permissionLabel}
          </p>
        )}
        </div>
      </div>

      {action.status === "success" && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          {action.message}
        </div>
      )}

      {action.status === "error" && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          <XCircle className="size-4 shrink-0" />
          {action.message}
        </div>
      )}

      {lateBy !== null && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          <XCircle className="size-4 shrink-0" />
          You are already late by {formatMinutesShort(lateBy)} — in-time ended
          at {formatClockTime(organization?.attendance_to ?? "")}
        </div>
      )}

      {minutesLeft !== null && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          <Clock className="size-4 shrink-0" />
          Only {minutesLeft} min left to check in — in-time ends at{" "}
          {formatClockTime(organization?.attendance_to ?? "")}
        </div>
      )}

      {isOffToday && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <PartyPopper className="mt-0.5 size-5 shrink-0 text-indigo-500" />
            <div>
              <p className="text-sm font-bold text-indigo-900">
                You are off today
              </p>
              <p className="text-xs text-indigo-600">
                {todayHoliday
                  ? `${todayHoliday.name} — holiday declared by admin.`
                  : "It's Sunday — weekly holiday."}{" "}
                Want to work and earn a compensatory off?
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="md"
            className="shrink-0 sm:ml-auto"
            onClick={() => setLeaveOpen(true)}
          >
            <CalendarPlus className="size-4" />
            Request Leave
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Today's Attendance" />
            <CardBody>
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-mono text-4xl font-bold tracking-tight text-slate-900">
                    {startTime}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {checkedOut
                      ? "Attendance completed"
                      : checkedIn
                        ? "Checked In"
                        : "Not checked in yet"}
                  </p>
                  {today && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={today.check_in_status} />
                      {today.check_in_status === "late" && (
                        <span className="text-xs text-warning">
                          After {formatClockTime(organization.attendance_to)}
                        </span>
                      )}
                      {today.fined && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-danger">
                          <Banknote className="size-3.5" />
                          Fine ₹
                          {(today.fine_amount ?? organization.late_fine ?? 50).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {today && checkedIn && (
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Check out
                    </p>
                    <p className="font-mono text-lg font-semibold text-slate-700">
                      {formatTime(today.check_out_time)}
                    </p>
                    {checkedOut && (
                      <p className="mt-1 text-xs font-semibold text-primary">
                        {formatDuration(
                          today.check_in_time,
                          today.check_out_time
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5">
                {checkedOut ? (
                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      Attendance completed
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                      {formatTime(today?.check_in_time ?? null)} →{" "}
                      {formatTime(today?.check_out_time ?? null)}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      size="lg"
                      className="flex-1"
                      loading={action.status === "loading"}
                      disabled={action.status === "loading" || !canAct}
                      onClick={() =>
                        handleAction(checkedIn ? "check_out" : "check_in")
                      }
                    >
                      {checkedIn ? (
                        <>
                          <LogOut className="size-5" />
                          CHECK OUT
                        </>
                      ) : (
                        <>
                          <LogIn className="size-5" />
                          CHECK IN
                        </>
                      )}
                    </Button>
                    {canRequestPermission && (
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        disabled={checkedIn}
                        onClick={() => {
                          setPermissionError(null);
                          setPermissionOpen(true);
                        }}
                      >
                        <ShieldCheck className="size-4" />
                        Request Permission
                      </Button>
                    )}
                  </div>
                )}

                {!canAct && geo.status === "success" && (
                  <p className="mt-2 text-center text-xs text-slate-500">
                    {geo.inside === false
                      ? bypassGeofence
                        ? "Geofence not required for you — your location is still recorded."
                        : `You are out of the ${organization.name} (${geo.distance ?? 0}m).`
                      : "Refresh your location before checking in."}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Today's Timeline"
              action={
                <Link
                  href="/staff/history"
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
                >
                  <History className="size-3.5" />
                  History
                </Link>
              }
            />
            <CardBody className="px-5">
              {!today?.check_in_time ? (
                <p className="py-2 text-sm text-slate-500">
                  No activity yet today. Check in to start your attendance.
                </p>
              ) : (
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex size-8 items-center justify-center rounded-full bg-success-soft">
                        <LogIn className="size-4 text-success" />
                      </span>
                      <span className="mt-1 w-px flex-1 bg-slate-200" />
                    </div>
                    <div className="flex flex-1 flex-wrap items-start gap-3 pb-1">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Check In
                        </p>
                        <p className="font-mono text-xs text-slate-500">
                          {formatTime(today.check_in_time)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {today.check_in_distance !== null
                            ? `${today.check_in_distance}m from organization`
                            : "Organization premises"}
                        </p>
                      </div>
                      {today.check_in_face_detected && (
                        <span className="ml-auto shrink-0 rounded-lg bg-success-soft px-2 py-1 text-[11px] font-semibold text-success">
                          Face verified
                        </span>
                      )}
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex size-8 items-center justify-center rounded-full bg-slate-100">
                        <LogOut className="size-4 text-slate-500" />
                      </span>
                    </div>
                    <div className="flex flex-1 flex-wrap items-start gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Check Out
                        </p>
                        <p className="font-mono text-xs text-slate-500">
                          {formatTime(today.check_out_time)}
                        </p>
                        {today.check_out_time && (
                          <p className="text-xs font-medium text-primary">
                            {formatDuration(
                              today.check_in_time,
                              today.check_out_time
                            )}
                          </p>
                        )}
                      </div>
                      {today.check_out_face_detected && (
                        <span className="ml-auto shrink-0 rounded-lg bg-success-soft px-2 py-1 text-[11px] font-semibold text-success">
                          Face verified
                        </span>
                      )}
                    </div>
                  </li>
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <LocationPanel
            geo={geo}
            organization={organization}
            bypassGeofence={bypassGeofence}
            onRetry={requestFix}
          />

          <Card>
            <CardHeader
              title="Geofence"
              subtitle={organization.name}
              action={
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <MapPin className="size-3.5" />
                  {organization.geofence_radius}m radius
                  {organization.geofence_accuracy
                    ? ` · ±${organization.geofence_accuracy}m GPS`
                    : ""}
                </span>
              }
            />
            <CardBody className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Organization location</span>
                <span className="font-mono text-xs text-slate-700">
                  {organization.latitude.toFixed(4)}, {organization.longitude.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">In-time window</span>
                <span className="font-mono text-xs text-slate-700">
                  {formatClockTime(organization.attendance_from)} –{" "}
                  {formatClockTime(organization.attendance_to)}
                </span>
              </div>
            </CardBody>
          </Card>

          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-500">
            <Clock className="size-4 shrink-0 text-slate-400" />
            Check-in between {formatClockTime(organization.attendance_from)} and{" "}
            {formatClockTime(organization.attendance_to)} is marked Present. After
            that it is Late and a late fine of ₹
            {organization.late_fine ?? 50} is applied unless
            an approved permission exists.
          </div>
        </div>
      </div>

      {pending && (
        <CameraCapture
          title={pending.type === "check_in" ? "Capture check-in photo" : "Capture check-out photo"}
          onCapture={handlePhoto}
          onCancel={handleCancelPhoto}
        />
      )}

      {permissionOpen && (
        <Modal
          onClose={() => setPermissionOpen(false)}
          panelClassName="w-full max-w-sm p-5"
        >
          <h3 className="mb-3 text-base font-bold text-slate-900">
            Request Permission
          </h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Your request will be sent to the admin for{" "}
            <span className="font-semibold text-slate-800">today</span>. If
            approved, no late fine or salary deduction applies for the day.
          </p>
          <div className="mt-4">
            <Label htmlFor="permission-reason">Reason (optional)</Label>
            <Input
              id="permission-reason"
              placeholder="e.g. Traffic, personal work…"
              autoComplete="off"
              value={permissionReason}
              onChange={(e) => setPermissionReason(e.target.value)}
            />
          </div>
          {permissionError && (
            <div className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {permissionError}
            </div>
          )}
          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setPermissionOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1"
              loading={requesting}
              onClick={handleRequestPermission}
            >
              Send Request
            </Button>
          </div>
        </Modal>
      )}

      {leaveOpen && session && (
        <LeaveRequestModal
          employeeId={session.employeeId}
          onClose={() => setLeaveOpen(false)}
          onRequested={() => setLeaveOpen(false)}
        />
      )}

      <button
        type="button"
        onClick={() => setLeaveOpen(true)}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90 active:scale-95"
      >
        <CalendarPlus className="size-4" />
        Request Leave
      </button>
    </AppShell>
  );
}