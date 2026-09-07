import { after, NextResponse } from "next/server";
import mammoth from "mammoth";
import { analyzeCourse } from "@/lib/ai/pipeline";
import { createCourse, updateCourse, uploadDocx } from "@/lib/db/courses";
import { getEvent } from "@/lib/db/events";
import { localParts } from "@/lib/dates";

export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "Seuls les fichiers .docx sont acceptés." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Fichier trop lourd (15 Mo max)." }, { status: 400 });

  const eventId = (form.get("eventId") as string | null) || null;
  let subjectId = (form.get("subjectId") as string | null) || null;
  let date = (form.get("date") as string | null) || null;

  if (eventId) {
    const event = await getEvent(eventId);
    if (event) {
      subjectId ??= event.subject_id;
      date ??= localParts(event.starts_at).dayKey;
    }
  }
  date ??= localParts(new Date()).dayKey;

  const buffer = Buffer.from(await file.arrayBuffer());
  let html = "";
  let text = "";
  try {
    const [h, t] = await Promise.all([
      mammoth.convertToHtml({ buffer }, { ignoreEmptyParagraphs: true }),
      mammoth.extractRawText({ buffer }),
    ]);
    html = h.value;
    text = t.value;
  } catch {
    // Extraction ratée : on garde quand même le fichier, téléchargeable depuis le cours.
  }

  const course = await createCourse({
    subject_id: subjectId,
    calendar_event_id: eventId,
    title: file.name.replace(/\.docx$/i, ""),
    course_date: date,
    content_html: html,
    content_text: text,
    status: text.trim() ? "draft" : "error",
  });

  try {
    const path = await uploadDocx(course.id, file);
    await updateCourse(course.id, { docx_path: path, docx_name: file.name });
  } catch (err) {
    console.error("Upload docx", err);
  }

  if (!text.trim()) {
    await updateCourse(course.id, {
      ai_error: "Impossible d'extraire le texte du fichier Word. Le fichier original reste téléchargeable.",
    });
    return NextResponse.json({ id: course.id, extracted: false });
  }

  after(() => analyzeCourse(course.id));
  return NextResponse.json({ id: course.id, extracted: true });
}
