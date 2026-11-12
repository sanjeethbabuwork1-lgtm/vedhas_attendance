"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@/types";
import { getActiveSession } from "./data";
import { isSupabaseConfigured } from "./supabase/config";

export function useSession() {
  const [session, setSession] = useState<Session | null>(() => getActiveSession());

  const refresh = useCallback(() => {
    setSession(getActiveSession());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "gfa_session") refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const supabaseConfigured = isSupabaseConfigured();

  return { session, refresh, supabaseConfigured };
}