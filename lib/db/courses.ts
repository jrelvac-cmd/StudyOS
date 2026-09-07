import { db } from "@/lib/supabase/admin";
import type { Chapter, ClassificationStatus, Course, CourseStatus, CourseWithMeta, Subject } from "./types";

type RawCourse = Course & {
  subject: Subject | null;
  course_chapters: { position: number; chapter: Chapter | null }[];
};

const SELECT = "*, subject:subjects(*), course_chapters(position, chapter:chapters(*))";

function shape(row: RawCourse): CourseWithMeta {
  const { course_chapters, ...rest } = row;
  const chapters = (course_chapters ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((l) => l.chapter)
    .filter((c): c is Chapter => !!c);
  return { ...rest, chapters };
}

export type CourseFilters = {
  q?: string;
  subjectId?: string;
  chapterId?: string;
  from?: string;
  to?: string;
  status?: ClassificationStatus;
};

export async function listCourses(filters: CourseFilters = {}): Promise<CourseWithMeta[]> {
  let q = db().from("courses").select(SELECT).order("course_date", { ascending: false }).order("created_at", { ascending: false });
  if (filters.subjectId) q = q.eq("subject_id", filters.subjectId);
  if (filters.from) q = q.gte("course_date", filters.from);
  if (filters.to) q = q.lte("course_date", filters.to);
  if (filters.status) q = q.eq("classification_status", filters.status);
  if (filters.q?.trim()) q = q.textSearch("tsv", filters.q.trim(), { type: "websearch", config: "french" });
  const { data, error } = await q;
  if (error) throw error;
  let courses = ((data ?? []) as RawCourse[]).map(shape);
  if (filters.chapterId) courses = courses.filter((c) => c.chapters.some((ch) => ch.id === filters.chapterId));
  return courses;
}

export async function listCoursesForEvent(eventId: string): Promise<CourseWithMeta[]> {
  const { data, error } = await db().from("courses").select(SELECT).eq("calendar_event_id", eventId).order("created_at");
  if (error) throw error;
  return ((data ?? []) as RawCourse[]).map(shape);
}

export async function listCoursesForChapter(chapterId: string): Promise<CourseWithMeta[]> {
  const { data: links } = await db().from("course_chapters").select("course_id").eq("chapter_id", chapterId);
  const ids = (links ?? []).map((l) => l.course_id);
  if (!ids.length) return [];
  const { data, error } = await db().from("courses").select(SELECT).in("id", ids).order("course_date");
  if (error) throw error;
  return ((data ?? []) as RawCourse[]).map(shape);
}

export async function getCourse(id: string): Promise<CourseWithMeta | null> {
  const { data, error } = await db().from("courses").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? shape(data as RawCourse) : null;
}

export async function getCoursesByIds(ids: string[]): Promise<Map<string, CourseWithMeta>> {
  if (!ids.length) return new Map();
  const { data, error } = await db().from("courses").select(SELECT).in("id", ids);
  if (error) throw error;
  return new Map(((data ?? []) as RawCourse[]).map((r) => [r.id, shape(r)]));
}

export async function createCourse(input: {
  subject_id: string | null;
  calendar_event_id: string | null;
  title: string;
  course_date: string;
  content_html?: string;
  content_text?: string;
  docx_path?: string | null;
  docx_name?: string | null;
  status?: CourseStatus;
}): Promise<Course> {
  const { data, error } = await db().from("courses").insert(input).select().single();
  if (error) throw error;
  return data as Course;
}

export async function updateCourse(id: string, patch: Partial<Course>) {
  const { error } = await db()
    .from("courses")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCourse(id: string) {
  const { data } = await db().from("courses").select("docx_path").eq("id", id).maybeSingle();
  if (data?.docx_path) await db().storage.from("courses").remove([data.docx_path]);
  const { error } = await db().from("courses").delete().eq("id", id);
  if (error) throw error;
}

export async function setCourseChapters(courseId: string, chapterIds: string[]) {
  const client = db();
  await client.from("course_chapters").delete().eq("course_id", courseId);
  if (chapterIds.length) {
    const { error } = await client
      .from("course_chapters")
      .insert(chapterIds.map((chapter_id, position) => ({ course_id: courseId, chapter_id, position })));
    if (error) throw error;
  }
}

export async function replaceChunks(courseId: string, chunks: { content: string; embedding: number[] | null }[]) {
  const client = db();
  await client.from("course_chunks").delete().eq("course_id", courseId);
  if (!chunks.length) return;
  const { error } = await client
    .from("course_chunks")
    .insert(chunks.map((c, position) => ({ course_id: courseId, position, content: c.content, embedding: c.embedding })));
  if (error) throw error;
}

export async function docxDownloadUrl(path: string) {
  const { data, error } = await db().storage.from("courses").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadDocx(courseId: string, file: File) {
  const path = `${courseId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error } = await db()
    .storage.from("courses")
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });
  if (error) throw error;
  return path;
}

export async function countCourses() {
  const { count } = await db().from("courses").select("id", { count: "exact", head: true });
  return count ?? 0;
}
