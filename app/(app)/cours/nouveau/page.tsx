import type { Metadata } from "next";
import { CourseEditor } from "@/components/course/CourseEditor";
import { getEvent } from "@/lib/db/events";
import { listSubjects } from "@/lib/db/subjects";
import { localParts, todayKey } from "@/lib/dates";

export const metadata: Metadata = { title: "Nouveau cours" };
export const dynamic = "force-dynamic";

export default async function NewCoursePage({ searchParams }: PageProps<"/cours/nouveau">) {
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const eventId = str("event") || null;
  let subjectId = str("subject") || null;
  let date = str("date") || "";

  if (eventId) {
    const event = await getEvent(eventId);
    if (event) {
      subjectId ??= event.subject_id;
      date ||= localParts(event.starts_at).dayKey;
    }
  }
  const subjects = await listSubjects();

  return (
    <CourseEditor
      mode="create"
      subjects={subjects}
      initial={{
        courseId: null,
        eventId,
        subjectId,
        title: "",
        date: date || todayKey(),
        contentHtml: "",
      }}
    />
  );
}
