"use client";

import { useEffect, useState } from "react";
import {
  CalendarPlus,
  Check,
  Clock,
  Trash2,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import {
  approveLeave,
  getLeaves,
  grantLeave,
  grantLeaveForAll,
  rejectLeave,
  revokeLeave,
} from "@/lib/data";
import { formatDateFull, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  LEAVE_TYPE_LABELS,
  PAID_LEAVE_TYPES,
  type LeaveRequest,
  type Profile,
} from "@/types";

export function LeaveModal({
  profile,
  onChanged,
  onClose,
}: {
  profile: Profile;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayKey());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  async function refresh() {
    const all = await getLeaves().catch(() => []);
    setLeaves(
      all
        .filter((l) => l.employee_id === profile.employee_id)
        .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))
    );
  }

  useEffect(() => {
    let cancelled = false;
    getLeaves()
      .then((all) => {
        if (cancelled) return;
        setLeaves(
          all
            .filter((l) => l.employee_id === profile.employee_id)
            .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.employee_id]);

  async function handleAdd() {
    if (!date) {
      setError("Select a date for the leave.");
      return;
    }
    setError(null);
    setBusy(true);
    const result = await grantLeave({
      employeeId: profile.employee_id,
      attendanceDate: date,
      reason,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDate("");
    setReason("");
    onChanged();
    refresh();
  }

  async function handleAddAll() {
    if (!date) {
      setError("Select a date for the leave.");
      return;
    }
    setError(null);
    setBusyAll(true);
    const result = await grantLeaveForAll({ attendanceDate: date, reason });
    setBusyAll(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDate("");
    setReason("");
    onChanged();
    refresh();
  }

  async function handleRemove(id: string) {
    setError(null);
    const result = await revokeLeave(id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onChanged();
    refresh();
  }

  async function handleDecide(
    leave: LeaveRequest,
    action: "pto" | "lop" | "reject" | "approve"
  ) {
    setError(null);
    setBusyId(leave.id);
    const result =
      action === "reject"
        ? await rejectLeave(leave.id)
        : action === "approve"
          ? await approveLeave(leave.id, leave.type)
          : await approveLeave(leave.id, action);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onChanged();
    refresh();
  }

  const requests = leaves.filter((l) => l.status === "pending");
  const approved = leaves.filter((l) => l.status === "approved");
  const rejected = leaves.filter((l) => l.status === "rejected");

  return (
    <Modal onClose={onClose}>
      <div className="p-5">
        <h3 className="mb-4 text-base font-bold text-slate-900">
          Manage Leave
        </h3>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-800">{profile.full_name}</p>
          <p className="text-xs text-slate-500">{profile.employee_id}</p>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="leave-date">Leave date</Label>
            <DatePicker
              id="leave-date"
              value={date}
              onChange={setDate}
              placeholder="Leave date"
            />
          </div>
          <div>
            <Label htmlFor="leave-reason">Reason (optional)</Label>
            <Input
              id="leave-reason"
              placeholder="e.g. Festival, personal occasion…"
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
            type="button"
            size="lg"
            className="w-full"
            loading={busy}
            onClick={handleAdd}
          >
            <CalendarPlus className="size-4" />
            Grant Leave
          </Button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-100" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-300">
              or
            </span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            loading={busyAll}
            disabled={!date}
            onClick={handleAddAll}
          >
            <UsersRound className="size-4" />
            Grant to All Staff
          </Button>
          <p className="text-center text-[11px] text-slate-400">
            Applies the selected date as leave for every staff member.
          </p>
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Leave requests ({requests.length})
          </p>
          {requests.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No pending requests.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {requests.map((l) => (
                <div
                  key={l.id}
                  className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3"
                >
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatDateFull(l.attendance_date)}
                      </p>
                      <span
                        className={cn(
                          "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          l.status === "pending"
                            ? "bg-slate-200 text-slate-600"
                            : PAID_LEAVE_TYPES.includes(l.type)
                              ? "bg-success-soft text-success"
                              : "bg-danger-soft text-danger"
                        )}
                      >
                        {LEAVE_TYPE_LABELS[l.type]}
                      </span>
                      {l.reason && (
                        <p className="truncate text-xs text-slate-500">
                          {l.reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {l.type === "casual" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          loading={busyId === l.id}
                          disabled={busyId !== null}
                          onClick={() => handleDecide(l, "pto")}
                          className="border-success/40 text-success hover:bg-success-soft"
                        >
                          <Check className="size-3.5" />
                          PTO
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          loading={busyId === l.id}
                          disabled={busyId !== null}
                          onClick={() => handleDecide(l, "lop")}
                          className="border-danger/40 text-danger hover:bg-danger-soft"
                        >
                          <XCircle className="size-3.5" />
                          LOP
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={busyId === l.id}
                        disabled={busyId !== null}
                        onClick={() => handleDecide(l, "approve")}
                        className="border-success/40 text-success hover:bg-success-soft"
                      >
                        <Check className="size-3.5" />
                        Approve
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={busyId === l.id}
                      disabled={busyId !== null}
                      onClick={() => handleDecide(l, "reject")}
                    >
                      <X className="size-3.5" />
                      Reject
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {l.type === "casual"
                      ? "Casual Leave — choose PTO (paid) or LOP (loss of pay) when approving."
                      : `${LEAVE_TYPE_LABELS[l.type]} — approved as requested or rejected.`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Approved leave ({approved.length})
          </p>
          {approved.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No approved leave yet.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {approved.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatDateFull(l.attendance_date)}
                    </p>
                    {l.reason && (
                      <p className="truncate text-xs text-slate-400">
                        {l.reason}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      PAID_LEAVE_TYPES.includes(l.type)
                        ? "bg-success-soft text-success"
                        : "bg-danger-soft text-danger"
                    )}
                  >
                    {LEAVE_TYPE_LABELS[l.type]}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(l.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {rejected.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Rejected ({rejected.length})
            </p>
            <div className="mt-2 space-y-2">
              {rejected.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">
                      {formatDateFull(l.attendance_date)}
                    </p>
                    {l.reason && (
                      <p className="truncate text-xs text-slate-400">
                        {l.reason}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(l.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}