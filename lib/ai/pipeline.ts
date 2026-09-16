import { listChapters } from "@/lib/db/chapters";
import { getCourse, updateCourse, replaceChunks } from "@/lib/db/courses";
import { createSubject } from "@/lib/db/subjects";
import type { ClassificationStatus } from "@/lib/db/types";
import { chunkText } from "./chunk";
import { classifyCourse } from "./classify";
import { embed } from "./embeddings";

/**
 * Pipeline d'analyse d'un cours : déduit la matière et PROPOSE un chapitre
 * (existant ou un titre de nouveau chapitre), sans jamais créer ni rattacher
 * quoi que ce soit lui-même — c'est Julien qui crée ses chapitres et classe
 * ses cours, la proposition n'est qu'un pré-remplissage qu'il valide ou non.
 * Puis indexation (passages + embeddings) pour l'agent. Idempotent.
 */
export async function analyzeCourse(courseId: string) {
  const course = await getCourse(courseId);
  if (!course) return;
  await updateCourse(courseId, { status: "analyzing", ai_error: null });

  try {
    const text = course.content_text.trim();
    if (text.length < 40) throw new Error("Le cours est trop court pour être analysé.");

    let subjectId = course.subject_id;
    const known = subjectId ? await listChapters(subjectId) : [];

    const result = await classifyCourse({
      text,
      subjectName: course.subject?.name ?? null,
      knownChapters: known.map((c) => ({ id: c.id, title: c.title })),
    });

    if (!subjectId && result.subject_name) subjectId = (await createSubject(result.subject_name)).id;

    let classification: ClassificationStatus;
    let suggestedChapterId: string | null = null;
    const suggestedTitles: string[] = [];
    if (result.is_annex || !subjectId) {
      classification = result.is_annex ? "annex" : "to_verify";
    } else {
      for (const ch of result.chapters) {
        const existing = ch.existing_chapter_id ? known.find((k) => k.id === ch.existing_chapter_id) : null;
        if (existing) suggestedChapterId ??= existing.id;
        else if (!suggestedTitles.includes(ch.title)) suggestedTitles.push(ch.title);
      }
      classification = "to_verify";
    }

    await updateCourse(courseId, {
      subject_id: subjectId,
      title: course.title.trim() || result.title,
      ai_summary: result.summary,
      classification_status: classification,
      ai_suggested_chapter_id: suggestedChapterId,
      ai_suggested_chapter_title: suggestedTitles.join(" / ") || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    await updateCourse(courseId, { status: "error", ai_error: message });
    return;
  }

  const warning = await indexCourse(courseId, course.content_text);
  await updateCourse(courseId, { status: "ready", ai_error: warning });
}

/** Découpe et vectorise ; rend un avertissement si les embeddings ont échoué. */
async function indexCourse(courseId: string, text: string): Promise<string | null> {
  const chunks = chunkText(text);
  let vectors: number[][] | null = null;
  let warning: string | null = null;
  try {
    vectors = await embed(chunks, "document");
  } catch (err) {
    warning = `Embeddings indisponibles (${err instanceof Error ? err.message.slice(0, 120) : "erreur"}) : recherche plein texte seulement.`;
  }
  await replaceChunks(
    courseId,
    chunks.map((content, i) => ({ content, embedding: vectors ? vectors[i] : null })),
  );
  return warning;
}

/** Ré-indexe seulement les passages (après une correction du texte, sans reclasser). */
export async function reindexCourse(courseId: string) {
  const course = await getCourse(courseId);
  if (!course) return;
  const warning = await indexCourse(courseId, course.content_text);
  await updateCourse(courseId, { ai_error: warning });
}
