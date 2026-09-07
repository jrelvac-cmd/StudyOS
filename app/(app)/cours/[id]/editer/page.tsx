import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseEditor } from "@/components/course/CourseEditor";
import { getCourse } from "@/lib/db/courses";
import { listSubjects } from "@/lib/db/subjects";

export const metadata: Metadata = { title: "Modifier le cours" };
export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: PageProps<"/cours/[id]/editer">) {
  const { id } = await params;
  const [course, subjects] = await Promise.all([getCourse(id), listSubjects()]);
  if (!course) notFound();

  return (
    <CourseEditor
      mode={course.status === "draft" ? "create" : "edit"}
      subjects={subjects}
      initial={{
        courseId: course.id,
        eventId: course.calendar_event_id,
        subjectId: course.subject_id,
        title: course.title,
        date: course.course_date,
        contentHtml: course.content_html || (course.content_text ? `<p>${course.content_text.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>` : ""),
      }}
    />
  );
}
