import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/data";

export default function HomePage() {
  const session = getActiveSession();
  redirect(session?.role === "admin" ? "/admin" : session ? "/staff" : "/login");
}