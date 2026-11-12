"use client";

import { useEffect } from "react";

let lockCount = 0;
let prevOverflow = "";

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      prevOverflow = document.body.style.overflow;
    }
    lockCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [active]);
}