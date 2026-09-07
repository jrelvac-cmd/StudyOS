import { db } from "@/lib/supabase/admin";
import type { Chapter, RevisionSheet, SheetFormat, Subject } from "./types";

export type SheetWithChapter = RevisionSheet & { chapter: Chapter & { subject: Subject } };

const SELECT = "*, chapter:chapters(*, subject:subjects(*))";

export async function listSheets(): Promise<SheetWithChapter[]> {
  const { data, error } = await db().from("revision_sheets").select(SELECT).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SheetWithChapter[];
}

export async function getSheet(id: string): Promise<SheetWithChapter | null> {
  const { data, error } = await db().from("revision_sheets").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as SheetWithChapter | null) ?? null;
}

export async function createSheet(input: { chapter_id: string; format: SheetFormat; title: string; content_md: string }) {
  const { data, error } = await db().from("revision_sheets").insert(input).select().single();
  if (error) throw error;
  return data as RevisionSheet;
}

export async function updateSheet(id: string, patch: { title?: string; content_md?: string }) {
  const { error } = await db()
    .from("revision_sheets")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSheet(id: string) {
  const { error } = await db().from("revision_sheets").delete().eq("id", id);
  if (error) throw error;
}
