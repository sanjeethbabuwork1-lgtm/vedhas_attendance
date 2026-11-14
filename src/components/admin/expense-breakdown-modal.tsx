"use client";

import { useMemo } from "react";
import { Banknote, Gift, X } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldError, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatDateFull } from "@/lib/format";
import type { ExpenseOrganization } from "@/types";

export interface ExpenseBreakdownEntry {
  id: string;
  date: string;
  person: string;
  organization: ExpenseOrganization | null;
  particulars: string;
  amount: number;
}

export function ExpenseBreakdownModal({
  type,
  entries,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onClose,
}: {
  type: "allowance" | "professional";
  entries: ExpenseBreakdownEntry[];
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onClose: () => void;
}) {
  const isInvalidRange = Boolean(fromDate && toDate && fromDate > toDate);
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, ExpenseBreakdownEntry[]>();
    for (const entry of entries) {
      if (fromDate && entry.date < fromDate) continue;
      if (toDate && entry.date > toDate) continue;
      const group = groups.get(entry.date) ?? [];
      group.push(entry);
      groups.set(entry.date, group);
    }

    return [...groups.entries()]
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, rows]) => ({
        date,
        rows,
        total: rows.reduce((sum, row) => sum + row.amount, 0),
      }));
  }, [entries, fromDate, toDate]);
  const total = groupedEntries.reduce((sum, group) => sum + group.total, 0);
  const recordCount = groupedEntries.reduce(
    (sum, group) => sum + group.rows.length,
    0
  );
  const title =
    type === "allowance" ? "Allowance details" : "Professional expense details";
  const Icon = type === "allowance" ? Gift : Banknote;

  return (
    <Modal
      onClose={onClose}
      panelClassName="max-w-2xl p-4 sm:p-6"
      ariaLabelledBy="expense-breakdown-title"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2
              id="expense-breakdown-title"
              className="text-lg font-bold text-slate-900"
            >
              {title}
            </h2>
            <p className="text-sm text-slate-500">
              {recordCount} record{recordCount === 1 ? "" : "s"} ·{" "}
              <span className="font-semibold tabular-nums text-slate-800">
                ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close expense details"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <Label htmlFor="expense_breakdown_from">From date</Label>
          <DatePicker
            id="expense_breakdown_from"
            value={fromDate}
            onChange={onFromDateChange}
            placeholder="Any start date"
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor="expense_breakdown_to">To date</Label>
          <DatePicker
            id="expense_breakdown_to"
            value={toDate}
            onChange={onToDateChange}
            placeholder="Any end date"
          />
        </div>
      </div>
      <FieldError
        message={isInvalidRange ? "The start date must be before the end date." : undefined}
      />

      <div className="mt-3 max-h-[52dvh] space-y-4 overflow-y-auto pr-1">
        {isInvalidRange ? null : groupedEntries.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No records found for the selected dates.
          </p>
        ) : (
          groupedEntries.map((group) => (
            <section
              key={group.date}
              className="overflow-hidden rounded-xl border border-slate-200"
            >
              <header className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2.5">
                <h3 className="text-sm font-semibold text-slate-800">
                  {formatDateFull(group.date)}
                </h3>
                <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                  ₹
                  {group.total.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </header>
              <ul className="divide-y divide-slate-100 px-3">
                {group.rows.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex min-w-0 items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-800">
                        {entry.person}
                      </p>
                      <p className="break-words text-xs text-slate-500">
                        {[entry.organization, entry.particulars]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">
                      ₹
                      {entry.amount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </Modal>
  );
}
