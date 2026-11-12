import type { LocationFix } from "@/types";

export type LocationErrorKind = "permission_denied" | "timeout" | "unavailable";

export const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

export function getErrorMessage(kind: LocationErrorKind): string {
  switch (kind) {
    case "permission_denied":
      return "Location permission denied. Please enable location permission and try again.";
    case "timeout":
      return "Unable to determine your location. Please try again.";
    case "unavailable":
      return "Location is not available on this device. Please try again.";
  }
}

function toLocationFix(position: GeolocationPosition): LocationFix {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Math.round(position.coords.accuracy),
    timestamp: position.timestamp,
  };
}

export function getCurrentPosition(): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toLocationFix(position)),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("permission_denied"));
        } else if (error.code === error.TIMEOUT) {
          reject(new Error("timeout"));
        } else {
          reject(new Error("unavailable"));
        }
      },
      LOCATION_OPTIONS
    );
  });
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}