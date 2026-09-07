import { db } from "@/lib/supabase/admin";
import { normalizeTitle } from "@/lib/utils";
import type { Subject, SubjectAlias } from "./types";

export async function listSubjects(): Promise<Subject[]> {
  const { data, error } = await db().from("subjects").select("*").order("name");
  if (error) throw error;
  return data as Subject[];
}

export async function listAliases(): Promise<SubjectAlias[]> {
  const { data, error } = await db().from("subject_aliases").select("*").order("alias");
  if (error) throw error;
  return data as SubjectAlias[];
}

export async function getSubject(id: string): Promise<Subject | null> {
  const { data } = await db().from("subjects").select("*").eq("id", id).maybeSingle();
  return (data as Subject | null) ?? null;
}

export async function createSubject(name: string): Promise<Subject> {
  const trimmed = name.trim();
  const { data: existing } = await db().from("subjects").select("*").ilike("name", trimmed).maybeSingle();
  if (existing) return existing as Subject;
  const { data, error } = await db().from("subjects").insert({ name: trimmed }).select().single();
  if (error) throw error;
  return data as Subject;
}

/**
 * Le titre d'un événement Google est le nom de la matière. La première fois,
 * la matière est créée et le titre mémorisé comme alias ; ensuite l'alias
 * l'emporte, ce qui permet à Julien de réassigner un titre à une autre matière.
 */
export async function subjectForEventTitle(title: string, cache: Map<string, string>): Promise<string> {
  const key = normalizeTitle(title);
  const cached = cache.get(key);
  if (cached) return cached;

  const { data: alias } = await db().from("subject_aliases").select("subject_id").eq("alias", key).maybeSingle();
  if (alias) {
    cache.set(key, alias.subject_id);
    return alias.subject_id as string;
  }

  const subject = await createSubject(title);
  await db().from("subject_aliases").upsert({ alias: key, subject_id: subject.id }, { onConflict: "alias" });
  cache.set(key, subject.id);
  return subject.id;
}

export async function renameSubject(id: string, name: string) {
  const { error } = await db().from("subjects").update({ name: name.trim() }).eq("id", id);
  if (error) throw error;
}

export async function reassignAlias(aliasId: string, subjectId: string) {
  const { data: alias, error } = await db()
    .from("subject_aliases")
    .update({ subject_id: subjectId })
    .eq("id", aliasId)
    .select()
    .single();
  if (error) throw error;
  // Les événements déjà synchronisés suivent le nouveau mapping.
  const { data: events } = await db().from("calendar_events").select("id, title").eq("source", "google");
  const ids = (events ?? []).filter((e) => normalizeTitle(e.title) === alias.alias).map((e) => e.id);
  if (ids.length) await db().from("calendar_events").update({ subject_id: subjectId }).in("id", ids);
}

/** Fusionne `sourceId` dans `targetId` : cours, événements, chapitres, alias, puis suppression. */
export async function mergeSubjects(sourceId: string, targetId: string) {
  if (sourceId === targetId) return;
  const client = db();
  await client.from("courses").update({ subject_id: targetId }).eq("subject_id", sourceId);
  await client.from("calendar_events").update({ subject_id: targetId }).eq("subject_id", sourceId);
  await client.from("subject_aliases").update({ subject_id: targetId }).eq("subject_id", sourceId);

  // Chapitres homonymes : on rattache les cours au chapitre cible et on supprime le doublon.
  const { data: sourceChapters } = await client.from("chapters").select("id, title").eq("subject_id", sourceId);
  const { data: targetChapters } = await client.from("chapters").select("id, title").eq("subject_id", targetId);
  const byTitle = new Map((targetChapters ?? []).map((c) => [normalizeTitle(c.title), c.id]));
  for (const ch of sourceChapters ?? []) {
    const dup = byTitle.get(normalizeTitle(ch.title));
    if (dup) {
      const { data: links } = await client.from("course_chapters").select("course_id").eq("chapter_id", ch.id);
      for (const l of links ?? []) {
        await client.from("course_chapters").upsert({ course_id: l.course_id, chapter_id: dup }, { onConflict: "course_id,chapter_id" });
      }
      await client.from("revision_sheets").update({ chapter_id: dup }).eq("chapter_id", ch.id);
      await client.from("chapters").delete().eq("id", ch.id);
    } else {
      await client.from("chapters").update({ subject_id: targetId }).eq("id", ch.id);
    }
  }
  await client.from("subjects").delete().eq("id", sourceId);
}

export async function deleteSubject(id: string) {
  const { error } = await db().from("subjects").delete().eq("id", id);
  if (error) throw error;
}
