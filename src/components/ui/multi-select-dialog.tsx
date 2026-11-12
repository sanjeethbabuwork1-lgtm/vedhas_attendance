"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ListChecks, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export function MultiSelectDialog({
  id,
  label,
  title,
  options,
  values,
  onChange,
  placeholder = "Select…",
  confirmLabel = "Done",
  disabled,
}: {
  id?: string;
  label?: string;
  title: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);

  const selectedLabels = useMemo(
    () => options.filter((o) => values.includes(o.value)).map((o) => o.label),
    [options, values]
  );

  function openDialog() {
    setDraft(values);
    setOpen(true);
  }

  function toggle(value: string) {
    setDraft((d) =>
      d.includes(value) ? d.filter((v) => v !== value) : [...d, value]
    );
  }

  function confirm() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={openDialog}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            values.length === 0 ? "text-slate-400" : "font-medium text-slate-800"
          )}
        >
          {values.length === 0
            ? placeholder
            : `${selectedLabels.join(", ")}${values.length > 2 ? ` (+${values.length - 2} more)` : ""}`}
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <Modal
          onClose={() => setOpen(false)}
          panelClassName="flex max-h-[85vh] flex-col overflow-hidden p-5"
        >
          <h3 className="mb-4 text-base font-bold text-slate-900">{title}</h3>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <ListChecks className="size-3.5" />
                {draft.length} selected
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraft([])}
                  disabled={draft.length === 0}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X className="size-3.5" />
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(options.map((o) => o.value))}
                  disabled={options.length === 0 || draft.length === options.length}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check className="size-3.5" />
                  Select all
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
              {options.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-slate-400">
                  No staff added yet
                </p>
              ) : (
                options.map((o) => {
                  const selected = draft.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggle(o.value)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        selected
                          ? "bg-primary-soft font-semibold text-primary"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span className="min-w-0 truncate">{o.label}</span>
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          selected
                            ? "border-primary bg-primary"
                            : "border-slate-300 bg-white"
                        )}
                      >
                        {selected && <Check className="size-2.5 text-white" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={confirm}
              >
                {confirmLabel}
              </Button>
            </div>
        </Modal>
      )}
    </div>
  );
}
