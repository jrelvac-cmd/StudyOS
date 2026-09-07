"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Pencil, Printer, RefreshCw, Trash2, X } from "lucide-react";
import { deleteSheetAction, updateSheetAction } from "@/lib/actions";
import type { SheetWithChapter } from "@/lib/db/sheets";
import { fmtDay } from "@/lib/dates";
import { Markdown } from "@/components/ui/Markdown";
import { GenerateSheetDialog } from "./GenerateSheetDialog";

type Props = { sheet: SheetWithChapter; courses: { id: string; title: string; date: string }[] };

export function SheetView({ sheet, courses }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(sheet.title);
  const [content, setContent] = useState(sheet.content_md);
  const [regenerating, setRegenerating] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      await updateSheetAction(sheet.id, { title: title.trim() || sheet.title, content_md: content });
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="no-print flex flex-wrap items-center justify-between gap-2 px-5 pt-5 md:px-8 md:pt-7">
        <Link href="/fiches" className="btn-ghost -ml-3 text-xs">
          <ArrowLeft size={14} /> Fiches
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button type="button" onClick={() => { setEditing(false); setTitle(sheet.title); setContent(sheet.content_md); }} className="btn-ghost">
                <X size={14} /> Annuler
              </button>
              <button type="button" onClick={save} disabled={pending} className="btn-primary">
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Enregistrer
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className="btn-secondary">
                <Pencil size={14} /> Modifier
              </button>
              <button type="button" onClick={() => setRegenerating(true)} className="btn-secondary">
                <RefreshCw size={14} /> Régénérer
              </button>
              <button type="button" onClick={() => window.print()} className="btn-primary">
                <Printer size={14} /> Imprimer / PDF
              </button>
              <button
                type="button"
                className="icon-btn hover:text-danger"
                aria-label="Supprimer la fiche"
                onClick={() => {
                  if (confirm("Supprimer cette fiche ?")) start(() => deleteSheetAction(sheet.id));
                }}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      <article className="print-sheet mx-auto w-full max-w-3xl px-5 py-6 md:px-8">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-accent">{sheet.chapter.subject.name}</span>
          <span className="text-text-3">
            · {sheet.format === "condense" ? "Fiche condensée" : "Fiche complète"} · {fmtDay(sheet.updated_at.slice(0, 10))}
          </span>
        </div>
        {editing ? (
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none" aria-label="Titre" />
        ) : (
          <h1 className="text-3xl font-semibold tracking-tight">{sheet.title}</h1>
        )}

        <div className="card mt-5 px-5 py-5 md:px-8 md:py-7 print:border-0 print:p-0">
          {editing ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="field min-h-[60vh] font-mono text-sm leading-relaxed"
              aria-label="Contenu (markdown)"
            />
          ) : (
            <Markdown>{sheet.content_md}</Markdown>
          )}
        </div>

        {courses.length > 0 && (
          <div className="mt-6 text-xs text-text-3">
            <span className="font-medium text-text-2">Cours utilisés :</span>{" "}
            {courses.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/cours/${c.id}`} className="no-print hover:text-accent">
                  {c.title || "Sans titre"} ({fmtDay(c.date, "d MMM")})
                </Link>
                <span className="hidden print:inline">
                  {c.title || "Sans titre"} ({fmtDay(c.date, "d MMM")})
                </span>
              </span>
            ))}
          </div>
        )}
      </article>

      {regenerating && (
        <GenerateSheetDialog
          chapter={{ id: sheet.chapter_id, title: sheet.chapter.title, course_count: courses.length }}
          onClose={() => setRegenerating(false)}
        />
      )}
    </div>
  );
}
