import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, PenLine } from "lucide-react";
import { ClassificationEditor } from "@/components/course/ClassificationEditor";
import { CourseActions } from "@/components/course/CourseActions";
import { CourseStatusPoller } from "@/components/course/CourseStatusPoller";
import { CourseTitle } from "@/components/course/CourseTitle";
import { CourseStatusBadge } from "@/components/ui/StatusBadge";
import { listChapters } from "@/lib/db/chapters";
import { docxDownloadUrl, getCourse } from "@/lib/db/courses";
import { listSubjects } from "@/lib/db/subjects";
import { fmtDay } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/cours/[id]">): Promise<Metadata> {
  const { id } = await params;
  const course = await getCourse(id);
  return { title: course?.title || "Cours" };
}

export default async function CoursePage({ params }: PageProps<"/cours/[id]">) {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) notFound();

  const [subjects, chapters, docxUrl] = await Promise.all([
    listSubjects(),
    listChapters(),
    course.docx_path ? docxDownloadUrl(course.docx_path).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <CourseStatusPoller active={course.status === "analyzing"} />
      <div className="px-5 pt-5 md:px-8 md:pt-7">
        <Link href="/bibliotheque" className="btn-ghost -ml-3 text-xs">
          <ArrowLeft size={14} /> Bibliothèque
        </Link>
      </div>

      <div className="grid gap-6 px-5 py-4 md:grid-cols-[minmax(0,1fr)_20rem] md:px-8">
        <article className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-accent">{course.subject?.name ?? "Matière inconnue"}</span>
            <span className="text-text-3">· {fmtDay(course.course_date, "EEEE d MMMM yyyy")}</span>
            <CourseStatusBadge status={course.status} classification={course.classification_status} />
          </div>
          <CourseTitle courseId={course.id} title={course.title} />

          {course.chapters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {course.chapters.map((ch) => (
                <Link key={ch.id} href={`/bibliotheque?subject=${course.subject_id ?? ""}&chapter=${ch.id}`} className="badge badge-accent pressable">
                  {ch.title}
                </Link>
              ))}
            </div>
          )}

          {course.status === "analyzing" && (
            <div className="card mt-4 border-accent/30 px-4 py-3 text-sm text-text-2">
              L&apos;IA lit le cours pour détecter la matière et le chapitre, puis l&apos;indexe pour l&apos;agent. Quelques secondes.
            </div>
          )}
          {course.status === "error" && course.ai_error && (
            <div className="card mt-4 border-danger/40 px-4 py-3 text-sm">
              <div className="font-medium text-danger">L&apos;analyse a échoué</div>
              <div className="mt-1 text-text-2">{course.ai_error}</div>
            </div>
          )}
          {course.status === "ready" && course.ai_error && (
            <p className="mt-4 text-xs text-text-3">{course.ai_error}</p>
          )}
          {course.ai_summary && (
            <p className="card mt-4 px-4 py-3 text-sm text-text-2">
              <span className="mr-1 font-medium text-text">Résumé IA ·</span>
              {course.ai_summary}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link href={`/cours/${course.id}/editer`} className="btn-secondary">
              <PenLine size={16} /> Modifier le texte
            </Link>
            {docxUrl && (
              <a href={docxUrl} className="btn-secondary" download={course.docx_name ?? undefined}>
                <Download size={16} /> {course.docx_name ?? "Fichier Word"}
              </a>
            )}
          </div>

          <div className="card mt-6 px-5 py-5 md:px-7 md:py-6">
            {course.content_html ? (
              <div className="prose-course" dangerouslySetInnerHTML={{ __html: course.content_html }} />
            ) : course.content_text ? (
              <div className="prose-course whitespace-pre-wrap">{course.content_text}</div>
            ) : (
              <p className="text-sm text-text-3">Aucun texte. Modifie le cours pour en saisir, ou télécharge le fichier Word original.</p>
            )}
          </div>
        </article>

        <aside className="flex flex-col gap-4 md:sticky md:top-6 md:self-start">
          {/* Remonté à chaque analyse : l'éditeur repart de la nouvelle proposition. */}
          <ClassificationEditor key={`${course.id}-${course.updated_at}`} course={course} subjects={subjects} chapters={chapters} />
          <CourseActions courseId={course.id} status={course.status} />
        </aside>
      </div>
    </div>
  );
}
