import { redirect } from "next/navigation";

export const metadata = { title: "Attendance" };

export default function StaffAttendancePage() {
  redirect("/staff");
}