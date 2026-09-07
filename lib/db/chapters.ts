import { db } from "@/lib/supabase/admin";
import { normalizeTitle } from "@/lib/utils";
import type { Chapter, ChapterStatus, Subject } from "./types";

export type ChapterWithCounts = Chapter & { subject: Subject; course_count: number; sheet_count: number };

export async function listChapters(subjectId?: string): Promise<Chapter[]> {
  let q = db().from("chapters").select("*").order("created_at");
  if (subjectId) q = q.eq("subject_id", subjectId);
  const { data, error } = await q;
  if (error) throw error;
  return data as Chapter[];
}

export async function listChaptersWithCounts(): Promise<ChapterWithCounts[]> {
  const client = db();
  const [{ data: chapters, error }, { data: links }, { data: sheets }] = await Promise.all([
    client.from("chapters").select("*, subject:subjects(*)").order("created_at"),
    client.from("course_chapters").select("chapter_id"),
    client.from("revision_sheets").select("chapter_id"),
  ]);
  if (error) throw error;
  const courseCounts = new Map<string, number>();
  for (const l of links ?? []) courseCounts.set(l.chapter_id, (courseCounts.get(l.chapter_id) ?? 0) + 1);
  const sheetCounts = new Map<string, number>();
  for (const s of sheets ?? []) sheetCounts.set(s.chapter_id, (sheetCounts.get(s.chapter_id) ?? 0) + 1);
  return ((chapters ?? []) as (Chapter & { subject: Subject })[]).map((c) => ({
    ...c,
    course_count: courseCounts.get(c.id) ?? 0,
    sheet_count: sheetCounts.get(c.id) ?? 0,
  }));
}

export async function getChapter(id: string): Promise<(Chapter & { subject: Subject }) | null> {
  const { data } = await db().from("chapters").select("*, subject:subjects(*)").eq("id", id).maybeSingle();
  return (data as (Chapter & { subject: Subject }) | null) ?? null;
}

/** Retrouve un chapitre du même nom (insensible à la casse) ou le crée. */
export async function findOrCreateChapter(subjectId: string, title: string, status: ChapterStatus): Promise<Chapter> {
  const trimmed = title.trim();
  const existing = await listChapters(subjectId);
  const dup = existing.find((c) => normalizeTitle(c.title) === normalizeTitle(trimmed));
  if (dup) return dup;
  const { data, error } = await db()
    .from("chapters")
    .insert({ subject_id: subjectId, title: trimmed, status })
    .select()
    .single();
  if (error) throw error;
  return data as Chapter;
}

export async function renameChapter(id: string, title: string) {
  const { error } = await db().from("chapters").update({ title: title.trim() }).eq("id", id);
  if (error) throw error;
}

export async function setChapterStatus(id: string, status: ChapterStatus) {
  const { error } = await db().from("chapters").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Fusionne `sourceId` dans `targetId` : cours et fiches suivent, le doublon disparaît. */
export async function mergeChapters(sourceId: string, targetId: string) {
  if (sourceId === targetId) return;
  const client = db();
  const { data: links } = await client.from("course_chapters").select("course_id, position").eq("chapter_id", sourceId);
  for (const l of links ?? []) {
    await client
      .from("course_chapters")
      .upsert({ course_id: l.course_id, chapter_id: targetId, position: l.position }, { onConflict: "course_id,chapter_id" });
  }
  await client.from("revision_sheets").update({ chapter_id: targetId }).eq("chapter_id", sourceId);
  const { error } = await client.from("chapters").delete().eq("id", sourceId);
  if (error) throw error;
}

export async function deleteChapter(id: string) {
  const { error } = await db().from("chapters").delete().eq("id", id);
  if (error) throw error;
}
