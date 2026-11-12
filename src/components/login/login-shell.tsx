"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { StatusBar, StatusBarStyle } from "@capacitor/status-bar";
import { LoginForm } from "./login-form";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { getSession } from "@/lib/session";

export function LoginShell() {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [session] = useState(() => getSession());

  useEffect(() => {
    if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: StatusBarStyle.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: "#0a1224" }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    router.replace(session.role === "admin" ? "/admin" : "/staff");
  }, [session, router]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -py * 8, y: px * 10 });
  }

  if (session) {
    return <BrandedLoading />;
  }

  return (
    <div className="relative min-h-dvh select-none overflow-hidden bg-[#0a1224]">
      {/* Ambient animated orbs */}
      <div
        aria-hidden
        className="animate-orb pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full bg-blue-600/45 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-orb-2 pointer-events-none absolute -right-40 top-1/3 size-[26rem] rounded-full bg-cyan-400/35 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-orb-3 pointer-events-none absolute -bottom-40 left-1/4 size-[24rem] rounded-full bg-indigo-500/40 blur-3xl"
      />

      <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="animate-logo-in mb-7 text-center">
            <div className="mx-auto mb-6 flex size-28 items-center justify-center overflow-hidden rounded-full bg-white p-2 shadow-2xl shadow-blue-950/60 ring-1 ring-white/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/vc_logo.png"
                alt="Vedhas HR Portal"
                draggable={false}
                className="size-full select-none object-contain [-webkit-user-drag:none]"
              />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
              Vedhas HR
            </h1>
            <p className="mt-1.5 text-sm font-medium text-blue-200/90">
              Your Perfect Monitor
            </p>
          </div>

          <div className="animate-card-in" style={{ perspective: "1100px" }}>
            <div
              ref={cardRef}
              onMouseMove={onMove}
              onMouseLeave={() => setTilt({ x: 0, y: 0 })}
              className="rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl shadow-blue-950/50"
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: "transform 0.15s ease-out",
                transformStyle: "preserve-3d",
              }}
            >
              <LoginForm />
            </div>
          </div>

          <p className="animate-login-fade-up mt-6 text-center text-[11px] leading-relaxed text-blue-200/70">
            Attendance is recorded only when you are physically inside the
            organization geofence using real browser GPS.
          </p>
        </div>
      </main>
    </div>
  );
}