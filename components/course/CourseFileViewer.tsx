"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  contentHtml: string;
  contentText: string;
  sourceUrl: string | null;
  isPdf: boolean;
};

/**
 * Un cours importé en PDF s'affiche par défaut en PDF natif (images, mise en
 * page d'origine comprises), pas en texte reformaté — c'est le texte extrait
 * qui sert à l'IA en coulisses, pas ce que Julien voit en premier.
 */
export function CourseFileViewer({ contentHtml, contentText, sourceUrl, isPdf }: Props) {
  const canShowPdf = isPdf && !!sourceUrl;
  const hasText = !!(contentHtml || contentText.trim());
  const [mode, setMode] = useState<"pdf" | "text">(canShowPdf ? "pdf" : "text");

  return (
    <div className="mt-6">
      {canShowPdf && hasText && (
        <div className="pill-group mb-3">
          <button type="button" onClick={() => setMode("pdf")} className={cn("pill", mode === "pdf" && "pill-active")}>
            PDF
          </button>
          <button type="button" onClick={() => setMode("text")} className={cn("pill", mode === "text" && "pill-active")}>
            Texte extrait
          </button>
        </div>
      )}

      {mode === "pdf" && canShowPdf ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-xs text-text-3">Aperçu du PDF original</span>
            <a href={sourceUrl ?? "#"} target="_blank" rel="noreferrer" className="btn-ghost px-2 py-1 text-xs">
              <ExternalLink size={13} /> Nouvel onglet
            </a>
          </div>
          <iframe src={sourceUrl ?? undefined} title="Aperçu du PDF" className="h-[75vh] w-full bg-white" />
        </div>
      ) : (
        <div className="card px-5 py-5 md:px-7 md:py-6">
          {contentHtml ? (
            <div className="prose-course" dangerouslySetInnerHTML={{ __html: contentHtml }} />
          ) : contentText ? (
            <div className="prose-course whitespace-pre-wrap">{contentText}</div>
          ) : (
            <p className="text-sm text-text-3">Aucun texte. Modifie le cours pour en saisir, ou télécharge le fichier original.</p>
          )}
        </div>
      )}
    </div>
  );
}
