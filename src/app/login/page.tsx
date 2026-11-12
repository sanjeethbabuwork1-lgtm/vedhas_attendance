import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/data";
import { LoginShell } from "@/components/login/login-shell";
import { seedAdminProfile } from "@/lib/supabase/repo";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Ensure the default admin profile exists so the app is usable
  // immediately without manual SQL inserts.
  await Promise.allSettled([seedAdminProfile()]);

  const session = getActiveSession();
  if (session) {
    redirect(session.role === "admin" ? "/admin" : "/staff");
  }

  return <LoginShell />;
}