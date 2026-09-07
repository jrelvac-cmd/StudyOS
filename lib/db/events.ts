import { db } from "@/lib/supabase/admin";
import type { CalendarEvent, Subject } from "./types";

export type EventWithSubject = CalendarEvent & { subject: Subject | null; course_count: number };

export async function listEventsBetween(from: Date, to: Date): Promise<EventWithSubject[]> {
  const { data, error } = await db()
    .from("calendar_events")
    .select("*, subject:subjects(*)")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");
  if (error) throw error;
  const events = (data ?? []) as (CalendarEvent & { subject: Subject | null })[];
  if (!events.length) return [];

  const { data: counts } = await db()
    .from("courses")
    .select("calendar_event_id")
    .in("calendar_event_id", events.map((e) => e.id));
  const countMap = new Map<string, number>();
  for (const c of counts ?? []) {
    if (c.calendar_event_id) countMap.set(c.calendar_event_id, (countMap.get(c.calendar_event_id) ?? 0) + 1);
  }
  return events.map((e) => ({ ...e, course_count: countMap.get(e.id) ?? 0 }));
}

export async function getEvent(id: string): Promise<(CalendarEvent & { subject: Subject | null }) | null> {
  const { data } = await db().from("calendar_events").select("*, subject:subjects(*)").eq("id", id).maybeSingle();
  return (data as (CalendarEvent & { subject: Subject | null }) | null) ?? null;
}

export async function createManualEvent(input: {
  title: string;
  subject_id: string | null;
  starts_at: string;
  ends_at: string;
  room: string | null;
}): Promise<CalendarEvent> {
  const { data, error } = await db()
    .from("calendar_events")
    .insert({ ...input, source: "manual" })
    .select()
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function updateEventSubject(id: string, subject_id: string | null) {
  const { error } = await db().from("calendar_events").update({ subject_id, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteEvent(id: string) {
  const { error } = await db().from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}
