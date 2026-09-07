import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChaptersManager } from "@/components/chapters/ChaptersManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { listChaptersWithCounts } from "@/lib/db/chapters";
import { listSubjects } from "@/lib/db/subjects";

export const metadata: Metadata = { title: "Chapitres" };
export const dynamic = "force-dynamic";

export default async function ChaptersPage() {
  const [chapters, subjects] = await Promise.all([listChaptersWithCounts(), listSubjects()]);
  const toVerify = chapters.filter((c) => c.status === "to_verify").length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-5 pt-5 md:px-8 md:pt-7">
        <Link href="/bibliotheque" className="btn-ghost -ml-3 text-xs">
          <ArrowLeft size={14} /> Bibliothèque
        </Link>
      </div>
      <PageHeader
        title="Chapitres"
        subtitle={`${chapters.length} chapitres${toVerify ? ` · ${toVerify} à vérifier` : ""}`}
        className="pt-2 md:pt-2"
      />
      <div className="px-5 pb-8 md:px-8">
        <ChaptersManager chapters={chapters} subjects={subjects} />
      </div>
    </div>
  );
}
