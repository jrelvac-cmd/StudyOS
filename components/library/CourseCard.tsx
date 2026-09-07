import Link from "next/link";
import { FileText } from "lucide-react";
import { CourseStatusBadge } from "@/components/ui/StatusBadge";
import type { CourseWithMeta } from "@/lib/db/types";
import { fmtDay } from "@/lib/dates";

export function CourseCard({ course }: { course: CourseWithMeta }) {
  const preview = (course.ai_summary || course.content_text).replace(/\s+/g, " ").trim().slice(0, 180);
  return (
    <Link href={`/cours/${course.id}`} className="pressable card flex h-full flex-col gap-2 px-4 py-4 hover:bg-surface-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-accent">{course.subject?.name ?? "Matière inconnue"}</span>
        <span className="shrink-0 text-text-3">{fmtDay(course.course_date)}</span>
      </div>
      <h3 className="line-clamp-2 text-base font-semibold leading-snug">{course.title || "Sans titre"}</h3>
      {course.chapters.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {course.chapters.map((ch) => (
            <span key={ch.id} className="badge">
              {ch.title}
            </span>
          ))}
        </div>
      )}
      {preview && <p className="line-clamp-3 text-sm text-text-2">{preview}</p>}
      <div className="mt-auto flex items-center justify-between pt-1">
        <CourseStatusBadge status={course.status} classification={course.classification_status} />
        {course.docx_name && (
          <span className="flex items-center gap-1 text-[11px] text-text-3">
            <FileText size={11} /> Word
          </span>
        )}
      </div>
    </Link>
  );
}
