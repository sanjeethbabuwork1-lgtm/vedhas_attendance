"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { ThemedSelect } from "@/components/ui/themed-select";
import { Modal } from "@/components/ui/modal";
import { saveSalary } from "@/lib/data";
import type { Profile, Salary } from "@/types";

const salarySchema = z.object({
  employee_id: z.string().min(1, "Select a staff member"),
  salary: z
    .number({ message: "Enter a valid salary" })
    .min(1, "Enter a valid salary"),
});

type SalaryFormValues = z.infer<typeof salarySchema>;

type SalaryDraft = {
  employee_id: string;
  employee_name?: string;
  salary: number;
};

export function SalaryModal({
  staff,
  editing,
  editingProfile,
  onSaved,
  onClose,
}: {
  staff: Profile[];
  editing: SalaryDraft | null;
  editingProfile?: Profile | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<Salary | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<SalaryFormValues>({
    resolver: zodResolver(salarySchema),
    defaultValues: {
      employee_id:
        editing?.employee_id ?? editingProfile?.employee_id ?? "",
      salary: editing?.salary ?? 0,
    },
  });

  const selectedId = watch("employee_id");
  const selectedStaff = staff.find((s) => s.employee_id === selectedId);

  async function onSubmit(values: SalaryFormValues) {
    setError(null);
    setSubmitting(true);
    const result = await saveSalary({
      employeeId: values.employee_id,
      employeeName:
        editing?.employee_name ??
        editingProfile?.full_name ??
        staff.find((s) => s.employee_id === values.employee_id)?.full_name ??
        "",
      salary: values.salary,
    });

    if (!result.ok) {
      setError(result.message);
      setSubmitting(false);
      return;
    }

    setSuccess(result.salary);
    onSaved();
  }

  return (
    <Modal onClose={onClose} panelClassName="p-5">
      <h3 className="mb-4 text-base font-bold text-slate-900">
        {editing ? "Edit Salary" : "Add Salary"}
      </h3>

        {success ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  Salary saved for {success.employee_name}.
                </p>
                <p className="mt-0.5 font-mono text-xs font-normal">
                  {success.employee_id} · ₹{success.salary.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" size="lg" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="employee_id">Staff member</Label>
              <Controller
                name="employee_id"
                control={control}
                render={({ field }) => (
                  <ThemedSelect
                    id="employee_id"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={
                      editing ? editing.employee_name : "Select a staff member…"
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
              <Label htmlFor="salary">Salary (₹)</Label>
              <Input
                id="salary"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 25000"
                autoComplete="off"
                {...register("salary", { valueAsNumber: true })}
              />
              <FieldError message={errors.salary?.message} />
            </div>

            {selectedStaff && (
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                  {selectedStaff.full_name}
                </span>{" "}
                · {selectedStaff.employee_id}
                {selectedStaff.designation
                  ? ` · ${selectedStaff.designation}`
                  : ""}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              <Banknote className="size-4" />
              {editing ? "Save Changes" : "Add Salary"}
            </Button>
          </form>
        )}
    </Modal>
  );
}
