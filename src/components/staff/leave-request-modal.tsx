"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import { requestLeave } from "@/lib/data";
import { formatDateFull } from "@/lib/format";
import type { LeaveType } from "@/types";
import { cn } from "@/lib/utils";

function countDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

const LEAVE_TYPES: {
  type: LeaveType;
  label: string;
  hint: string;
}[] = [
  {
    type: "casual",
    label: "Casual Leave",
    hint: "Admin decides PTO (paid) or LOP (loss of pay).",
  },
  {
    type: "sick",
    label: "Sick Leave",
    hint: "For illness or medical needs.",
  },
  {
    type: "comp",
    label: "Comp Off",
    hint: "Compensatory off for extra working hours.",
  },
];

export function LeaveRequestModal({
  employeeId,
  onClose,
  onRequested,
}: {
  employeeId: string;
  onClose: () => void;
  onRequested: () => void;
}) {
  const [type, setType] = useState<LeaveType>("casual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const days = useMemo(() => countDays(from, to), [from, to]);
  const rangeInvalid = from !== "" && to !== "" && days === 0;
  const selected = LEAVE_TYPES.find((o) => o.type === type);

  async function handleSubmit() {
    if (!from || !to) {
      setError("Select both the from and to dates for the leave.");
      return;
    }
    if (rangeInvalid) {
      setError("The end date must be on or after the start date.");
      return;
    }
    setError(null);
    setBusy(true);
    const result = await requestLeave({
      employeeId,
      from,
      to,
      reason,
      type,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(true);
    onRequested();
  }

  return (
    <Modal
      onClose={onClose}
      backdropClassName="bg-blue-950/60"
      panelClassName="p-5"
    >
      <h3 className="mb-4 text-base font-bold text-slate-900">Request Leave</h3>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  {selected?.label} requested for{" "}
                  {days === 1 ? "1 day" : `${days} days`} (
                  {formatDateFull(from)}
                  {to !== from ? ` – ${formatDateFull(to)}` : ""}).
                </p>
                <p className="mt-0.5 text-xs font-normal text-success/80">
                  {type === "casual"
                    ? "An admin will approve it and decide whether it is PTO (paid) or LOP (loss of pay)."
                    : "An admin will approve or reject it."}
                </p>
              </div>
            </div>
            <Button type="button" size="lg" className="w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Leave type</Label>
              <div className="space-y-2">
                {LEAVE_TYPES.map((o) => {
                  const active = o.type === type;
                  return (
                    <button
                      key={o.type}
                      type="button"
                      onClick={() => setType(o.type)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary-soft/50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          active
                            ? "border-primary bg-primary"
                            : "border-slate-300"
                        )}
                      >
                        {active && <Check className="size-3 text-white" />}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">
                          {o.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {o.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="leave-from">From date</Label>
                <DatePicker
                  id="leave-from"
                  value={from}
                  onChange={setFrom}
                  max={to || undefined}
                  placeholder="From date"
                />
              </div>
              <div>
                <Label htmlFor="leave-to">To date</Label>
                <DatePicker
                  id="leave-to"
                  value={to}
                  onChange={setTo}
                  min={from || undefined}
                  placeholder="To date"
                />
              </div>
            </div>

            {rangeInvalid && (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                The end date must be on or after the start date.
              </p>
            )}

            {days > 0 && !rangeInvalid && (
              <p
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold",
                  "bg-primary-soft text-primary"
                )}
              >
                {days === 1 ? "1 day" : `${days} days`} of {selected?.label}
              </p>
            )}

            <div>
              <Label htmlFor="leave-reason">Reason (optional)</Label>
              <Input
                id="leave-reason"
                placeholder="e.g. Personal work, family occasion…"
                autoComplete="off"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={busy}
            >
              <CalendarPlus className="size-4" />
              Request {selected?.label}
            </Button>
        </form>
      )}
    </Modal>
  );
}