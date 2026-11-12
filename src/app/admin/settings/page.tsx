"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarOff,
  CheckCircle2,
  Crosshair,
  HandCoins,
  Lock,
  MapPinned,
  Save,
  Trash2,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiSelectDialog } from "@/components/ui/multi-select-dialog";
import { Modal } from "@/components/ui/modal";
import {
  addHolidayRange,
  getHolidays,
  getOrganization,
  getStaffProfiles,
  removeHoliday,
  setBypassGeofence,
  setFineExempt,
  updateOrganization,
} from "@/lib/data";
import { getCurrentPosition, getErrorMessage } from "@/lib/location";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import type { Holiday, Organization, Profile } from "@/types";

const settingsSchema = z.object({
  name: z.string().min(2, "Organization name is required"),
  latitude: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  geofence_radius: z.coerce
    .number()
    .min(1, "Radius must be at least 1 meter"),
  geofence_accuracy: z.coerce
    .number()
    .min(0, "GPS accuracy must be 0 or more"),
  attendance_from: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  attendance_to: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  late_fine: z.coerce
    .number()
    .min(0, "Late fine must be 0 or more"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function AdminSettingsPage() {
  const router = useRouter();
  const { session } = useSession();
  const [saved, setSaved] = useState(false);
  const [fetchDialog, setFetchDialog] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [locked, setLocked] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchNotice, setFetchNotice] = useState<{
    tone: "success" | "warning";
    text: string;
  } | null>(null);
  const [authDialog, setAuthDialog] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [organization, setOrganization] = useState<Organization | null>(null);

  const [staff, setStaff] = useState<Profile[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [exemptMsg, setExemptMsg] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [exemptSaving, setExemptSaving] = useState(false);

  const [fineStaffIds, setFineStaffIds] = useState<string[]>([]);
  const [fineMsg, setFineMsg] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [fineSaving, setFineSaving] = useState(false);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayFrom, setHolidayFrom] = useState("");
  const [holidayTo, setHolidayTo] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayMsg, setHolidayMsg] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [holidayBusy, setHolidayBusy] = useState(false);

  const resolver = zodResolver(settingsSchema) as Resolver<SettingsFormValues>;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({ resolver });

  useEffect(() => {
    let cancelled = false;
    getOrganization()
      .then((s) => {
        if (cancelled) return;
        setOrganization(s);
        reset(
          s
            ? {
                name: s.name,
                latitude: s.latitude,
                longitude: s.longitude,
                geofence_radius: s.geofence_radius,
                geofence_accuracy: s.geofence_accuracy ?? 30,
                attendance_from: s.attendance_from,
                attendance_to: s.attendance_to,
                late_fine: s.late_fine,
              }
            : {
                name: "",
                latitude: 0,
                longitude: 0,
                geofence_radius: 50,
                geofence_accuracy: 30,
                attendance_from: "09:45",
                attendance_to: "10:00",
                late_fine: 50,
              }
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    getStaffProfiles()
      .then((rows) => {
        if (cancelled) return;
        setStaff(rows);
        if (!rows.some((p) => p.employee_id === selectedStaffIds[0])) {
          setSelectedStaffIds((prev) =>
            prev.filter((id) => rows.some((p) => p.employee_id === id))
          );
        }
        if (!rows.some((p) => p.employee_id === fineStaffIds[0])) {
          setFineStaffIds((prev) =>
            prev.filter((id) => rows.some((p) => p.employee_id === id))
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exemptMsg, fineMsg]);

  useEffect(() => {
    let cancelled = false;
    getHolidays()
      .then((h) => {
        if (!cancelled) setHolidays(h);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [holidayMsg]);

  async function handleAddHoliday() {
    if (!holidayFrom || !holidayTo || !holidayName.trim()) {
      setHolidayMsg({
        tone: "error",
        text: "Enter both dates and a name for the holiday.",
      });
      return;
    }
    if (holidayTo < holidayFrom) {
      setHolidayMsg({
        tone: "error",
        text: "The end date must be on or after the start date.",
      });
      return;
    }
    setHolidayMsg(null);
    setHolidayBusy(true);
    const result = await addHolidayRange({
      from: holidayFrom,
      to: holidayTo,
      name: holidayName,
    });
    setHolidayBusy(false);
    if (!result.ok) {
      setHolidayMsg({ tone: "error", text: result.message });
      return;
    }
    setHolidayFrom("");
    setHolidayTo("");
    setHolidayName("");
    setHolidayMsg({
      tone: "success",
      text: `${result.added} day${result.added === 1 ? "" : "s"} of ${holidayName} added — staff will see “You are off today” on these dates.`,
    });
  }

  async function handleRemoveHoliday(id: string) {
    setHolidayMsg(null);
    const result = await removeHoliday(id);
    if (!result.ok) {
      setHolidayMsg({ tone: "error", text: result.message });
      return;
    }
    setHolidayMsg({ tone: "success", text: "Holiday removed." });
  }

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

  async function onSubmit(values: SettingsFormValues) {
    try {
      await updateOrganization({
        name: values.name,
        latitude: values.latitude,
        longitude: values.longitude,
        geofence_radius: values.geofence_radius,
        geofence_accuracy: values.geofence_accuracy,
        attendance_from: values.attendance_from,
        attendance_to: values.attendance_to,
        late_fine: values.late_fine,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaved(false);
    }
  }

  async function handleSetBypass(employeeId: string, bypass: boolean) {
    setExemptSaving(true);
    setExemptMsg(null);
    const result = await setBypassGeofence(employeeId, bypass);
    setExemptSaving(false);
    if (!result.ok) {
      setExemptMsg({ tone: "error", text: result.message });
      return;
    }
    setSelectedStaffIds([]);
    setExemptMsg({
      tone: "success",
      text: bypass
        ? `${result.profile.full_name} can now check in and out from anywhere. Their location is still recorded.`
        : `${result.profile.full_name} now needs to be inside the geofence again.`,
    });
  }

  async function handleBypassMany() {
    const ids = selectedStaffIds;
    if (ids.length === 0) return;
    setExemptSaving(true);
    setExemptMsg(null);
    for (const id of ids) {
      const result = await setBypassGeofence(id, true);
      if (!result.ok) {
        setExemptSaving(false);
        setExemptMsg({ tone: "error", text: result.message });
        return;
      }
    }
    setExemptSaving(false);
    setSelectedStaffIds([]);
    setExemptMsg({
      tone: "success",
      text: `${ids.length} staff member${ids.length === 1 ? "" : "s"} can now check in and out from anywhere. Their location is still recorded.`,
    });
  }

  async function handleSetFineExempt(employeeId: string, exempt: boolean) {
    setFineSaving(true);
    setFineMsg(null);
    const result = await setFineExempt(employeeId, exempt);
    setFineSaving(false);
    if (!result.ok) {
      setFineMsg({ tone: "error", text: result.message });
      return;
    }
    setFineStaffIds([]);
    setFineMsg({
      tone: "success",
      text: exempt
        ? `${result.profile.full_name} is now exempt from the late fine.`
        : `${result.profile.full_name} is no longer exempt from the late fine.`,
    });
  }

  async function handleFineExemptMany() {
    const ids = fineStaffIds;
    if (ids.length === 0) return;
    setFineSaving(true);
    setFineMsg(null);
    for (const id of ids) {
      const result = await setFineExempt(id, true);
      if (!result.ok) {
        setFineSaving(false);
        setFineMsg({ tone: "error", text: result.message });
        return;
      }
    }
    setFineSaving(false);
    setFineStaffIds([]);
    setFineMsg({
      tone: "success",
      text: `${ids.length} staff member${ids.length === 1 ? "" : "s"} are now exempt from the late fine.`,
    });
  }

  async function handleConfirmFetch() {
    setFetchDialog(false);
    setFetching(true);
    setFetchError(null);
    setFetchNotice(null);
    try {
      const fix = await getCurrentPosition();
      setValue("latitude", fix.latitude, { shouldValidate: true });
      setValue("longitude", fix.longitude, { shouldValidate: true });
      setValue("geofence_accuracy", fix.accuracy, { shouldValidate: true });
      setLocked(true);
      setFetchNotice(
        fix.accuracy > 100
          ? {
              tone: "warning",
              text: `Coordinates fetched with ±${fix.accuracy}m accuracy — this is low. For best results, fetch again from a phone inside the office.`,
            }
          : {
              tone: "success",
              text: `Coordinates fetched with ±${fix.accuracy}m GPS accuracy. This is stored and auto-compensated at check-in.`,
            }
      );
    } catch (err) {
      const kind =
        err instanceof Error &&
        (err.message === "permission_denied" ||
          err.message === "timeout" ||
          err.message === "unavailable")
          ? err.message
          : "unavailable";
      setFetchError(getErrorMessage(kind));
    } finally {
      setFetching(false);
    }
  }

  function handleUnlock() {
    setAuthPassword("");
    setAuthError(null);
    setAuthDialog(true);
  }

  async function handleAuthSubmit() {
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (authPassword.trim().length < 6) {
        setAuthError("Password must be at least 6 characters.");
        return;
      }
      setLocked(false);
      setAuthDialog(false);
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <AppShell role={session.role} name={session.name} employeeId={session.employeeId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Organization Settings
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Configure the geofence used for attendance validation
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Geofence Configuration" />
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Organization name</Label>
                <Input id="name" {...register("name")} />
                <FieldError message={errors.name?.message} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="latitude">
                    Latitude{" "}
                    <span className="font-normal text-slate-400">
                      (North-South position)
                    </span>
                  </Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    placeholder="13.0827"
                    disabled={locked}
                    {...register("latitude")}
                  />
                  <FieldError message={errors.latitude?.message} />
                </div>
                <div>
                  <Label htmlFor="longitude">
                    Longitude{" "}
                    <span className="font-normal text-slate-400">
                      (East-West position)
                    </span>
                  </Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    placeholder="80.2707"
                    disabled={locked}
                    {...register("longitude")}
                  />
                  <FieldError message={errors.longitude?.message} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  loading={fetching}
                  onClick={() => setFetchDialog(true)}
                  title="Fetch current location for Vedhas HR"
                >
                  <Crosshair className="size-4" />
                  Fetch Location
                </Button>
                {locked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={handleUnlock}
                  >
                    <Lock className="size-4" />
                    Unlock coordinates
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => setLocked(true)}
                  >
                    <Lock className="size-4" />
                    Re-lock coordinates
                  </Button>
                )}
              </div>

              {fetchError && (
                <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                  {fetchError}
                </div>
              )}

              {fetchNotice && (
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium",
                    fetchNotice.tone === "success"
                      ? "bg-success-soft text-success"
                      : "bg-warning-soft text-warning"
                  )}
                >
                  {fetchNotice.text}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="radius">Geofence radius (m)</Label>
                  <Input
                    id="radius"
                    type="number"
                    {...register("geofence_radius")}
                  />
                  <FieldError message={errors.geofence_radius?.message} />
                </div>
                <div>
                  <Label htmlFor="accuracy">
                    GPS accuracy (m){" "}
                    <span className="font-normal text-slate-400">
                      (of this device)
                    </span>
                  </Label>
                  <Input
                    id="accuracy"
                    type="number"
                    {...register("geofence_accuracy")}
                  />
                  <FieldError message={errors.geofence_accuracy?.message} />
                  <p className="mt-1 text-xs text-slate-400">
                    Auto-filled by Fetch Location. Added to the radius at
                    check-in so staff are not marked outside due to GPS error.
                  </p>
                </div>
                <div>
                  <Label htmlFor="late_fine">Late fine (₹)</Label>
                  <Input
                    id="late_fine"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("late_fine")}
                  />
                  <FieldError message={errors.late_fine?.message} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="from">In-time from (HH:MM)</Label>
                  <Input
                    id="from"
                    type="time"
                    {...register("attendance_from")}
                  />
                  <FieldError message={errors.attendance_from?.message} />
                </div>
                <div>
                  <Label htmlFor="to">In-time to (HH:MM)</Label>
                  <Input
                    id="to"
                    type="time"
                    {...register("attendance_to")}
                  />
                  <FieldError message={errors.attendance_to?.message} />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Check-in between the in-time window is marked Present. Check-in
                after the end time is marked Late and a late fine is
                calculated unless an approved permission exists.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" size="lg">
                  <Save className="size-4" />
                  Save Settings
                </Button>
                {saved && (
                  <span className="flex items-center gap-1 text-sm font-medium text-success">
                    <CheckCircle2 className="size-4" />
                    Saved
                  </span>
                )}
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Location Preview" />
            <CardBody className="space-y-2 text-sm">
              {organization ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Organization</span>
                    <span className="font-medium text-slate-700">
                      {organization.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Coordinates</span>
                    <span className="font-mono text-xs text-slate-700">
                      {organization.latitude.toFixed(4)}, {organization.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Radius</span>
                    <span className="font-medium text-slate-700">
                      {organization.geofence_radius}m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">In-time window</span>
                    <span className="font-mono text-xs text-slate-700">
                      {organization.attendance_from} – {organization.attendance_to}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-slate-500">No Location is  configured.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="No-Coordinate Staff"
              subtitle="Remote / outstation staff who can check in and out from anywhere. Their GPS coordinates are still recorded and monitored."
            />
            <CardBody className="space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="remote-staff">Staff members</Label>
                  <MultiSelectDialog
                    id="remote-staff"
                    title="Select staff to exempt"
                    placeholder="Select employees…"
                    options={staff
                      .filter((s) => s.role === "staff")
                      .map((s) => ({
                        value: s.employee_id,
                        label: `${s.employee_id} · ${s.full_name}${
                          s.bypass_geofence ? " (exempted)" : ""
                        }`,
                      }))}
                    values={selectedStaffIds}
                    onChange={setSelectedStaffIds}
                  />
                </div>
                <Button
                  type="button"
                  size="md"
                  loading={exemptSaving}
                  disabled={selectedStaffIds.length === 0}
                  onClick={handleBypassMany}
                >
                  <MapPinned className="size-4" />
                  Exempt
                </Button>
              </div>

              {exemptMsg && (
                <p
                  className={
                    exemptMsg.tone === "success"
                      ? "rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success"
                      : "rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
                  }
                >
                  {exemptMsg.text}
                </p>
              )}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Exempted staff ({staff.filter((s) => s.bypass_geofence).length})
                </p>
                {staff.filter((s) => s.bypass_geofence).length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    No one exempted — the geofence applies to all staff by
                    default.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {staff
                      .filter((s) => s.bypass_geofence)
                      .map((s) => (
                        <div
                          key={s.employee_id}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5"
                        >
                          <UsersRound className="size-4 shrink-0 text-slate-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800">
                              {s.full_name}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400">
                              {s.employee_id}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            loading={exemptSaving}
                            disabled={exemptSaving}
                            onClick={() => handleSetBypass(s.employee_id, false)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Late Fine Exemption"
              subtitle="Staff who are exempt from the late fine. They are still marked late, but no fine is applied or deducted."
            />
            <CardBody className="space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="fine-staff">Staff members</Label>
                  <MultiSelectDialog
                    id="fine-staff"
                    title="Select staff to exempt"
                    placeholder="Select employees…"
                    options={staff
                      .filter((s) => s.role === "staff")
                      .map((s) => ({
                        value: s.employee_id,
                        label: `${s.employee_id} · ${s.full_name}${
                          s.fine_exempt ? " (exempted)" : ""
                        }`,
                      }))}
                    values={fineStaffIds}
                    onChange={setFineStaffIds}
                  />
                </div>
                <Button
                  type="button"
                  size="md"
                  loading={fineSaving}
                  disabled={fineStaffIds.length === 0}
                  onClick={handleFineExemptMany}
                >
                  <HandCoins className="size-4" />
                  Exempt
                </Button>
              </div>

              {fineMsg && (
                <p
                  className={
                    fineMsg.tone === "success"
                      ? "rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success"
                      : "rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
                  }
                >
                  {fineMsg.text}
                </p>
              )}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Fine-exempt staff ({staff.filter((s) => s.fine_exempt).length})
                </p>
                {staff.filter((s) => s.fine_exempt).length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    No one is exempt — the late fine applies to all staff by
                    default.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {staff
                      .filter((s) => s.fine_exempt)
                      .map((s) => (
                        <div
                          key={s.employee_id}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5"
                        >
                          <HandCoins className="size-4 shrink-0 text-slate-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800">
                              {s.full_name}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400">
                              {s.employee_id}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            loading={fineSaving}
                            disabled={fineSaving}
                            onClick={() => handleSetFineExempt(s.employee_id, false)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Holidays"
              subtitle="Company off-days. Staff see “You are off today” on these dates and can request a comp off."
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="holiday-from">From date</Label>
                  <DatePicker
                    id="holiday-from"
                    value={holidayFrom}
                    onChange={setHolidayFrom}
                    max={holidayTo || undefined}
                    placeholder="From date"
                  />
                </div>
                <div>
                  <Label htmlFor="holiday-to">To date</Label>
                  <DatePicker
                    id="holiday-to"
                    value={holidayTo}
                    onChange={setHolidayTo}
                    min={holidayFrom || undefined}
                    placeholder="To date"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="holiday-name">Name</Label>
                  <Input
                    id="holiday-name"
                    placeholder="e.g. Diwali, Pongal…"
                    autoComplete="off"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                size="md"
                className="w-full"
                loading={holidayBusy}
                onClick={handleAddHoliday}
              >
                <CalendarOff className="size-4" />
                Add Holiday
              </Button>

              {holidayMsg && (
                <p
                  className={
                    holidayMsg.tone === "success"
                      ? "rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success"
                      : "rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
                  }
                >
                  {holidayMsg.text}
                </p>
              )}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Declared holidays ({holidays.length})
                </p>
                {holidays.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    No holidays declared yet. Sundays are automatically off.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {holidays.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5"
                      >
                        <CalendarOff className="size-4 shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">
                            {h.name}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400">
                            {h.date}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          loading={holidayBusy}
                          disabled={holidayBusy}
                          onClick={() => handleRemoveHoliday(h.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {fetchDialog && (
        <Modal
          onClose={() => setFetchDialog(false)}
          panelClassName="w-full max-w-sm p-5"
        >
          <h3 className="mb-3 text-base font-bold text-slate-900">
            Confirm Location
          </h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Make sure you are fetching the location of{" "}
            <span className="font-semibold text-slate-800">Vedhas HR</span>.
            This will set the organization geofence coordinates to your current
            location.
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setFetchDialog(false)}
            >
              No
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1"
              loading={fetching}
              onClick={handleConfirmFetch}
            >
              Yes, Fetch
            </Button>
          </div>
        </Modal>
      )}

      {authDialog && (
        <Modal
          onClose={() => setAuthDialog(false)}
          panelClassName="w-full max-w-sm p-5"
        >
          <h3 className="mb-3 text-base font-bold text-slate-900">
            Confirm to unlock
          </h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Enter your password to unlock and edit the organization
            coordinates. They are locked to prevent accidental changes.
          </p>
          <div className="mt-4">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAuthSubmit();
              }}
            />
            {authError && (
              <p className="mt-1 text-xs font-medium text-danger">
                {authError}
              </p>
            )}
          </div>
          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setAuthDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1"
              loading={authLoading}
              onClick={handleAuthSubmit}
            >
              Unlock
            </Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}