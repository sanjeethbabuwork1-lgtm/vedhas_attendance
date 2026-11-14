"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, DownloadCloud, RefreshCcw, X } from "lucide-react";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { APP_BUILD_ID } from "@/lib/build-info";

const REMOTE_ORIGIN = "https://vedhas-attendance.vercel.app";

async function fetchLatest(): Promise<{ version: string; buildId: string } | null> {
  try {
    const url = `${REMOTE_ORIGIN}/version.json?t=${Date.now()}`;
    let data: unknown;

    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({
        url,
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        connectTimeout: 15000,
        readTimeout: 15000,
        responseType: "json",
      });
      if (response.status < 200 || response.status >= 300) return null;
      data = response.data;
    } else {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return null;
      data = await response.json();
    }

    if (typeof data === "string") data = JSON.parse(data);
    if (
      !data ||
      typeof data !== "object" ||
      !("buildId" in data) ||
      typeof data.buildId !== "string"
    ) {
      return null;
    }

    return {
      version:
        "version" in data && typeof data.version === "string"
          ? data.version
          : "0.0.0",
      buildId: data.buildId,
    };
  } catch {
    return null;
  }
}

type ToastTone = "info" | "success" | "error";

export function VersionUpdateChecker() {
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<{ version: string; buildId: string } | null>(
    null
  );
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(
    null
  );
  const toastTimerRef = useRef<number | null>(null);
  const isNative =
    typeof Capacitor !== "undefined" && Capacitor.isNativePlatform();

  const showToast = useCallback((text: string, tone: ToastTone = "info") => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ text, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const getActiveBuildId = useCallback(async (): Promise<string> => {
    // The build we last applied on this device is the single source of truth,
    // so an already-applied version is never offered again.
    const stored = window.localStorage.getItem("vedhas_active_build");
    if (stored) return stored;

    if (!isNative) return APP_BUILD_ID;

    try {
      const cur = await CapacitorUpdater.current();
      if (cur.bundle && cur.bundle.id !== "builtin") {
        if (cur.bundle.version) return cur.bundle.version;
        if (cur.bundle.id) return cur.bundle.id;
      }
    } catch {
      // fall through to the bundled build id
    }
    return APP_BUILD_ID;
  }, [isNative]);

  const checkForUpdate = useCallback(async () => {
    if (checking || open) return;
    setChecking(true);
    showToast("Checking for updates…", "info");

    const latestInfo = await fetchLatest();
    if (!latestInfo) {
      setChecking(false);
      showToast("Couldn't check for updates. Check your internet.", "error");
      return;
    }

    const activeId = await getActiveBuildId();
    const hasUpdate = latestInfo.buildId !== activeId;

    setChecking(false);
    if (hasUpdate) {
      setLatest(latestInfo);
      setOpen(true);
    } else {
      showToast("You are with the latest update", "success");
    }
  }, [checking, open, getActiveBuildId, showToast]);

  useEffect(() => {
    if (!isNative) return;

    let cancelled = false;
    // Tell the native updater the currently running bundle is fine.
    CapacitorUpdater.notifyAppReady().catch(() => {});

    // Updates are manual: only run a check when the header button fires this.
    const onManualCheck = () => {
      if (!cancelled) checkForUpdate();
    };
    window.addEventListener("vedhas:check-update", onManualCheck);

    return () => {
      cancelled = true;
      window.removeEventListener("vedhas:check-update", onManualCheck);
    };
  }, [isNative, checkForUpdate]);

  async function applyUpdate() {
    if (!latest || updating) return;
    setUpdating(true);
    try {
      if (isNative) {
        const bundle = await CapacitorUpdater.download({
          // ?v= busts the CDN cache so a freshly deployed app.zip is always fetched.
          url: `${REMOTE_ORIGIN}/app.zip?v=${latest.buildId}`,
          version: latest.buildId,
        });
        // Persist BEFORE set() because set() immediately reloads the app,
        // destroying this JS context. Guarantees an applied version is
        // never offered again on the next check.
        window.localStorage.setItem("vedhas_active_build", latest.buildId);
        await CapacitorUpdater.set({ id: bundle.id });
      } else {
        window.location.reload();
      }
    } catch {
      setUpdating(false);
      setOpen(false);
      showToast("Update failed. Try again.", "error");
    }
  }

  return (
    <>
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[70] flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-xl shadow-slate-900/10">
            {checking ? (
              <RefreshCcw className="size-4 animate-spin text-primary" />
            ) : toast.tone === "success" ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : toast.tone === "error" ? (
              <X className="size-4 text-danger" />
            ) : (
              <RefreshCcw className="size-4 text-primary" />
            )}
            {toast.text}
          </div>
        </div>
      )}

      {open && (
        <Modal onClose={() => setOpen(false)} panelClassName="p-5">
          <h3 className="mb-4 text-base font-bold text-slate-900">
            New version available
          </h3>

          <div className="flex items-start gap-3 rounded-xl bg-primary-soft px-4 py-3">
            <DownloadCloud className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="mt-0.5 text-xs font-normal text-primary/80">
                If you want the new version just click on Update, else if you
                want to stick on the version you using hit the &quot;Not now&quot;
                button and you can update later
              </p>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={updating}
              onClick={() => setOpen(false)}
            >
              Not Now
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1"
              loading={updating}
              onClick={applyUpdate}
            >
              <DownloadCloud className="size-4" />
              Update
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}