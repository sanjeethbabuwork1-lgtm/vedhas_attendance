import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone?: "blue" | "green" | "amber" | "red";
  onClick?: () => void;
}) {
  const tones = {
    blue: "bg-primary-soft text-primary",
    green: "bg-success-soft text-success",
    amber: "bg-warning-soft text-warning",
    red: "bg-danger-soft text-danger",
  };

  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            tones[tone]
          )}
        >
          <Icon className="size-5" />
        </span>
        <p className="min-w-0 truncate text-xs font-medium leading-snug text-slate-500">
          {label}
        </p>
      </div>
      <p className="whitespace-nowrap overflow-hidden text-[clamp(0.9375rem,3.9vw,1.5rem)] font-bold leading-tight tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm shadow-slate-200/50 transition hover:border-primary/40 hover:shadow-md"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50">
      {content}
    </div>
  );
}
