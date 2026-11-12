"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminDashboardPage from "@/app/admin/page";
import { BrandedLoading } from "@/components/ui/branded-loading";
import { useMounted } from "@/lib/use-mounted";
import { useSession } from "@/lib/use-session";

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const mounted = useMounted();
  const { session } = useSession();

  useEffect(() => {
    if (!session) router.replace("/login");
    else if (session.role !== "superadmin") router.replace("/admin");
  }, [router, session]);

  if (!mounted || !session || session.role !== "superadmin") {
    return <BrandedLoading />;
  }

  return <AdminDashboardPage />;
}
