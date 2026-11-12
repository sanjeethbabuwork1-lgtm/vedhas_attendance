import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/data";
import { LoginShell } from "@/components/login/login-shell";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = getActiveSession();
  if (session) {
    redirect(
      session.role === "superadmin"
        ? "/superadmin"
        : session.role === "admin"
          ? "/admin"
          : "/staff"
    );
  }

  return <LoginShell />;
}