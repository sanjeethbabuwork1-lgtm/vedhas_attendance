import { SUPABASE_URL } from "./supabase/config";

const OFFLINE_MESSAGE =
  "No internet connection. Please check your network and try again.";

export function getOfflineMessage(): string {
  return OFFLINE_MESSAGE;
}

// Only true for genuine connectivity failures. Other errors (code bugs,
// Supabase/PostgREST errors) must surface their real message instead of
// being disguised as "No internet connection".
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (err instanceof Error && err.name === "TimeoutError") return true;
  if (
    err instanceof Error &&
    /Failed to fetch|NetworkError when attempting|Load failed|fetch failed|ERR_NETWORK|ERR_INTERNET_DISCONNECTED/i.test(
      err.message
    )
  ) {
    return true;
  }
  return false;
}

export async function isOnline(timeoutMs = 5000): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }
  if (!SUPABASE_URL) return true;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return true;
  } catch {
    return false;
  }
}
