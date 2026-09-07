"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlignLeft, BookOpenText, Loader2 } from "lucide-react";
import type { SheetFormat } from "@/lib/db/types";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

type Props = { chapter: { id: string; title: string; course_count: number }; onClose: () => void };

const FORMATS: { id: SheetFormat; label: string; hint: string; icon: typeof AlignLeft }[] = [
  { id: "condense", label: "Condensée", hint: "Une page : l'essentiel, définitions, pièges, 5 questions flash.", icon: AlignLeft },
  { id: "complet", label: "Complète", hint: "Plan détaillé, mécanismes expliqués, exemples, 8 à 10 questions.", icon: BookOpenText },
];

export function GenerateSheetDialog({ chapter, onClose }: Props) {
  const router = useRouter();
  const [format, setFormat] = useState<SheetFormat>("condense");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sheets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: chapter.id, format }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Génération impossible.");
        return;
      }
      router.push(`/fiches/${data.id}`);
    } catch {
      setError("Génération impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={busy ? () => undefined : onClose} title={chapter.title}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-3">
          À partir de {chapter.course_count} cours. Quel format ?
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const on = format === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                disabled={busy}
                className={cn(
                  "pressable flex flex-col gap-2 rounded-2xl border p-4 text-left",
                  on ? "border-accent bg-accent-dim" : "border-border hover:bg-surface-2",
                )}
              >
                <Icon size={20} className={on ? "text-accent" : "text-text-2"} />
                <span className="text-sm font-semibold">{f.label}</span>
                <span className="text-xs text-text-2">{f.hint}</span>
              </button>
            );
          })}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Annuler
          </button>
          <button type="button" onClick={generate} disabled={busy} className="btn-primary">
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Génération…
              </>
            ) : (
              "Générer la fiche"
            )}
          </button>
        </div>
        {busy && <p className="text-center text-xs text-text-3">Une trentaine de secondes au plus.</p>}
      </div>
    </Dialog>
  );
}
