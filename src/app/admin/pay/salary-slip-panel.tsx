"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import type { DateRangeCalendar } from "@/lib/calendar";
import {
  getEmployeePayrollDetails,
  saveEmployeePayrollDetails,
  type PayrollRow,
} from "@/lib/data";
import { downloadSalarySlip } from "@/lib/salary-slip-pdf";
import type { EmployeePayrollDetails } from "@/types";

interface DetailsForm {
  joiningDate: string;
  pan: string;
  bankAccountNo: string;
  bankName: string;
  ifsc: string;
}

const EMPTY_FORM: DetailsForm = {
  joiningDate: "",
  pan: "",
  bankAccountNo: "",
  bankName: "",
  ifsc: "",
};

function formFromDetails(
  details: EmployeePayrollDetails | null
): DetailsForm {
  return {
    joiningDate: details?.joining_date ?? "",
    pan: details?.pan ?? "",
    bankAccountNo: details?.bank_account_no ?? "",
    bankName: details?.bank_name ?? "",
    ifsc: details?.ifsc ?? "",
  };
}

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SalarySlipPanel({
  rows,
  calendar,
  loading,
}: {
  rows: PayrollRow[];
  calendar: DateRangeCalendar | null;
  loading: boolean;
}) {
  const [selectedId, setSelectedId] = useState("");
  const selectedRow =
    rows.find((row) => row.profile.employee_id === selectedId) ?? rows[0] ?? null;

  if (rows.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-600">
            {loading
              ? "Loading payroll data…"
              : "No staff profiles were found. Add staff and set a monthly salary to generate a salary slip."}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Generate Employee Salary Slip"
        subtitle="Select an employee by ID. Personal tax and bank details are saved only for that employee."
      />
      <CardBody className="space-y-5">
        <div>
          <Label htmlFor="salary-slip-employee">Employee</Label>
          <Select
            id="salary-slip-employee"
            value={selectedRow?.profile.employee_id ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={loading}
          >
            {rows.map(({ profile }) => (
              <option key={profile.employee_id} value={profile.employee_id}>
                {profile.employee_id} · {profile.full_name}
              </option>
            ))}
          </Select>
        </div>
        {selectedRow && (
          <EmployeeSalarySlipDetails
            key={selectedRow.profile.employee_id}
            row={selectedRow}
            calendar={calendar}
            payrollLoading={loading}
          />
        )}
      </CardBody>
    </Card>
  );
}

function EmployeeSalarySlipDetails({
  row,
  calendar,
  payrollLoading,
}: {
  row: PayrollRow;
  calendar: DateRangeCalendar | null;
  payrollLoading: boolean;
}) {
  const employeeId = row.profile.employee_id;
  const payslipNetPay = Math.max(
    0,
    row.paidSalary + row.allowance - row.fineAmount - row.advance
  );
  const [details, setDetails] = useState<EmployeePayrollDetails | null>(null);
  const [form, setForm] = useState<DetailsForm>(EMPTY_FORM);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEmployeePayrollDetails(employeeId)
      .then((result) => {
        if (cancelled) return;
        setDetails(result);
        setForm(formFromDetails(result));
        setDetailsLoaded(true);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load employee payroll details."
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  function updateForm(field: keyof DetailsForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setDetailsDirty(true);
    setError(null);
    setMessage(null);
  }

  async function saveDetails() {
    if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan)) {
      setError("Enter a valid 10-character PAN.");
      return;
    }
    if (form.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc)) {
      setError("Enter a valid 11-character IFSC.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await saveEmployeePayrollDetails({
        employeeId,
        joiningDate: form.joiningDate || null,
        pan: form.pan.trim() || null,
        bankAccountNo: form.bankAccountNo.trim() || null,
        bankName: form.bankName.trim() || null,
        ifsc: form.ifsc.trim() || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDetails(result.details);
      setForm(formFromDetails(result.details));
      setDetailsDirty(false);
      setDetailsLoaded(true);
      setMessage("Employee payroll details saved.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save employee payroll details."
      );
    } finally {
      setSaving(false);
    }
  }

  async function generatePdf() {
    if (!calendar) return;
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      await downloadSalarySlip({
        row,
        details,
        from: calendar.from,
        to: calendar.to,
        calendarDays: calendar.calendarDays,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to generate salary slip."
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <p className="font-semibold text-slate-800">{row.profile.full_name}</p>
        <p className="text-xs text-slate-500">
          {employeeId}
          {row.profile.designation ? ` · ${row.profile.designation}` : ""}
        </p>
      </div>

      <div>
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-800">
            Employee details
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Leave fields blank if the information is not available. These
            details are restricted to superadmins.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="salary-slip-joining-date">Joining date</Label>
            <Input
              id="salary-slip-joining-date"
              type="date"
              value={form.joiningDate}
              disabled={loadingDetails || saving}
              onChange={(event) =>
                updateForm("joiningDate", event.target.value)
              }
            />
          </div>
          <div>
            <Label htmlFor="salary-slip-pan">PAN</Label>
            <Input
              id="salary-slip-pan"
              value={form.pan}
              maxLength={10}
              placeholder="ABCDE1234F"
              disabled={loadingDetails || saving}
              onChange={(event) =>
                updateForm("pan", event.target.value.toUpperCase())
              }
            />
          </div>
          <div>
            <Label htmlFor="salary-slip-bank-account">Bank account no.</Label>
            <Input
              id="salary-slip-bank-account"
              value={form.bankAccountNo}
              maxLength={30}
              disabled={loadingDetails || saving}
              onChange={(event) =>
                updateForm("bankAccountNo", event.target.value)
              }
            />
          </div>
          <div>
            <Label htmlFor="salary-slip-bank-name">Bank name</Label>
            <Input
              id="salary-slip-bank-name"
              value={form.bankName}
              maxLength={80}
              disabled={loadingDetails || saving}
              onChange={(event) => updateForm("bankName", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="salary-slip-ifsc">IFSC</Label>
            <Input
              id="salary-slip-ifsc"
              value={form.ifsc}
              maxLength={11}
              placeholder="ABCD0123456"
              disabled={loadingDetails || saving}
              onChange={(event) =>
                updateForm("ifsc", event.target.value.toUpperCase())
              }
            />
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success"
        >
          {message}
        </p>
      )}
      {detailsDirty && (
        <p className="text-xs text-amber-700">
          Save employee details before generating the PDF.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">
          Net salary payable:{" "}
          <span className="font-bold text-slate-900">
            {formatMoney(payslipNetPay)}
          </span>
          <span className="ml-2 text-xs text-slate-500">
            Payslip total includes allowance: {formatMoney(row.allowance)}.
          </span>
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void saveDetails()}
            loading={saving}
            disabled={loadingDetails}
          >
            Save employee details
          </Button>
          <Button
            type="button"
            onClick={() => void generatePdf()}
            loading={generating}
            disabled={
              loadingDetails ||
              !detailsLoaded ||
              payrollLoading ||
              detailsDirty ||
              row.salary <= 0 ||
              !calendar
            }
          >
            <Download className="size-4" />
            Generate PDF
          </Button>
        </div>
      </div>
      {row.salary <= 0 && (
        <p className="text-xs text-amber-700">
          Set this employee&apos;s monthly salary before generating a slip.
        </p>
      )}
      {loadingDetails && (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <FileText className="size-3.5" />
          Loading saved employee details…
        </p>
      )}
    </>
  );
}
