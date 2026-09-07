"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Chapter, Subject } from "@/lib/db/types";

type Current = { q: string; subjectId: string; chapterId: string; from: string; to: string; status?: string };

type Props = { subjects: Subject[]; chapters: Chapter[]; current: Current };

export function LibraryFilters({ subjects, chapters, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(current.q);

  function apply(patch: Partial<Record<"q" | "subject" | "chapter" | "from" | "to" | "status", string>>) {
    const next = {
      q: current.q,
      subject: current.subjectId,
      chapter: current.chapterId,
      from: current.from,
      to: current.to,
      status: current.status ?? "",
      ...patch,
    };
    // Un chapitre appartient à une matière : changer de matière remet le chapitre à zéro.
    if (patch.subject !== undefined && patch.subject !== current.subjectId) next.chapter = "";
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`);
  }

  useEffect(() => {
    if (q === current.q) return;
    const t = setTimeout(() => apply({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const visibleChapters = current.subjectId ? chapters.filter((c) => c.subject_id === current.subjectId) : chapters;
  const hasFilters = !!(current.q || current.subjectId || current.chapterId || current.from || current.to || current.status);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher dans tous les cours…"
          className="field pl-10"
          aria-label="Recherche plein texte"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="field w-auto" value={current.subjectId} onChange={(e) => apply({ subject: e.target.value })} aria-label="Matière">
          <option value="">Toutes les matières</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="field w-auto" value={current.chapterId} onChange={(e) => apply({ chapter: e.target.value })} aria-label="Chapitre">
          <option value="">Tous les chapitres</option>
          {visibleChapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select className="field w-auto" value={current.status ?? ""} onChange={(e) => apply({ status: e.target.value })} aria-label="Statut">
          <option value="">Tous les statuts</option>
          <option value="to_verify">À vérifier</option>
          <option value="confirmed">Classés</option>
          <option value="annex">Cours annexes</option>
          <option value="pending">Non classés</option>
        </select>
        <input type="date" className="field w-auto" value={current.from} onChange={(e) => apply({ from: e.target.value })} aria-label="Du" />
        <input type="date" className="field w-auto" value={current.to} onChange={(e) => apply({ to: e.target.value })} aria-label="Au" />
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              router.replace(pathname);
            }}
            className="btn-ghost"
          >
            <X size={14} /> Effacer
          </button>
        )}
      </div>
    </div>
  );
}
