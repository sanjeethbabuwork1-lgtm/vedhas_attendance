export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  let hours = d.getHours();
  const minutes = pad2(d.getMinutes());
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${pad2(hours)}:${minutes} ${suffix}`;
}

export function formatClockTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (
    h == null ||
    m == null ||
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 23
  ) {
    return hhmm;
  }
  const suffix = h >= 12 ? "PM" : "AM";
  const hours = h % 12 || 12;
  return `${pad2(hours)}:${pad2(m)} ${suffix}`;
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function formatDateFull(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

export function localDateKey(date: Date): string {
  return toDateInputValue(date);
}

export function todayKey(): string {
  return toDateInputValue(new Date());
}

export function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return "—";
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—";
  const minutes = Math.round((end - start) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${pad2(m)}m`;
}

export function greetingForTime(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function parseTimeToMs(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 3600000 + (m ?? 0) * 60000;
}

export function isTimeAfter(time: string, reference: string): boolean {
  return parseTimeToMs(time) > parseTimeToMs(reference);
}

export function minutesUntil(
  time: string,
  now: Date = new Date()
): number | null {
  const target = parseTimeToMs(time);
  const current =
    now.getHours() * 3600000 +
    now.getMinutes() * 60000 +
    now.getSeconds() * 1000 +
    now.getMilliseconds();
  const diff = target - current;
  if (diff <= 0) return null;
  return Math.ceil(diff / 60000);
}

export function minutesSince(
  time: string,
  now: Date = new Date()
): number | null {
  const target = parseTimeToMs(time);
  const current =
    now.getHours() * 3600000 +
    now.getMinutes() * 60000 +
    now.getSeconds() * 1000 +
    now.getMilliseconds();
  const diff = current - target;
  if (diff <= 0) return null;
  return Math.floor(diff / 60000);
}

export function formatMinutesShort(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}