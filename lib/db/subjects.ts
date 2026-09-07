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
  return (data as SubjectAlias[]).map((a) => ({ ...a, hidden: !!a.hidden }));
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
 * Nom de matière déduit d'un titre d'événement : la partie avant le premier
 * « - » entouré d'espaces. Les emplois du temps universitaires y accolent le
 * type de séance et le groupe (« Microéconomie I : consommateur et firme - TD - GR 1 »).
 */
export function subjectNameFromTitle(title: string) {
  const first = title.split(/\s+[-–—]\s+/)[0]?.trim();
  return first || title.trim();
}

export type AliasMap = Map<string, { subject_id: string; hidden: boolean }>;

export async function loadAliasMap(): Promise<AliasMap> {
  const aliases = await listAliases();
  return new Map(aliases.map((a) => [a.alias, { subject_id: a.subject_id, hidden: a.hidden }]));
}

/**
 * Le titre d'un événement Google est mémorisé comme alias. La première fois,
 * la matière est déduite du titre et créée ; ensuite l'alias l'emporte, ce qui
 * permet à Julien de réassigner un titre à une autre matière ou de le masquer.
 */
export async function subjectForEventTitle(title: string, aliases: AliasMap): Promise<{ subject_id: string; hidden: boolean }> {
  const key = normalizeTitle(title);
  const known = aliases.get(key);
  if (known) return known;

  const subject = await createSubject(subjectNameFromTitle(title));
  await db().from("subject_aliases").upsert({ alias: key, subject_id: subject.id }, { onConflict: "alias" });
  const entry = { subject_id: subject.id, hidden: false };
  aliases.set(key, entry);
  return entry;
}

export async function renameSubject(id: string, name: string) {
  const { error } = await db().from("subjects").update({ name: name.trim() }).eq("id", id);
  if (error) throw error;
}

async function googleEventIdsForAlias(alias: string) {
  const { data: events } = await db().from("calendar_events").select("id, title").eq("source", "google");
  return (events ?? []).filter((e) => normalizeTitle(e.title) === alias).map((e) => e.id);
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
  const ids = await googleEventIdsForAlias(alias.alias);
  if (ids.length) await db().from("calendar_events").update({ subject_id: subjectId }).in("id", ids);
}

/** Masquer un titre retire ses créneaux du planning ; le démasquer les réimporte à la prochaine synchro. */
export async function setAliasHidden(aliasId: string, hidden: boolean) {
  const { data: alias, error } = await db().from("subject_aliases").update({ hidden }).eq("id", aliasId).select().single();
  if (error) {
    if (/hidden/.test(error.message)) throw new Error("Exécute d'abord supabase/migrations/0002_alias_hidden.sql dans Supabase.");
    throw error;
  }
  if (hidden) {
    const ids = await googleEventIdsForAlias(alias.alias);
    if (ids.length) await db().from("calendar_events").delete().in("id", ids);
  }
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
