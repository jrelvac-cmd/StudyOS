"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import type { ChapterWithCounts } from "@/lib/db/chapters";
import type { SheetWithChapter } from "@/lib/db/sheets";
import type { Subject } from "@/lib/db/types";
import { fmtDay } from "@/lib/dates";
import { Empty } from "@/components/ui/Empty";
import { GenerateSheetDialog } from "./GenerateSheetDialog";

type Props = { chapters: ChapterWithCounts[]; subjects: Subject[]; sheets: SheetWithChapter[] };

export function SheetPicker({ chapters, subjects, sheets }: Props) {
  const [target, setTarget] = useState<ChapterWithCounts | null>(null);
  const grouped = subjects
    .map((s) => ({ subject: s, chapters: chapters.filter((c) => c.subject_id === s.id && c.course_count > 0) }))
    .filter((g) => g.chapters.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {grouped.length === 0 ? (
        <Empty title="Aucun chapitre avec du contenu" hint="Importe ou écris des cours : une fois analysés, leurs chapitres apparaîtront ici.">
          <Link href="/bibliotheque" className="btn-secondary">
            Aller à la bibliothèque
          </Link>
        </Empty>
      ) : (
        <div className="stagger flex flex-col gap-6">
          {grouped.map(({ subject, chapters: list }) => (
            <section key={subject.id}>
              <h2 className="mb-2 text-sm font-semibold text-accent">{subject.name}</h2>
              <ul className="card divide-y divide-border">
                {list.map((ch) => {
                  const own = sheets.filter((s) => s.chapter_id === ch.id);
                  return (
                    <li key={ch.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{ch.title}</div>
                        <div className="text-xs text-text-3">
                          {ch.course_count} cours{ch.status === "to_verify" ? " · chapitre à vérifier" : ""}
                        </div>
                        {own.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {own.map((s) => (
                              <Link key={s.id} href={`/fiches/${s.id}`} className="badge pressable hover:border-accent/50">
                                <FileText size={11} /> {s.format === "condense" ? "Condensée" : "Complète"} · {fmtDay(s.updated_at.slice(0, 10), "d MMM")}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => setTarget(ch)} className="btn-primary shrink-0 self-start sm:self-auto">
                        <Sparkles size={14} /> Générer
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {target && <GenerateSheetDialog chapter={target} onClose={() => setTarget(null)} />}
    </div>
  );
}
