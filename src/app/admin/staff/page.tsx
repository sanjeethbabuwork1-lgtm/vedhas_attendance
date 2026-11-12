"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AddStaffModal } from "@/components/admin/add-staff-modal";
import { SalaryModal } from "@/components/admin/salary-modal";
import {
  getSalaries,
  getStaffProfiles,
  nextEmployeeId,
  removeStaffMember,
} from "@/lib/data";
import { formatDateFull } from "@/lib/format";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import type { Profile, Salary } from "@/types";

export default function AdminStaffPage() {
  const router = useRouter();
  const { session } = useSession();

  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [staffVersion, setStaffVersion] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
const [staff, setStaff] = useState<Profile[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [salaryModal, setSalaryModal] = useState<{
    profile: Profile;
    salary: {
      employee_id: string;
      employee_name: string;
      salary: number;
    } | null;
  } | null>(null);
  const [suggestedId, setSuggestedId] = useState("VC001");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getStaffProfiles().catch(() => []),
      getSalaries().catch(() => []),
    ]).then(([rows, sal]) => {
      if (!cancelled) {
        setStaff(rows);
        setSalaries(sal);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [staffVersion]);

  const salaryMap = useMemo(
    () => new Map(salaries.map((s) => [s.employee_id, s.salary])),
    [salaries]
  );

  useEffect(() => {
    let cancelled = false;
    nextEmployeeId("staff")
      .then((id) => {
        if (!cancelled) setSuggestedId(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [staffVersion]);

  const filteredStaff = useMemo(() => {
    const q = query.toLowerCase().replace(/\s+/g, "");
    if (!q) return staff;
    return staff.filter((s) => {
      const haystack = [
        s.full_name,
        s.employee_id,
        s.designation ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .replace(/\s+/g, "");
      return haystack.includes(q);
    });
  }, [staff, query]);

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

  async function handleRemove(employeeId: string) {
    const result = await removeStaffMember(employeeId);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setConfirmingId(null);
    setExpandedId(null);
    setStaffVersion((v) => v + 1);
  }

  return (
    <AppShell role={session.role} name={session.name} employeeId={session.employeeId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Staff Management
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {staff.length} staff member{staff.length === 1 ? "" : "s"} · tap a
            member to view details or remove them
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => setAddStaffOpen(true)}>
            <UserPlus className="size-3.5" />
            Add Staff
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          title="All Staff"
          subtitle={`${filteredStaff.length} of ${staff.length} staff member${
            staff.length === 1 ? "" : "s"
          }`}
          action={
            <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
              <UsersRound className="size-3.5" />
              {filteredStaff.length}
            </span>
          }
        />
        <CardBody>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, employee ID, or designation…"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {filteredStaff.length === 0 ? (
            <EmptyState
              title="No matching staff"
              description={
                query
                  ? `No staff match "${query}". Try another name or ID.`
                  : "Tap Add Staff to invite your first staff member."
              }
            />
          ) : (
            <div className="space-y-2">
              {filteredStaff.map((s) => {
                const expanded = expandedId === s.employee_id;
                const confirming = confirmingId === s.employee_id;
                const salary = salaryMap.get(s.employee_id) ?? null;
                return (
                  <div
                    key={s.employee_id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedId(expanded ? null : s.employee_id);
                        setConfirmingId(null);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                        {s.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">
                          {s.full_name}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {s.designation || "Staff"}
                        </span>
                      </span>
                      <span className="hidden shrink-0 font-mono text-xs font-medium text-slate-400 sm:block">
                        {s.employee_id}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-slate-400 transition-transform",
                          expanded && "rotate-180"
                        )}
                      />
                    </button>

                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
                        <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                          <DetailRow label="Employee ID" value={s.employee_id} />
                          <DetailRow label="Designation" value={s.designation ?? "—"} />
                          <DetailRow label="Role" value={s.role === "admin" ? "Admin" : "Staff"} />
                          <DetailRow
                            label="Joined On"
                            value={formatDateFull(s.created_at)}
                          />
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Monthly Salary
                            </p>
                            <p className="mt-0.5 text-sm font-bold text-slate-900">
                              {salary ? (
                                <>
                                  ₹
                                  {salary.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                  })}
                                </>
                              ) : (
                                <span className="font-medium text-slate-400">
                                  Not set
                                </span>
                              )}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setSalaryModal({
                                profile: s,
                                salary:
                                  salary !== null
                                    ? {
                                        employee_id: s.employee_id,
                                        employee_name: s.full_name,
                                        salary,
                                      }
                                    : null,
                              })
                            }
                          >
                            <Pencil className="size-3.5" />
                            {salary ? "Edit" : "Set Salary"}
                          </Button>
                        </div>

                        {error && (
                          <div className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                            {error}
                          </div>
                        )}

                        <div className="mt-4">
                          {confirming ? (
                            <div className="rounded-xl border border-danger/20 bg-danger-soft/40 p-4">
                              <p className="text-sm font-semibold text-slate-800">
                                Remove {s.full_name}?
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                This removes their profile and all their
                                attendance records. This cannot be undone.
                              </p>
                              <div className="mt-3 flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setConfirmingId(null);
                                    setError(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleRemove(s.employee_id)}
                                >
                                  <Trash2 className="size-3.5" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setError(null);
                                setConfirmingId(s.employee_id);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {addStaffOpen && (
        <AddStaffModal
          suggestedId={suggestedId}
          onAdded={() => setStaffVersion((v) => v + 1)}
          onClose={() => setAddStaffOpen(false)}
        />
      )}

{salaryModal && (
        <SalaryModal
          staff={staff}
          editing={salaryModal.salary}
          editingProfile={salaryModal.profile}
          onSaved={() => setStaffVersion((v) => v + 1)}
          onClose={() => setSalaryModal(null)}
        />
      )}
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 truncate font-medium text-slate-800">{value}</p>
    </div>
  );
}