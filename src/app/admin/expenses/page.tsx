"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Banknote,
  CheckCircle2,
  Gift,
  HandCoins,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { ThemedSelect } from "@/components/ui/themed-select";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import {
  addAdvance,
  getAdvances,
  getAllowances,
  getStaffProfiles,
  removeAdvance,
  removeAllowance,
  saveAllowance,
} from "@/lib/data";
import { monthPrefix } from "@/lib/calendar";
import { formatDateFull } from "@/lib/format";
import { useSession } from "@/lib/use-session";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import type { Advance, Allowance, Profile } from "@/types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatMoney(value: number): string {
  return `₹${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function staffLabel(staff: Profile[], employeeId: string): string {
  return (
    staff.find((s) => s.employee_id === employeeId)?.full_name ?? employeeId
  );
}

type Tab = "allowance" | "advance";

const allowanceSchema = z.object({
  employee_id: z.string().min(1, "Select a staff member"),
  amount: z
    .number({ message: "Enter a valid amount" })
    .min(0, "Enter a valid amount"),
  note: z.string().optional(),
});

const advanceSchema = z.object({
  employee_id: z.string().min(1, "Select a staff member"),
  advance_date: z.string().min(1, "Select a date"),
  amount: z
    .number({ message: "Enter a valid amount" })
    .min(1, "Enter a valid amount"),
  note: z.string().optional(),
});

type AllowanceFormValues = z.infer<typeof allowanceSchema>;
type AdvanceFormValues = z.infer<typeof advanceSchema>;

function todayInputValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function AdminExpensesPage() {
  const router = useRouter();
  const { session } = useSession();

  const now = new Date();
  const [tab, setTab] = useState<Tab>("allowance");
  const [staff, setStaff] = useState<Profile[]>([]);
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [allowanceModal, setAllowanceModal] = useState<{
    editing: Allowance | null;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getStaffProfiles().catch(() => []),
      getAllowances().catch(() => []),
      getAdvances().catch(() => []),
    ]).then(([rows, al, ad]) => {
      if (!cancelled) {
        setStaff(rows);
        setAllowances(al);
        setAdvances(ad);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    if (!session) router.replace("/login");
    else if (session.role !== "admin") router.replace("/staff");
  }, [session, router]);

  const mounted = useMounted();

  const prefix = monthPrefix(now.getFullYear(), now.getMonth() + 1);
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const monthAllowances = useMemo(
    () => allowances.filter((a) => a.month === prefix),
    [allowances, prefix]
  );
  const monthAdvances = useMemo(
    () => advances.filter((a) => a.advance_date.startsWith(prefix)),
    [advances, prefix]
  );
  const totalAllowance = monthAllowances.reduce((s, a) => s + a.amount, 0);
  const totalAdvance = monthAdvances.reduce((s, a) => s + a.amount, 0);

  if (!mounted) {
    return <BrandedLoading />;
  }

  if (!session) {
    return null;
  }

  if (session.role !== "admin") {
    return null;
  }

  async function handleSaveAllowance(input: {
    employeeId: string;
    amount: number;
    note?: string;
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    const result = await saveAllowance({
      employeeId: input.employeeId,
      month: prefix,
      amount: input.amount,
      note: input.note,
    });
    if (!result.ok) {
      setError(result.message);
      return result;
    }
    setSuccess(`Allowance saved for ${staffLabel(staff, input.employeeId)}.`);
    setAllowanceModal(null);
    setVersion((v) => v + 1);
    return { ok: true };
  }

  async function handleAddAllowance(input: {
    employeeId: string;
    amount: number;
    note?: string;
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    const result = await saveAllowance({
      employeeId: input.employeeId,
      month: prefix,
      amount: input.amount,
      note: input.note,
    });
    if (!result.ok) return result;
    setVersion((v) => v + 1);
    return { ok: true };
  }

  async function handleRemoveAllowance(id: string) {
    setError(null);
    setBusyId(id);
    const result = await removeAllowance(id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setVersion((v) => v + 1);
  }

  async function handleAddAdvance(input: {
    employeeId: string;
    advanceDate: string;
    amount: number;
    note?: string;
  }) {
    setError(null);
    const result = await addAdvance({
      employeeId: input.employeeId,
      advanceDate: input.advanceDate,
      amount: input.amount,
      note: input.note,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess(
      `Advance of ${formatMoney(input.amount)} saved for ${staffLabel(
        staff,
        input.employeeId
      )}.`
    );
    setVersion((v) => v + 1);
  }

  async function handleRemoveAdvance(id: string) {
    setError(null);
    setBusyId(id);
    const result = await removeAdvance(id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setVersion((v) => v + 1);
  }

  return (
    <AppShell role={session.role} name={session.name} employeeId={session.employeeId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Expenses
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {monthLabel} · Allowances are paid separately and not part of net
            pay · Advances are deducted from pay
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={`Allowance · ${monthLabel}`}
          value={formatMoney(totalAllowance)}
          icon={Gift}
          tone="green"
        />
        <StatCard
          label={`Advance · ${monthLabel}`}
          value={formatMoney(totalAdvance)}
          icon={HandCoins}
          tone="red"
        />
      </div>

      <div className="mb-5 flex justify-center">
        <div className="relative flex w-max rounded-xl bg-slate-100 p-1">
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white shadow-sm transition-transform duration-300 ease-in-out",
              tab === "advance" && "translate-x-full"
            )}
          />
          <button
            type="button"
            onClick={() => setTab("allowance")}
            className={cn(
              "relative z-10 flex w-36 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-300",
              tab === "allowance" ? "text-primary" : "text-slate-600"
            )}
          >
            <Gift className="size-4" />
            Allowance
          </button>
          <button
            type="button"
            onClick={() => setTab("advance")}
            className={cn(
              "relative z-10 flex w-36 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-300",
              tab === "advance" ? "text-primary" : "text-slate-600"
            )}
          >
            <HandCoins className="size-4" />
            Advance
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          {success}
        </div>
      )}

      <div key={tab} className="animate-fade-in">
        {tab === "allowance" ? (
          <div className="grid gap-5 lg:grid-cols-2">
          <AllowanceFormCard staff={staff} onSubmit={handleAddAllowance} />

          <Card>
          <CardHeader
            title={`Allowances · ${monthLabel}`}
            subtitle="Paid separately on top of salary, not added to net pay"
            action={
              <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                <Gift className="size-3.5" />
                {monthAllowances.length} record
                {monthAllowances.length === 1 ? "" : "s"}
              </span>
            }
          />
          <CardBody>
            {monthAllowances.length === 0 ? (
              <EmptyState
                title="No allowances this month"
                description="Allowances are paid separately, on top of salary. Add one for a staff member to see it in Salary to Pay."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Staff</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Note</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {monthAllowances.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                              {staffLabel(staff, a.employee_id)
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-800">
                                {staffLabel(staff, a.employee_id)}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400">
                                {a.employee_id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-success">
                          {formatMoney(a.amount)}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">
                          {a.note ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAllowanceModal({ editing: a })}
                              className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              title="Edit"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={busyId === a.id}
                              onClick={() => handleRemoveAllowance(a.id)}
                              className="flex size-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft disabled:opacity-60"
                              title="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <AdvanceFormCard staff={staff} onSubmit={handleAddAdvance} />

          <Card>
            <CardHeader
              title={`Advances · ${monthLabel}`}
              subtitle="Recorded advances are deducted from net pay"
              action={
                <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                  <HandCoins className="size-3.5" />
                  {monthAdvances.length} record
                  {monthAdvances.length === 1 ? "" : "s"}
                </span>
              }
            />
            <CardBody>
              {monthAdvances.length === 0 ? (
                <EmptyState
                  title="No advances this month"
                  description="Advances given to staff are subtracted from their pay. Use the form to record one."
                />
              ) : (
                <div className="space-y-2">
                  {monthAdvances.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-sm font-bold text-danger">
                        {staffLabel(staff, a.employee_id)
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {staffLabel(staff, a.employee_id)}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {formatDateFull(a.advance_date)}
                          {a.note ? ` · ${a.note}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 whitespace-nowrap text-[clamp(0.625rem,2.7vw,0.9375rem)] font-bold tabular-nums text-danger">
                        {formatMoney(a.amount)}
                      </p>
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => handleRemoveAdvance(a.id)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft disabled:opacity-60"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
      </div>

      {allowanceModal && (
        <AllowanceModal
          staff={staff}
          editing={allowanceModal.editing}
          onSaved={(values) =>
            handleSaveAllowance({
              employeeId: values.employee_id,
              amount: values.amount,
              note: values.note,
            })
          }
          onClose={() => {
            setAllowanceModal(null);
            setError(null);
          }}
        />
      )}
    </AppShell>
  );
}

function AdvanceFormCard({
  staff,
  onSubmit,
}: {
  staff: Profile[];
  onSubmit: (input: {
    employeeId: string;
    advanceDate: string;
    amount: number;
    note?: string;
  }) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<AdvanceFormValues>({
    resolver: zodResolver(advanceSchema),
    defaultValues: {
      employee_id: "",
      advance_date: todayInputValue(),
      amount: 0,
      note: "",
    },
  });

  async function onFormSubmit(values: AdvanceFormValues) {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await onSubmit({
        employeeId: values.employee_id,
        advanceDate: values.advance_date,
        amount: values.amount,
        note: values.note,
      });
      setSuccess(
        `Advance of ${formatMoney(values.amount)} recorded for ${staffLabel(
          staff,
          values.employee_id
        )}.`
      );
      reset({ employee_id: "", advance_date: todayInputValue(), amount: 0, note: "" });
    } catch {
      setError("Unable to save the advance.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Record Advance"
        subtitle="Money given to a staff member ahead of their pay"
      />
      <CardBody>
        {success && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="advance_employee_id">Staff member</Label>
            <Controller
              name="employee_id"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ThemedSelect
                      id="advance_employee_id"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select a staff member…"
                      options={staff
                        .filter((s) => s.role === "staff")
                        .map((s) => ({
                          value: s.employee_id,
                          label: `${s.full_name} (${s.employee_id})`,
                        }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => field.onChange("")}
                    disabled={!field.value}
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Clear selection"
                    aria-label="Clear staff selection"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}
            />
            <FieldError message={errors.employee_id?.message} />
          </div>

          <div>
            <Label htmlFor="advance_date">Date given</Label>
            <Controller
              name="advance_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="advance_date"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Date given"
                />
              )}
            />
            <FieldError message={errors.advance_date?.message} />
          </div>

          <div>
            <Label htmlFor="advance_amount">Amount (₹)</Label>
            <Input
              id="advance_amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 5000"
              autoComplete="off"
              {...register("amount", { valueAsNumber: true })}
            />
            <FieldError message={errors.amount?.message} />
          </div>

          <div>
            <Label htmlFor="advance_note">Note (optional)</Label>
            <Input
              id="advance_note"
              type="text"
              placeholder="e.g. medical emergency"
              autoComplete="off"
              {...register("note")}
            />
            <FieldError message={errors.note?.message} />
          </div>

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            <HandCoins className="size-4" />
            Save Advance
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function AllowanceFormCard({
  staff,
  onSubmit,
}: {
  staff: Profile[];
  onSubmit: (input: {
    employeeId: string;
    amount: number;
    note?: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AllowanceFormValues>({
    resolver: zodResolver(allowanceSchema),
    defaultValues: {
      employee_id: "",
      amount: 0,
      note: "",
    },
  });

  async function onFormSubmit(values: AllowanceFormValues) {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const result = await onSubmit({
      employeeId: values.employee_id,
      amount: values.amount,
      note: values.note,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess(`Allowance saved for ${staffLabel(staff, values.employee_id)}.`);
    reset({ employee_id: "", amount: 0, note: "" });
  }

  return (
    <Card>
      <CardHeader
        title="Add Allowance"
        subtitle="Paid separately on top of salary, not part of net pay"
      />
      <CardBody>
        {success && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="allowance_employee_id">Staff member</Label>
            <Controller
              name="employee_id"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ThemedSelect
                      id="allowance_employee_id"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select a staff member…"
                      options={staff
                        .filter((s) => s.role === "staff")
                        .map((s) => ({
                          value: s.employee_id,
                          label: `${s.full_name} (${s.employee_id})`,
                        }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => field.onChange("")}
                    disabled={!field.value}
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Clear selection"
                    aria-label="Clear staff selection"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}
            />
            <FieldError message={errors.employee_id?.message} />
          </div>

          <div>
            <Label htmlFor="allowance_amount">Amount (₹)</Label>
            <Input
              id="allowance_amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 1000"
              autoComplete="off"
              {...register("amount", { valueAsNumber: true })}
            />
            <FieldError message={errors.amount?.message} />
          </div>

          <div>
            <Label htmlFor="allowance_note">Note (optional)</Label>
            <Input
              id="allowance_note"
              type="text"
              placeholder="e.g. travel allowance"
              autoComplete="off"
              {...register("note")}
            />
            <FieldError message={errors.note?.message} />
          </div>

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            <Banknote className="size-4" />
            Add Allowance
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function AllowanceModal({
  staff,
  editing,
  onSaved,
  onClose,
}: {
  staff: Profile[];
  editing: Allowance | null;
  onSaved: (values: AllowanceFormValues) => Promise<
    { ok: true } | { ok: false; message: string }
  >;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AllowanceFormValues>({
    resolver: zodResolver(allowanceSchema),
    defaultValues: {
      employee_id: editing?.employee_id ?? "",
      amount: editing?.amount ?? 0,
      note: editing?.note ?? "",
    },
  });

  async function onSubmit(values: AllowanceFormValues) {
    setError(null);
    setSubmitting(true);
    const result = await onSaved(values);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <Modal onClose={onClose} panelClassName="p-5">
      <h3 className="mb-4 text-base font-bold text-slate-900">
        {editing ? "Edit Allowance" : "Add Allowance"}
      </h3>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="allowance_employee_id">Staff member</Label>
            <Controller
              name="employee_id"
              control={control}
              render={({ field }) => (
                <ThemedSelect
                  id="allowance_employee_id"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!!editing}
                  placeholder={
                    editing
                      ? staffLabel(staff, editing.employee_id)
                      : "Select a staff member…"
                  }
                  options={staff
                    .filter((s) => s.role === "staff")
                    .map((s) => ({
                      value: s.employee_id,
                      label: `${s.full_name} (${s.employee_id})`,
                    }))}
                />
              )}
            />
            <FieldError message={errors.employee_id?.message} />
          </div>

          <div>
            <Label htmlFor="allowance_amount">Amount (₹)</Label>
            <Input
              id="allowance_amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 1000"
              autoComplete="off"
              {...register("amount", { valueAsNumber: true })}
            />
            <FieldError message={errors.amount?.message} />
          </div>

          <div>
            <Label htmlFor="allowance_note">Note (optional)</Label>
            <Input
              id="allowance_note"
              type="text"
              placeholder="e.g. travel allowance"
              autoComplete="off"
              {...register("note")}
            />
            <FieldError message={errors.note?.message} />
          </div>

          {error && (
            <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            <Banknote className="size-4" />
            {editing ? "Save Changes" : "Add Allowance"}
          </Button>
      </form>
    </Modal>
  );
}