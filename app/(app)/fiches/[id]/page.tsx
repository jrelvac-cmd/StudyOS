import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SheetView } from "@/components/sheets/SheetView";
import { listCoursesForChapter } from "@/lib/db/courses";
import { getSheet } from "@/lib/db/sheets";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/fiches/[id]">): Promise<Metadata> {
  const { id } = await params;
  const sheet = await getSheet(id);
  return { title: sheet ? `Fiche · ${sheet.title}` : "Fiche" };
}

export default async function SheetPage({ params }: PageProps<"/fiches/[id]">) {
  const { id } = await params;
  const sheet = await getSheet(id);
  if (!sheet) notFound();
  const courses = await listCoursesForChapter(sheet.chapter_id);
  return <SheetView sheet={sheet} courses={courses.map((c) => ({ id: c.id, title: c.title, date: c.course_date }))} />;
}
