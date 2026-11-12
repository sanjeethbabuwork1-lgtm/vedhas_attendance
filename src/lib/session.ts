import type { Session } from "@/types";

const SESSION_KEY = "gfa_session_v2";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function getSession(): Session | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  if (!canUseStorage()) return;
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
  } else {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}