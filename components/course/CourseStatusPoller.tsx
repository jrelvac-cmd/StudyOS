"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Tant que l'analyse tourne, la page se rafraîchit toutes les 3 s. */
export function CourseStatusPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}
