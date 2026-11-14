"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import {
  StatusBar,
  StatusBarStyle,
} from "@capacitor/status-bar";
import {
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCcw,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { Role } from "@/types";
import {
  getPendingPermissions,
  getUpcomingLeaveRequests,
  logout,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  notification?: "upcomingOff" | "permissions";
}

const staffNav: NavItem[] = [
  { href: "/staff", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff/requests", label: "Request Status", icon: ClipboardCheck },
  { href: "/staff/history", label: "History", icon: History },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/report", label: "Attendance Report", icon: ClipboardList },
  {
    href: "/admin/upcoming-off",
    label: "Upcoming Off",
    icon: CalendarDays,
    notification: "upcomingOff",
  },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const superadminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/report", label: "Attendance Report", icon: ClipboardList },
  {
    href: "/admin/upcoming-off",
    label: "Upcoming Off",
    icon: CalendarDays,
    notification: "upcomingOff",
  },
  {
    href: "/admin/permissions",
    label: "Permission Requests",
    icon: ShieldCheck,
    notification: "permissions",
  },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/pay", label: "Salary to Pay", icon: Wallet },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function isActive(href: string, pathname: string) {
  return href === "/staff" || href === "/admin" || href === "/superadmin"
    ? pathname === href
    : pathname.startsWith(href);
}

export function AppShell({
  role,
  name,
  employeeId,
  children,
}: {
  role: Role;
  name: string;
  employeeId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav =
    role === "superadmin"
      ? superadminNav.map((item, index) =>
          index === 0 ? { ...item, href: "/superadmin" } : item
        )
      : role === "admin"
        ? adminNav
        : staffNav;
  const isNative =
    typeof Capacitor !== "undefined" && Capacitor.isNativePlatform();
  const homeHref =
    role === "superadmin"
      ? "/superadmin"
      : role === "admin"
        ? "/admin"
        : "/staff";
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState({
    upcomingOff: false,
    permissions: false,
  });
  const [notificationError, setNotificationError] = useState<string | null>(
    null
  );
  const activeItem = nav.find((item) => isActive(item.href, pathname));
  const hasNotifications =
    pendingNotifications.upcomingOff ||
    (role === "superadmin" && pendingNotifications.permissions);

  useEffect(() => {
    if (isNative) {
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setStyle({ style: StatusBarStyle.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: "#0a1224" }).catch(() => {});
    }
  }, [isNative]);

  useEffect(() => {
    if (menuOpen || logoutOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [menuOpen, logoutOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!logoutOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLogoutOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logoutOpen]);

  useEffect(() => {
    if (role !== "admin" && role !== "superadmin") return;
    let active = true;
    let loading = false;

    async function refreshNotifications() {
      if (loading) return;
      loading = true;
      try {
        const [leaves, permissions] = await Promise.all([
          getUpcomingLeaveRequests(),
          role === "superadmin" ? getPendingPermissions() : Promise.resolve([]),
        ]);
        if (!active) return;
        setPendingNotifications({
          upcomingOff: leaves.some(({ leave }) => leave.status === "pending"),
          permissions: permissions.length > 0,
        });
        setNotificationError(null);
      } catch (error) {
        if (!active) return;
        setNotificationError(
          error instanceof Error
            ? error.message
            : "Unable to load pending request notifications."
        );
      } finally {
        loading = false;
      }
    }

    const refresh = () => {
      void refreshNotifications();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("vedhas:refresh-notifications", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("vedhas:refresh-notifications", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [role]);

  async function handleLogout() {
    setSigningOut(true);
    try {
      logout();
      const { createBrowserClient } = await import("@/lib/supabase/client");
      await createBrowserClient()?.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur">
        <div className="relative mx-auto flex h-20 max-w-6xl items-center gap-3 px-4">
          <Link href={homeHref} className="flex shrink-0 items-center gap-3">
            <span className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-white p-1 ring-1 ring-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/vc_logo.png"
                alt="Vedhas HR"
                className="size-full object-contain"
              />
            </span>
            <span className="hidden text-xl font-bold tracking-tight text-slate-900 sm:block">
              Vedhas HR
            </span>
          </Link>

          <span className="pointer-events-none absolute left-1/2 w-full max-w-[60%] -translate-x-1/2 truncate text-center text-base font-bold text-slate-900">
            {activeItem?.label ?? ""}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div className="mr-2 hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-900">
                {name}
              </p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {employeeId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label={
                hasNotifications
                  ? "Open menu, pending requests"
                  : "Open menu"
              }
            >
              <span className="relative inline-flex">
                <Menu className="size-5" />
                {hasNotifications && (
                  <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-danger ring-2 ring-white" />
                )}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-50",
          !menuOpen && "pointer-events-none"
        )}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ease-out",
            menuOpen ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "absolute bottom-0 right-0 top-0 flex w-72 max-w-[85vw] flex-col rounded-l-2xl bg-white shadow-2xl transition-transform duration-300 ease-out",
            menuOpen ? "translate-x-0" : "translate-x-full"
          )}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center overflow-hidden rounded-full bg-white p-0.5 ring-1 ring-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/vc_logo.png"
                  alt="Vedhas HR"
                  className="size-full object-contain"
                />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight text-slate-900">
                  {name}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {employeeId}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="flex size-9 items-center justify-center rounded-lg bg-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-300"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {notificationError && (
              <p
                role="alert"
                className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger"
              >
                Unable to load request notifications: {notificationError}
              </p>
            )}
            {nav.map((item) => {
              const active = isActive(item.href, pathname);
              const showNotification =
                item.notification === "upcomingOff"
                  ? pendingNotifications.upcomingOff
                  : item.notification === "permissions" &&
                    pendingNotifications.permissions;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-label={
                    showNotification
                      ? `${item.label}, pending requests`
                      : item.label
                  }
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <span className="relative inline-flex">
                    <item.icon className="size-5" />
                    {showNotification && (
                      <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-danger ring-2 ring-white" />
                    )}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {active && <span className="size-1.5 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-3">
            {isNative && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  window.dispatchEvent(new CustomEvent("vedhas:check-update"));
                }}
                className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                <RefreshCcw className="size-5" />
                Check for updates
              </button>
            )}
            <button
              onClick={() => {
                setMenuOpen(false);
                setLogoutOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="size-5" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {logoutOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setLogoutOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-50">
                <LogOut className="size-6 text-danger" />
              </span>
            </div>
            <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900">
              Sign out of Vedhas HR?
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Are you sure you want to sign out? You will need to sign in again
              to access your attendance and reports.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setLogoutOpen(false)}
                disabled={signingOut}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="lg"
                loading={signingOut}
                onClick={handleLogout}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))] pt-6">
        {children}
      </main>
    </div>
  );
}