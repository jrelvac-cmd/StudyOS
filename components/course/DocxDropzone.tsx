"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  eventId?: string | null;
  subjectId?: string | null;
  date?: string | null;
  compact?: boolean;
  className?: string;
};

/** Zone d'import d'un .docx : clic ou glisser-déposer, puis on file sur la page du cours créé. */
export function DocxDropzone({ eventId, subjectId, date, compact, className }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Seuls les fichiers Word (.docx) sont acceptés.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (eventId) form.append("eventId", eventId);
      if (subjectId) form.append("subjectId", subjectId);
      if (date) form.append("date", date);
      const res = await fetch("/api/courses/import", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Import impossible.");
        return;
      }
      router.push(`/cours/${data.id}`);
    } catch {
      setError("Import impossible.");
    } finally {
      setBusy(false);
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
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        className={cn(
          "pressable flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center transition-colors",
          compact ? "px-4 py-4" : "px-6 py-10",
          over ? "border-accent bg-accent-dim" : "border-border-strong hover:border-accent/50 hover:bg-surface-2",
          busy && "pointer-events-none opacity-70",
        )}
      >
        {busy ? <Loader2 size={compact ? 18 : 24} className="animate-spin text-accent" /> : <FileUp size={compact ? 18 : 24} className="text-accent" />}
        <div className="text-sm font-medium">{busy ? "Import en cours…" : "Importer un fichier Word"}</div>
        {!compact && <div className="text-xs text-text-3">Glisse un .docx ici ou clique pour choisir</div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
