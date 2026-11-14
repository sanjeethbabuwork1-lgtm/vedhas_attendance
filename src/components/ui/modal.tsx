"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/use-scroll-lock";

export function Modal({
  onClose,
  children,
  panelClassName,
  backdropClassName,
  ariaLabelledBy,
}: {
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
  ariaLabelledBy?: string;
}) {
  useScrollLock();

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm",
        backdropClassName
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl",
          panelClassName
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
