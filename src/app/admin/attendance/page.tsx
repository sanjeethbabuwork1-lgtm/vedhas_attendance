import { redirect } from "next/navigation";

export const metadata = { title: "Attendance" };

export default function AdminAttendancePage() {
  redirect("/admin");
}