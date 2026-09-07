import { NextResponse } from "next/server";
import { generateSheet } from "@/lib/ai/sheet";
import { getChapter } from "@/lib/db/chapters";
import { listCoursesForChapter } from "@/lib/db/courses";
import { createSheet } from "@/lib/db/sheets";
import type { SheetFormat } from "@/lib/db/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { chapterId?: string; format?: SheetFormat } | null;
  const chapterId = body?.chapterId;
  const format = body?.format;
  if (!chapterId || (format !== "condense" && format !== "complet")) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const chapter = await getChapter(chapterId);
  if (!chapter) return NextResponse.json({ error: "Chapitre introuvable" }, { status: 404 });

  const courses = (await listCoursesForChapter(chapterId)).filter((c) => c.content_text.trim());
  if (!courses.length) {
    return NextResponse.json({ error: "Aucun cours avec du contenu n'est rattaché à ce chapitre." }, { status: 400 });
  }

  try {
    const generated = await generateSheet({
      chapterTitle: chapter.title,
      subjectName: chapter.subject.name,
      format,
      courses,
    });
    const sheet = await createSheet({ chapter_id: chapterId, format, ...generated });
    return NextResponse.json({ id: sheet.id });
  } catch (err) {
    console.error("generateSheet", err);
    const message = err instanceof Error ? err.message : "Génération impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
