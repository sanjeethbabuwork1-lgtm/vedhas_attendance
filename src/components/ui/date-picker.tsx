"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eraser,
} from "lucide-react";
import { formatDateFull, pad2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/use-scroll-lock";

function toKey(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseKey(key: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Select date",
  min,
  max,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
}) {
  const today = toKey(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    new Date().getDate()
  );
  const initial = parseKey(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(
    initial
      ? { y: initial.y, m: initial.m }
      : { y: new Date().getFullYear(), m: new Date().getMonth() + 1 }
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useScrollLock(open);

  const days = useMemo(() => {
    const firstDay = new Date(view.y, view.m - 1, 1);
    const leading = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(view.y, view.m, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toKey(view.y, view.m, d));
    return cells;
  }, [view]);

  function openDialog() {
    const p = parseKey(value);
    setView(
      p
        ? { y: p.y, m: p.m }
        : { y: new Date().getFullYear(), m: new Date().getMonth() + 1 }
    );
    setOpen(true);
  }

  function prevMonth() {
    setView((v) =>
      v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }
    );
  }

  function nextMonth() {
    setView((v) =>
      v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }
    );
  }

  function isDisabled(key: string): boolean {
    if (min && key < min) return true;
    if (max && key > max) return true;
    return false;
  }

  return (
    <>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={openDialog}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          "border-slate-300 hover:border-slate-400",
          value ? "text-slate-900" : "text-slate-400"
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate">
          {value ? formatDateFull(value) : placeholder}
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
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <p className="text-base font-bold text-slate-900">
                  {value ? formatDateFull(value) : "Select date"}
                </p>
              </div>

              <div className="px-5 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={prevMonth}
                    aria-label="Previous month"
                    className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="text-sm font-semibold text-slate-800">
                    {MONTHS[view.m - 1]} {view.y}
                  </p>
                  <button
                    type="button"
                    onClick={nextMonth}
                    aria-label="Next month"
                    className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS.map((w) => (
                    <span
                      key={w}
                      className="py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {w}
                    </span>
                  ))}
                  {days.map((key, i) =>
                    key === null ? (
                      <span key={`blank-${i}`} />
                    ) : (
                      <button
                        key={key}
                        type="button"
                        disabled={isDisabled(key)}
                        onClick={() => {
                          onChange(key);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-lg text-sm transition-colors",
                          "disabled:cursor-not-allowed disabled:text-slate-200",
                          !isDisabled(key) &&
                            (key === value
                              ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                              : "text-slate-700 hover:bg-primary-soft"),
                          key === today &&
                            key !== value &&
                            "font-semibold text-primary ring-1 ring-primary/40"
                        )}
                      >
                        {Number(key.slice(8, 10))}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700"
                >
                  <Eraser className="size-3.5" />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(today);
                    setOpen(false);
                  }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Today
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}