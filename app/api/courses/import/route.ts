import { after, NextResponse } from "next/server";
import mammoth from "mammoth";
import { analyzeCourse } from "@/lib/ai/pipeline";
import { createCourse, updateCourse, uploadSourceFile } from "@/lib/db/courses";
import { getEvent } from "@/lib/db/events";
import { localParts } from "@/lib/dates";
import { extractPdfText } from "@/lib/pdf";

export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

type Extracted = { html: string; text: string };

async function extract(file: File, ext: string): Promise<Extracted> {
  const buffer = Buffer.from(await file.arrayBuffer());
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

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });

  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext !== "docx" && ext !== "pdf") {
    return NextResponse.json({ error: "Seuls les fichiers Word (.docx) ou PDF sont acceptés." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Fichier trop lourd (15 Mo max)." }, { status: 400 });
  if (file.size === 0) {
    // Cas fréquent : un fichier OneDrive/Drive « en ligne uniquement » jamais vraiment téléchargé sur l'appareil.
    return NextResponse.json(
      {
        error:
          "Ce fichier est vide (0 octet). S'il vient de OneDrive ou Google Drive, il n'est peut-être disponible qu'en ligne : ouvre-le une fois dans l'explorateur de fichiers (ou clic droit → « Toujours conserver sur cet appareil ») puis réessaie.",
      },
      { status: 400 },
    );
  }

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

  let html = "";
  let text = "";
  try {
    ({ html, text } = await extract(file, ext));
  } catch {
    // Extraction ratée : on garde quand même le fichier, téléchargeable depuis le cours.
  }

  const course = await createCourse({
    subject_id: subjectId,
    calendar_event_id: eventId,
    title: file.name.replace(/\.(docx|pdf)$/i, ""),
    course_date: date,
    content_html: html,
    content_text: text,
    status: text.trim() ? "draft" : "error",
  });

  try {
    const path = await uploadSourceFile(course.id, file);
    await updateCourse(course.id, { docx_path: path, docx_name: file.name });
  } catch (err) {
    console.error("Upload fichier source", err);
  }

  if (!text.trim()) {
    const reason = ext === "pdf" ? "probablement un scan sans texte, ou le fichier est corrompu" : "le fichier est peut-être corrompu ou vide côté serveur (mal synchronisé)";
    await updateCourse(course.id, {
      ai_error: `Impossible d'extraire le texte du fichier ${ext === "pdf" ? "PDF" : "Word"} (${reason}). Le fichier original reste téléchargeable.`,
    });
    return NextResponse.json({ id: course.id, extracted: false });
  }

  after(() => analyzeCourse(course.id));
  return NextResponse.json({ id: course.id, extracted: true });
}
