import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./config";

export function createServerClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: "vc" },
    auth: {
      persistSession: false,
    },
  });
}

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!isSupabaseConfigured() || !serviceRoleKey) return null;
  return createClient(SUPABASE_URL, serviceRoleKey, {
    db: { schema: "vc" },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}