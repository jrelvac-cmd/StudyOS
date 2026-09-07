"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { analyzeCourse, reindexCourse } from "@/lib/ai/pipeline";
import {
  deleteChapter as dbDeleteChapter,
  findOrCreateChapter,
  mergeChapters as dbMergeChapters,
  renameChapter as dbRenameChapter,
  setChapterStatus,
} from "@/lib/db/chapters";
import {
  createCourse,
  deleteCourse as dbDeleteCourse,
  getCourse,
  setCourseChapters,
  updateCourse,
} from "@/lib/db/courses";
import { createManualEvent, deleteEvent as dbDeleteEvent, getEvent, updateEventSubject } from "@/lib/db/events";
import { deleteSheet as dbDeleteSheet, updateSheet as dbUpdateSheet } from "@/lib/db/sheets";
import {
  createSubject,
  deleteSubject as dbDeleteSubject,
  mergeSubjects as dbMergeSubjects,
  reassignAlias as dbReassignAlias,
  renameSubject as dbRenameSubject,
} from "@/lib/db/subjects";
import type { ClassificationStatus } from "@/lib/db/types";
import { localParts, localToUtc } from "@/lib/dates";
import { disconnectGoogle, setCalendarId, syncCalendar } from "@/lib/google";

type Result = { ok: true } | { ok: false; error: string };

function fail(err: unknown): Result {
  return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
}

function revalidateAll() {
  for (const p of ["/planning", "/bibliotheque", "/chapitres", "/fiches", "/reglages"]) revalidatePath(p);
}

// --- Google Calendar --------------------------------------------------------

export async function syncNowAction(): Promise<Result & { synced?: number }> {
  try {
    const r = await syncCalendar();
    revalidatePath("/planning");
    revalidatePath("/reglages");
    return { ok: true, synced: r.synced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur";
    return { ok: false, error: message === "GOOGLE_NOT_CONNECTED" ? "Google Calendar n'est pas connecté." : message };
  }
}

export async function disconnectGoogleAction() {
  await disconnectGoogle();
  revalidatePath("/reglages");
}

export async function setCalendarAction(calendarId: string) {
  await setCalendarId(calendarId);
  await syncCalendar().catch(() => undefined);
  revalidatePath("/reglages");
  revalidatePath("/planning");
}

// --- Créneaux ---------------------------------------------------------------

export async function createManualEventAction(input: {
  title: string;
  subjectId: string | null;
  newSubjectName: string | null;
  date: string;
  start: string;
  end: string;
  room: string;
}): Promise<Result> {
  try {
    let subjectId = input.subjectId;
    if (!subjectId && input.newSubjectName?.trim()) subjectId = (await createSubject(input.newSubjectName)).id;
    const starts = localToUtc(input.date, input.start);
    const ends = localToUtc(input.date, input.end);
    if (!(ends > starts)) return { ok: false, error: "L'heure de fin doit suivre l'heure de début." };
    await createManualEvent({
      title: input.title.trim() || input.newSubjectName?.trim() || "Cours",
      subject_id: subjectId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      room: input.room.trim() || null,
    });
    revalidatePath("/planning");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteEventAction(id: string) {
  await dbDeleteEvent(id);
  revalidatePath("/planning");
}

export async function setEventSubjectAction(eventId: string, subjectId: string | null, newSubjectName?: string) {
  let id = subjectId;
  if (!id && newSubjectName?.trim()) id = (await createSubject(newSubjectName)).id;
  await updateEventSubject(eventId, id);
  revalidatePath("/planning");
}

// --- Cours ------------------------------------------------------------------

export async function saveDraftAction(input: {
  courseId: string | null;
  eventId: string | null;
  subjectId: string | null;
  title: string;
  date: string;
  contentHtml: string;
  contentText: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    if (input.courseId) {
      await updateCourse(input.courseId, {
        title: input.title,
        course_date: input.date,
        content_html: input.contentHtml,
        content_text: input.contentText,
        subject_id: input.subjectId,
      });
      return { ok: true, id: input.courseId };
    }
    let subjectId = input.subjectId;
    let date = input.date;
    if (input.eventId) {
      const event = await getEvent(input.eventId);
      if (event) {
        subjectId ??= event.subject_id;
        date ||= localParts(event.starts_at).dayKey;
      }
    }
    const course = await createCourse({
      subject_id: subjectId,
      calendar_event_id: input.eventId,
      title: input.title,
      course_date: date || localParts(new Date()).dayKey,
      content_html: input.contentHtml,
      content_text: input.contentText,
      status: "draft",
    });
    return { ok: true, id: course.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

/** Valide un cours saisi : il entre dans le pipeline d'analyse et on file sur sa page. */
export async function finalizeCourseAction(courseId: string) {
  await updateCourse(courseId, { status: "analyzing", ai_error: null });
  after(() => analyzeCourse(courseId));
  revalidateAll();
  redirect(`/cours/${courseId}`);
}

export async function reanalyzeCourseAction(courseId: string) {
  await updateCourse(courseId, { status: "analyzing", ai_error: null });
  after(() => analyzeCourse(courseId));
  revalidatePath(`/cours/${courseId}`);
}

export async function deleteCourseAction(courseId: string) {
  await dbDeleteCourse(courseId);
  revalidateAll();
  redirect("/bibliotheque");
}

export async function updateClassificationAction(input: {
  courseId: string;
  subjectId: string | null;
  chapterIds: string[];
  newChapterTitle: string | null;
  status: ClassificationStatus;
}): Promise<Result> {
  try {
    const course = await getCourse(input.courseId);
    if (!course) return { ok: false, error: "Cours introuvable" };
    const subjectChanged = input.subjectId !== course.subject_id;
    // Un chapitre appartient à une matière : changer de matière détache les anciens chapitres.
    let chapterIds = subjectChanged ? [] : input.chapterIds;
    if (input.newChapterTitle?.trim() && input.subjectId) {
      const chapter = await findOrCreateChapter(input.subjectId, input.newChapterTitle, "confirmed");
      if (!chapterIds.includes(chapter.id)) chapterIds = [...chapterIds, chapter.id];
    }
    const status: ClassificationStatus =
      input.status === "annex" ? "annex" : chapterIds.length ? "confirmed" : "to_verify";
    await setCourseChapters(input.courseId, status === "annex" ? [] : chapterIds);
    await updateCourse(input.courseId, { subject_id: input.subjectId, classification_status: status });
    // Valider un cours confirme aussi les chapitres proposés « à vérifier ».
    for (const id of chapterIds) await setChapterStatus(id, "confirmed");
    revalidateAll();
    revalidatePath(`/cours/${input.courseId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function updateCourseTitleAction(courseId: string, title: string) {
  await updateCourse(courseId, { title: title.trim() });
  revalidatePath(`/cours/${courseId}`);
  revalidatePath("/bibliotheque");
}

/** Après modification du texte d'un cours déjà analysé : on ré-indexe sans reclasser. */
export async function reindexCourseAction(courseId: string) {
  after(() => reindexCourse(courseId));
  revalidatePath(`/cours/${courseId}`);
  redirect(`/cours/${courseId}`);
}

// --- Chapitres --------------------------------------------------------------

export async function renameChapterAction(id: string, title: string): Promise<Result> {
  try {
    if (!title.trim()) return { ok: false, error: "Titre vide" };
    await dbRenameChapter(id, title);
    await setChapterStatus(id, "confirmed");
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function confirmChapterAction(id: string) {
  await setChapterStatus(id, "confirmed");
  revalidateAll();
}

export async function mergeChaptersAction(sourceId: string, targetId: string): Promise<Result> {
  try {
    await dbMergeChapters(sourceId, targetId);
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteChapterAction(id: string) {
  await dbDeleteChapter(id);
  revalidateAll();
}

// --- Matières ---------------------------------------------------------------

export async function renameSubjectAction(id: string, name: string): Promise<Result> {
  try {
    if (!name.trim()) return { ok: false, error: "Nom vide" };
    await dbRenameSubject(id, name);
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function mergeSubjectsAction(sourceId: string, targetId: string): Promise<Result> {
  try {
    await dbMergeSubjects(sourceId, targetId);
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function reassignAliasAction(aliasId: string, subjectId: string) {
  await dbReassignAlias(aliasId, subjectId);
  revalidateAll();
}

export async function deleteSubjectAction(id: string) {
  await dbDeleteSubject(id);
  revalidateAll();
}

export async function createSubjectAction(name: string) {
  const subject = await createSubject(name);
  revalidateAll();
  return subject;
}

// --- Fiches -----------------------------------------------------------------

export async function updateSheetAction(id: string, patch: { title?: string; content_md?: string }) {
  await dbUpdateSheet(id, patch);
  revalidatePath(`/fiches/${id}`);
  revalidatePath("/fiches");
}

export async function deleteSheetAction(id: string) {
  await dbDeleteSheet(id);
  revalidatePath("/fiches");
  redirect("/fiches");
}
