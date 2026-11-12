import { Badge } from "@/components/ui/badge";
import type { AttendanceStatus } from "@/types";

export function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  switch (status) {
    case "present":
      return <Badge tone="green">Present</Badge>;
    case "late":
      return <Badge tone="amber">Late</Badge>;
    case "absent":
      return <Badge tone="red">Absent</Badge>;
    case "rejected":
      return <Badge tone="red">Rejected</Badge>;
    default:
      return <Badge tone="slate">—</Badge>;
  }
}

export function LocationBadge({
  verified,
}: {
  verified: boolean | null;
}) {
  if (verified === null) return <Badge tone="slate">Not Verified</Badge>;
  return verified ? (
    <Badge tone="green">Verified</Badge>
  ) : (
    <Badge tone="red">Rejected</Badge>
  );
}