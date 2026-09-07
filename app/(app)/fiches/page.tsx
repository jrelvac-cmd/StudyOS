import type { Metadata } from "next";
import { SheetPicker } from "@/components/sheets/SheetPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { listChaptersWithCounts } from "@/lib/db/chapters";
import { listSheets } from "@/lib/db/sheets";
import { listSubjects } from "@/lib/db/subjects";

export const metadata: Metadata = { title: "Fiches" };
export const dynamic = "force-dynamic";

export default async function SheetsPage() {
  const [chapters, subjects, sheets] = await Promise.all([listChaptersWithCounts(), listSubjects(), listSheets()]);
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Fiches de révision" subtitle="Choisis un chapitre : la fiche est générée à partir de tes cours." />
      <div className="px-5 pb-8 md:px-8">
        <SheetPicker chapters={chapters} subjects={subjects} sheets={sheets} />
      </div>
    </div>
  );
}
