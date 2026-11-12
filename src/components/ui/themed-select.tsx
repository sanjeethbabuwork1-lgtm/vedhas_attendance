"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/use-scroll-lock";

export interface ThemedOption {
  value: string;
  label: string;
}

export function ThemedSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (next: string) => void;
  options: ThemedOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useScrollLock(open);

  return (
    <>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          "border-slate-300 hover:border-slate-400",
          value ? "text-slate-900" : "text-slate-400"
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 animate-fade-in bg-blue-950/60 backdrop-blur-sm"
          />
          <div
            className="absolute inset-0 flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="animate-dialog-in max-h-[70dvh] w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <p className="text-base font-bold text-slate-900">
                  {label ?? placeholder}
                </p>
              </div>
              <div className="max-h-[55dvh] space-y-1 overflow-y-auto p-2">
                {options.map((o) => {
                  const active = o.value === value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors",
                        active
                          ? "bg-primary-soft font-semibold text-primary"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          active
                            ? "border-primary bg-primary"
                            : "border-slate-300"
                        )}
                      >
                        {active && <Check className="size-3 text-white" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}