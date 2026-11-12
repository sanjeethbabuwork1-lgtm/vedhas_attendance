import { cn } from "@/lib/utils";

export type BadgeTone = "green" | "amber" | "red" | "blue" | "slate";

const toneClasses: Record<BadgeTone, string> = {
  green: "bg-success-soft text-success ring-success/20",
  amber: "bg-warning-soft text-warning ring-warning/20",
  red: "bg-danger-soft text-danger ring-danger/20",
  blue: "bg-primary-soft text-primary ring-primary/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}