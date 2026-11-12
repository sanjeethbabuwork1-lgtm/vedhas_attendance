"use client";

import { useCallback, useState } from "react";
import type { GeoState, LocationFix, Organization } from "@/types";
import { calculateDistance } from "./geofence";
import { getCurrentPosition, getErrorMessage } from "./location";

export function useGeo(organization: Organization | null) {
  const [geo, setGeo] = useState<GeoState>({
    status: "idle",
    fix: null,
    distance: null,
    inside: null,
    error: null,
    message: null,
  });

  const buildState = useCallback(
    (fix: LocationFix): GeoState => {
      let distance: number | null = null;
      let inside: boolean | null = null;
      if (organization) {
        distance = calculateDistance(
          fix.latitude,
          fix.longitude,
          organization.latitude,
          organization.longitude
        );
        inside =
          distance <=
          organization.geofence_radius +
            fix.accuracy +
            (organization.geofence_accuracy ?? 0);
      }
      return {
        status: "success",
        fix,
        distance,
        inside,
        error: null,
        message: null,
      };
    },
    [organization]
  );

  const applyFix = useCallback(
    (fix: LocationFix) => {
      setGeo(buildState(fix));
    },
    [buildState]
  );

  const requestFix = useCallback(async (): Promise<GeoState> => {
    setGeo((g) => ({ ...g, status: "loading", error: null, message: null }));

    try {
      const fix = await getCurrentPosition();
      const next = buildState(fix);
      setGeo(next);
      return next;
    } catch (err) {
      const kind =
        err instanceof Error &&
        (err.message === "permission_denied" ||
          err.message === "timeout" ||
          err.message === "unavailable")
          ? err.message
          : "unavailable";
      const next: GeoState = {
        status: "error",
        fix: null,
        distance: null,
        inside: null,
        error: kind,
        message: getErrorMessage(kind),
      };
      setGeo(next);
      return next;
    }
  }, [buildState]);

  return { geo, requestFix, applyFix };
}