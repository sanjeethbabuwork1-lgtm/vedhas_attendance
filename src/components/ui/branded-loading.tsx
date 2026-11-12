export function BrandedLoading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-white">
      <span className="flex size-24 items-center justify-center overflow-hidden rounded-3xl bg-white ring-1 ring-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/vc_logo.png"
          alt="Vedhas HR"
          className="size-full object-cover"
        />
      </span>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
        <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading…
      </div>
    </div>
  );
}