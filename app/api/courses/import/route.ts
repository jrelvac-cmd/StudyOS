import { after, NextResponse } from "next/server";
import mammoth from "mammoth";
import { analyzeCourse } from "@/lib/ai/pipeline";
import { createCourse, updateCourse } from "@/lib/db/courses";
import { getEvent } from "@/lib/db/events";
import { localParts } from "@/lib/dates";
import { extractPdfText } from "@/lib/pdf";
import { db } from "@/lib/supabase/admin";

export const maxDuration = 60;

type Extracted = { html: string; text: string };

async function extract(buffer: Buffer, ext: string): Promise<Extracted> {
  if (ext === "docx") {
    const [h, t] = await Promise.all([
      mammoth.convertToHtml({ buffer }, { ignoreEmptyParagraphs: true }),
      mammoth.extractRawText({ buffer }),
    ]);
    return { html: h.value, text: t.value };
  }
  // PDF : texte seul, pas de mise en forme — la page du cours retombe sur un rendu texte brut.
  return { html: "", text: await extractPdfText(buffer) };
}

type Body = {
  path?: string;
  filename?: string;
  eventId?: string | null;
  subjectId?: string | null;
  date?: string | null;
};

/** Le fichier a déjà été envoyé directement dans le stockage (voir /api/courses/upload-url) ; ici on le récupère et on l'analyse. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const path = body?.path;
  const filename = body?.filename;
  if (!path || !filename || !path.startsWith("uploads/")) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 400 });
  }
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext !== "docx" && ext !== "pdf") {
    return NextResponse.json({ error: "Seuls les fichiers Word (.docx) ou PDF sont acceptés." }, { status: 400 });
  }

  const { data: blob, error: downloadError } = await db().storage.from("courses").download(path);
  if (downloadError || !blob) {
    return NextResponse.json({ error: "L'envoi du fichier a expiré ou a échoué. Réessaie." }, { status: 400 });
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.length === 0) {
    await db().storage.from("courses").remove([path]);
    return NextResponse.json(
      {
        error:
          "Ce fichier est vide (0 octet). S'il vient de OneDrive ou Google Drive, il n'est peut-être disponible qu'en ligne : ouvre-le une fois dans l'explorateur de fichiers (ou clic droit → « Toujours conserver sur cet appareil ») puis réessaie.",
      },
      { status: 400 },
    );
  }

  const eventId = body?.eventId || null;
  let subjectId = body?.subjectId || null;
  let date = body?.date || null;

  if (eventId) {
    const event = await getEvent(eventId);
    if (event) {
      subjectId ??= event.subject_id;
      date ??= localParts(event.starts_at).dayKey;
    }
  }
  date ??= localParts(new Date()).dayKey;

  let html = "";
  let text = "";
  try {
    ({ html, text } = await extract(buffer, ext));
  } catch {
    // Extraction ratée : on garde quand même le fichier, téléchargeable depuis le cours.
  }

  const course = await createCourse({
    subject_id: subjectId,
    calendar_event_id: eventId,
    title: filename.replace(/\.(docx|pdf)$/i, ""),
    course_date: date,
    content_html: html,
    content_text: text,
    docx_path: path,
    docx_name: filename,
    status: text.trim() ? "draft" : "error",
  });

  if (!text.trim()) {
    const reason = ext === "pdf" ? "probablement un scan sans texte, ou le fichier est corrompu" : "le fichier est peut-être corrompu";
    await updateCourse(course.id, {
      ai_error: `Impossible d'extraire le texte du fichier ${ext === "pdf" ? "PDF" : "Word"} (${reason}). Le fichier original reste téléchargeable.`,
    });
    return NextResponse.json({ id: course.id, extracted: false });
  }

  after(() => analyzeCourse(course.id));
  return NextResponse.json({ id: course.id, extracted: true });
}
