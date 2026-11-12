"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { addStaffMember, nextEmployeeId, saveSalary } from "@/lib/data";

const staffSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  employee_id: z.string().min(2, "Employee ID is required"),
  designation: z.string().min(2, "Designation is required"),
  salary: z
    .string()
    .min(1, "Salary is required (enter 0 for nil)")
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
    }, "Enter a whole number (0 for nil)"),
});

type StaffFormValues = z.infer<typeof staffSchema>;

export function AddStaffModal({
  suggestedId,
  onAdded,
  onClose,
}: {
  suggestedId: string;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    name: string;
    employeeId: string;
    designation: string;
    salary?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      full_name: "",
      employee_id: suggestedId,
      designation: "",
      salary: "",
    },
  });

  async function onSubmit(values: StaffFormValues) {
    setError(null);
    setSubmitting(true);

    const salaryNum = Number(values.salary);
    const salary = salaryNum >= 1 ? salaryNum : null;

    const result = await addStaffMember({
      fullName: values.full_name,
      employeeId: values.employee_id,
      designation: values.designation,
    });

    if (!result.ok) {
      setError(result.message);
      setSubmitting(false);
      return;
    }

    if (salary !== null) {
      const salResult = await saveSalary({
        employeeId: result.profile.employee_id,
        employeeName: result.profile.full_name,
        salary,
      });
      if (!salResult.ok) {
        setError(
          `Staff added but salary could not be saved: ${salResult.message}`
        );
      }
    }

    setSuccess({
      name: result.profile.full_name,
      employeeId: result.profile.employee_id,
      designation: result.profile.designation ?? "",
      salary: salary !== null ? salary.toLocaleString() : undefined,
    });
    const nextId = await nextEmployeeId("staff");
    reset({ full_name: "", employee_id: nextId, designation: "", salary: "" });
    onAdded();
  }

  return (
    <Modal onClose={onClose} panelClassName="p-5">
      <h3 className="mb-4 text-base font-bold text-slate-900">
        Add Staff Member
      </h3>

        {success ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">{success.name} added successfully.</p>
                <p className="mt-0.5 font-mono text-xs font-normal">
                  {success.employeeId} · {success.designation}
                  {success.salary ? ` · ₹${success.salary}` : ""}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => setSuccess(null)}>
                Add another
              </Button>
              <Button type="button" variant="primary" size="lg" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                placeholder="e.g.Sanjeeth"
                autoComplete="off"
                {...register("full_name")}
              />
              <FieldError message={errors.full_name?.message} />
            </div>

            <div>
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                placeholder="e.g.Marketing Staff/Accountant"
                autoComplete="off"
                {...register("designation")}
              />
              <FieldError message={errors.designation?.message} />
            </div>

            <div>
              <Label htmlFor="employee_id">Employee ID</Label>
              <Input
                id="employee_id"
                autoComplete="off"
                {...register("employee_id")}
              />
              <FieldError message={errors.employee_id?.message} />
            </div>

            <div>
              <Label htmlFor="salary">
                Monthly Salary (₹)
              </Label>
              <Input
                id="salary"
                type="number"
                step="1"
                min="0"
                placeholder="Enter 0 for nil, e.g. 25000"
                autoComplete="off"
                {...register("salary")}
              />
              <FieldError message={errors.salary?.message} />
            </div>

            {error && (
              <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              <UserPlus className="size-4" />
              Add Staff
            </Button>

            <p className="text-center text-[11px] text-slate-400">
              The staff member signs in with their Employee ID.
            </p>
        </form>
      )}
    </Modal>
  );
}