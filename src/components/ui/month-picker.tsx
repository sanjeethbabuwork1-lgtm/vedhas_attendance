"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/use-scroll-lock";

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

function parseMonth(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function MonthPicker({
  id,
  value,
  onChange,
  placeholder = "Select month",
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(
    () => parseMonth(value)?.year ?? new Date().getFullYear()
  );
  const selected = parseMonth(value);
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useScrollLock(open);

  function openPicker() {
    setViewYear(selected?.year ?? currentYear);
    setOpen(true);
  }

  function selectMonth(month: number) {
    onChange(`${viewYear}-${String(month).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors",
          "border-slate-300 hover:border-slate-400",
          value ? "text-slate-900" : "text-slate-400"
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate">
          {selected
            ? `${MONTHS[selected.month - 1]}, ${selected.year}`
            : placeholder}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 animate-fade-in bg-blue-950/60 backdrop-blur-sm" />
          <div
            className="absolute inset-0 flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="animate-dialog-in w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-base font-bold text-slate-900">
                  Select export month
                </p>
              </div>

              <div className="px-5 pt-3">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewYear((year) => year - 1)}
                    aria-label="Previous year"
                    className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="text-sm font-semibold text-slate-800">
                    {viewYear}
                  </p>
                  <button
                    type="button"
                    onClick={() => setViewYear((year) => year + 1)}
                    aria-label="Next year"
                    className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {MONTHS.map((month, index) => {
                    const monthNumber = index + 1;
                    const isSelected =
                      selected?.year === viewYear &&
                      selected.month === monthNumber;
                    const isCurrent =
                      currentYear === viewYear && currentMonth === monthNumber;
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => selectMonth(monthNumber)}
                        className={cn(
                          "rounded-lg px-2 py-3 text-sm transition-colors",
                          isSelected
                            ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                            : "text-slate-700 hover:bg-primary-soft",
                          isCurrent &&
                            !isSelected &&
                            "font-semibold text-primary ring-1 ring-primary/40"
                        )}
                      >
                        {month.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 flex justify-end border-t border-slate-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => {
                    onChange(
                      `${currentYear}-${String(currentMonth).padStart(2, "0")}`
                    );
                    setOpen(false);
                  }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  This month
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
