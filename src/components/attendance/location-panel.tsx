"use client";

import { Loader2, MapPin, RefreshCcw, ShieldAlert, Satellite } from "lucide-react";
import type { GeoState, Organization } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Pill({
  dot,
  text,
  tone,
}: {
  dot?: string;
  text: string;
  tone: "green" | "red" | "amber";
}) {
  const tones: Record<string, string> = {
    green: "bg-success-soft text-success ring-success/20",
    red: "bg-danger-soft text-danger ring-danger/20",
    amber: "bg-warning-soft text-warning ring-warning/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        tones[tone]
      )}
    >
      {dot ? <span className={cn("size-2 rounded-full", dot)} /> : null}
      {text}
    </span>
  );
}

export function LocationPanel({
  geo,
  organization,
  bypassGeofence = false,
  onRetry,
  className,
}: {
  geo: GeoState;
  organization: Organization | null;
  bypassGeofence?: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  const { fix, distance, inside, status, error, message } = geo;

  return (
    <div className={cn("rounded-2xl border bg-white", className)}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <MapPin className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-slate-900">Current Location</h3>
        <span className="ml-auto">
          {status === "loading" ? (
            <Pill dot="" text="Detecting…" tone="amber" />
          ) : status === "success" && (inside || bypassGeofence) ? (
            <Pill dot="bg-success" text={bypassGeofence ? "Location Recorded" : "Inside Geofence"} tone="green" />
          ) : status === "success" && !inside ? (
            <Pill dot="bg-danger" text="Outside Geofence" tone="red" />
          ) : null}
        </span>
      </div>

      <div className="px-5 py-4">
        {status === "idle" && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Satellite className="size-4 text-slate-400" />
            Location has not been captured yet.
          </div>
        )}

        {status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="size-4 animate-spin text-primary" />
            Getting your location…
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
              <div>
                <p className="font-medium text-danger">
                  {error === "permission_denied"
                    ? "Location permission is required"
                    : "Unable to determine your location"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {message}
                  {error === "permission_denied"
                    ? " On your phone, open browser settings → Site settings and allow location access, then reload."
                    : " Move to an open area and try again."}
                </p>
                {onRetry && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={onRetry}
                  >
                    <RefreshCcw className="size-4" />
                    Try again
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {status === "success" && fix && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Latitude
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
                  {fix.latitude.toFixed(6)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Longitude
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
                  {fix.longitude.toFixed(6)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  GPS Accuracy
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
                  {fix.accuracy}m
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Distance
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
                  {distance !== null ? `${distance}m` : "—"}
                </p>
              </div>
            </div>

            {distance !== null && organization && (
              <div>
                {inside ? (
                  <Pill dot="bg-success" text={`Inside organization · ${distance}m of ${organization.geofence_radius + (organization.geofence_accuracy ?? 0) + fix.accuracy}m allowance`} tone="green" />
                ) : (
                  <Pill dot="bg-danger" text={`Outside organization · ${distance}m of ${organization.geofence_radius + (organization.geofence_accuracy ?? 0) + fix.accuracy}m allowance`} tone="red" />
                )}
              </div>
            )}

            {!inside && distance !== null && (
              <p className="text-xs text-slate-500">
                {bypassGeofence
                  ? "Your location is recorded — no geofence is required for you (remote/outstation staff)."
                  : `You are out of the ${organization?.name ?? "organization"} (${distance}m).`}
              </p>
            )}

            {onRetry && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                >
                  <RefreshCcw className="size-4" />
                  Try again
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}