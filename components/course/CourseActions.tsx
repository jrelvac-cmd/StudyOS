"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { deleteCourseAction, reanalyzeCourseAction } from "@/lib/actions";
import type { CourseStatus } from "@/lib/db/types";

export function CourseActions({ courseId, status }: { courseId: string; status: CourseStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="card flex flex-col gap-2 px-4 py-4">
      <button
        type="button"
        disabled={pending || status === "analyzing"}
        onClick={() =>
          start(async () => {
            await reanalyzeCourseAction(courseId);
            router.refresh();
          })
        }
        className="btn-secondary justify-start"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        Relancer l&apos;analyse IA
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Supprimer définitivement ce cours ?")) return;
          start(() => deleteCourseAction(courseId));
        }}
        className="btn-danger justify-start"
      >
        <Trash2 size={16} /> Supprimer le cours
      </button>
    </div>
  );
}
