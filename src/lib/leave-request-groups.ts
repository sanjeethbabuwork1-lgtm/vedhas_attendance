import type { LeaveRequest, Profile } from "@/types";

export interface LeaveRequestGroup {
  id: string;
  profile: Profile | null;
  requests: LeaveRequest[];
  fromDate: string;
  toDate: string;
}

type LeaveRequestRow = {
  leave: LeaveRequest;
  profile: Profile | null;
};

function isFollowingDate(previous: string, current: string): boolean {
  const date = new Date(`${previous}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10) === current;
}

export function groupLeaveRequestDays(
  rows: LeaveRequestRow[]
): LeaveRequestGroup[] {
  const batches = new Map<string, LeaveRequestRow[]>();

  for (const row of rows) {
    const { leave } = row;
    const key = JSON.stringify([
      leave.employee_id,
      leave.type,
      leave.status,
      leave.reason ?? "",
      leave.created_at,
    ]);
    const batch = batches.get(key) ?? [];
    batch.push(row);
    batches.set(key, batch);
  }

  const groups: LeaveRequestGroup[] = [];
  for (const batch of batches.values()) {
    batch.sort((a, b) =>
      a.leave.attendance_date.localeCompare(b.leave.attendance_date)
    );

    let consecutive: LeaveRequestRow[] = [];
    const saveGroup = () => {
      if (consecutive.length === 0) return;
      const first = consecutive[0];
      const last = consecutive[consecutive.length - 1];
      groups.push({
        id: first.leave.id,
        profile: first.profile,
        requests: consecutive.map(({ leave }) => leave),
        fromDate: first.leave.attendance_date,
        toDate: last.leave.attendance_date,
      });
      consecutive = [];
    };

    for (const row of batch) {
      const previous = consecutive[consecutive.length - 1];
      if (
        previous &&
        !isFollowingDate(
          previous.leave.attendance_date,
          row.leave.attendance_date
        )
      ) {
        saveGroup();
      }
      consecutive.push(row);
    }
    saveGroup();
  }

  return groups.sort((a, b) => a.fromDate.localeCompare(b.fromDate));
}
