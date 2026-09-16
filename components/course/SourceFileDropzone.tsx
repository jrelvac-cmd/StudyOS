"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  eventId?: string | null;
  subjectId?: string | null;
  date?: string | null;
  compact?: boolean;
  className?: string;
};

const ACCEPTED = [".docx", ".pdf"];

type Item = {
  key: string;
  name: string;
  status: "uploading" | "done" | "error";
  courseId?: string;
  error?: string;
};

/** Zone d'import de cours (.docx ou .pdf) : clic ou glisser-déposer, un ou plusieurs fichiers à la fois. */
export function SourceFileDropzone({ eventId, subjectId, date, compact, className }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const busy = items.some((i) => i.status === "uploading");

  async function uploadOne(file: File, key: string): Promise<Item> {
    const ext = file.name.toLowerCase().split(".").pop();
    let result: Item;
    if (!ext || !ACCEPTED.includes(`.${ext}`)) {
      result = { key, name: file.name, status: "error", error: "Format non accepté (.docx ou .pdf seulement)." };
    } else {
      try {
        const form = new FormData();
        form.append("file", file);
        if (eventId) form.append("eventId", eventId);
        if (subjectId) form.append("subjectId", subjectId);
        if (date) form.append("date", date);
        const res = await fetch("/api/courses/import", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        result =
          !res.ok || !data.id
            ? { key, name: file.name, status: "error", error: data.error ?? "Import impossible." }
            : { key, name: file.name, status: "done", courseId: data.id };
      } catch {
        result = { key, name: file.name, status: "error", error: "Connexion impossible." };
      }
    }
    setItems((cur) => cur.map((i) => (i.key === key ? result : i)));
    return result;
  }

  async function uploadAll(files: File[]) {
    if (!files.length) return;
    const batch: Item[] = files.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, status: "uploading" }));
    setItems((cur) => [...cur, ...batch]);
    // Séquentiel : plusieurs analyses IA en parallèle n'apporteraient rien et compliqueraient le suivi par fichier.
    const results: Item[] = [];
    for (let i = 0; i < files.length; i++) results.push(await uploadOne(files[i], batch[i].key));

    // Un seul fichier réussi : on file directement sur sa page, comme avant.
    if (results.length === 1 && results[0].status === "done" && results[0].courseId) {
      router.push(`/cours/${results[0].courseId}`);
    }
  }

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void uploadAll(Array.from(e.dataTransfer.files ?? []));
        }}
        className={cn(
          "pressable flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center transition-colors",
          compact ? "px-4 py-4" : "px-6 py-10",
          over ? "border-accent bg-accent-dim" : "border-border-strong hover:border-accent/50 hover:bg-surface-2",
          busy && "pointer-events-none opacity-70",
        )}
      >
        {busy ? <Loader2 size={compact ? 18 : 24} className="animate-spin text-accent" /> : <FileUp size={compact ? 18 : 24} className="text-accent" />}
        <div className="text-sm font-medium">{busy ? "Import en cours…" : "Importer un ou plusieurs cours"}</div>
        {!compact && <div className="text-xs text-text-3">Glisse des .docx ou .pdf ici, ou clique pour choisir (plusieurs fichiers possibles)</div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          void uploadAll(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-2 text-xs">
              {item.status === "uploading" && <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-text-3" />}
              {item.status === "done" && <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-accent" />}
              {item.status === "error" && <AlertCircle size={14} className="mt-0.5 shrink-0 text-danger" />}
              <div className="min-w-0 flex-1">
                {item.status === "done" && item.courseId ? (
                  <Link href={`/cours/${item.courseId}`} className="truncate font-medium text-text hover:text-accent">
                    {item.name}
                  </Link>
                ) : (
                  <span className="truncate text-text-2">{item.name}</span>
                )}
                {item.error && <div className="mt-0.5 text-danger">{item.error}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
