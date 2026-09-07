"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCourseTitleAction } from "@/lib/actions";

export function CourseTitle({ courseId, title }: { courseId: string; title: string }) {
  const router = useRouter();
  const [value, setValue] = useState(title);
  const [pending, start] = useTransition();

  function commit() {
    const next = value.trim();
    if (next === title) return;
    start(async () => {
      await updateCourseTitleAction(courseId, next);
      router.refresh();
    });
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setValue(title);
      }}
      placeholder="Titre du cours"
      aria-label="Titre du cours"
      disabled={pending}
      className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-text-3 focus:text-accent md:text-3xl"
    />
  );
}
