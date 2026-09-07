import type { Metadata } from "next";
import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import { CourseCard } from "@/components/library/CourseCard";
import { DocxDropzone } from "@/components/course/DocxDropzone";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/ui/PageHeader";
import { listChapters } from "@/lib/db/chapters";
import { listCourses } from "@/lib/db/courses";
import { listSubjects } from "@/lib/db/subjects";
import type { ClassificationStatus } from "@/lib/db/types";

export const metadata: Metadata = { title: "Bibliothèque" };
export const dynamic = "force-dynamic";

const STATUSES: ClassificationStatus[] = ["pending", "to_verify", "confirmed", "annex"];

export default async function LibraryPage({ searchParams }: PageProps<"/bibliotheque">) {
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const status = str("status");
  const filters = {
    q: str("q"),
    subjectId: str("subject"),
    chapterId: str("chapter"),
    from: str("from"),
    to: str("to"),
    status: STATUSES.includes(status as ClassificationStatus) ? (status as ClassificationStatus) : undefined,
  };

  const [courses, subjects, chapters] = await Promise.all([listCourses(filters), listSubjects(), listChapters()]);
  const hasFilters = !!(filters.q || filters.subjectId || filters.chapterId || filters.from || filters.to || filters.status);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Bibliothèque" subtitle={`${courses.length} cours${hasFilters ? " (filtrés)" : ""}`}>
        <Link href="/chapitres" className="btn-secondary">
          <Layers size={16} /> Chapitres
        </Link>
        <Link href="/cours/nouveau" className="btn-primary">
          <Plus size={16} /> Nouveau cours
        </Link>
      </PageHeader>

      <div className="px-5 md:px-8">
        <LibraryFilters subjects={subjects} chapters={chapters} current={filters} />
      </div>

      <div className="flex flex-col gap-3 px-5 py-5 md:px-8">
        {courses.length === 0 ? (
          hasFilters ? (
            <Empty title="Aucun cours ne correspond" hint="Essaie d'élargir la recherche ou de retirer un filtre.">
              <Link href="/bibliotheque" className="btn-secondary">
                Effacer les filtres
              </Link>
            </Empty>
          ) : (
            <div className="flex flex-col gap-4">
              <Empty
                title="Ta bibliothèque est vide"
                hint="Importe un fichier Word ou écris ton premier cours : il sera classé par matière et par chapitre automatiquement."
              >
                <Link href="/cours/nouveau" className="btn-primary">
                  <Plus size={16} /> Écrire un cours
                </Link>
              </Empty>
              <DocxDropzone />
            </div>
          )
        ) : (
          <ul className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((c) => (
              <li key={c.id}>
                <CourseCard course={c} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
