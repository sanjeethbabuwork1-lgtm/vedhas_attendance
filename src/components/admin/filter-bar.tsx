"use client";

import { FileSpreadsheet, FilterX, Search } from "lucide-react";
import type { AttendanceFilter, Profile } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { ThemedSelect } from "@/components/ui/themed-select";
import { MultiSelectDialog } from "@/components/ui/multi-select-dialog";

export function FilterBar({
  filter,
  onChange,
  staff,
  onApply,
  onExport,
  exporting,
}: {
  filter: AttendanceFilter;
  onChange: (next: AttendanceFilter) => void;
  staff: Profile[];
  onApply: () => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const statusOptions = [
    { value: "all", label: "All" },
    { value: "present", label: "Present" },
    { value: "late", label: "Late" },
    { value: "absent", label: "Absent" },
    { value: "rejected", label: "Rejected" },
  ];

  const staffOptions = staff.map((s) => ({
    value: s.employee_id,
    label: s.full_name,
  }));

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label htmlFor="from">From date</Label>
          <DatePicker
            id="from"
            value={filter.from}
            onChange={(from) => onChange({ ...filter, from })}
            max={filter.to || undefined}
            placeholder="Enter From date"
          />
        </div>
        <div>
          <Label htmlFor="to">To date</Label>
          <DatePicker
            id="to"
            value={filter.to}
            onChange={(to) => onChange({ ...filter, to })}
            min={filter.from || undefined}
            placeholder="Enter End date"
          />
        </div>
        <div>
          <Label>Staff (multi-select)</Label>
          <MultiSelectDialog
            id="staff"
            title="Select staff"
            options={staffOptions}
            values={filter.employeeIds}
            onChange={(employeeIds) => onChange({ ...filter, employeeIds })}
            placeholder={
              staff.length === 0 ? "No staff added yet" : "Select staff…"
            }
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <ThemedSelect
            id="status"
            value={filter.status}
            onChange={(status) =>
              onChange({
                ...filter,
                status: status as AttendanceFilter["status"],
              })
            }
            options={statusOptions}
            placeholder="All"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            size="lg"
            className="flex-1"
            onClick={onApply}
          >
            <Search className="size-4" />
            Apply
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() =>
              onChange({
                from: new Date().toISOString().slice(0, 10),
                to: new Date().toISOString().slice(0, 10),
                employeeIds: [],
                status: "all",
              })
            }
            title="Reset filters"
          >
            <FilterX className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-400">
          All filters work together · the report below matches every selection.
        </p>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onExport}
          loading={exporting}
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        >
          <FileSpreadsheet className="size-4" />
          Export XLS
        </Button>
      </div>
    </div>
  );
}