"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileUp, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  eventId?: string | null;
  subjectId?: string | null;
  date?: string | null;
  compact?: boolean;
  className?: string;
};

const ACCEPTED = [".docx", ".pdf"];
const MAX_BYTES = 40 * 1024 * 1024;

type Staged = { key: string; file: File; tooBig: boolean; badExt: boolean };
type Result = { key: string; name: string; status: "uploading" | "done" | "error"; courseId?: string; error?: string };

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Import de cours (.docx ou .pdf), un ou plusieurs à la fois : les fichiers
 * choisis sont d'abord listés pour validation, puis envoyés directement au
 * stockage (une fonction Vercel refuse tout corps de requête au-delà
 * d'environ 4,5 Mo — l'envoi direct au stockage n'a pas cette limite).
 */
export function SourceFileDropzone({ eventId, subjectId, date, compact, className }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [sending, setSending] = useState(false);

  function stage(files: File[]) {
    if (!files.length) return;
    setResults([]);
    const next = files.map((file, i) => {
      const ext = file.name.toLowerCase().split(".").pop();
      return {
        key: `${Date.now()}-${i}-${file.name}`,
        file,
        tooBig: file.size > MAX_BYTES,
        badExt: !ext || !ACCEPTED.includes(`.${ext}`),
      };
    });
    setStaged((cur) => [...cur, ...next]);
  }

  function removeStaged(key: string) {
    setStaged((cur) => cur.filter((s) => s.key !== key));
  }

  async function importOne(file: File): Promise<{ courseId?: string; error?: string }> {
    const prep = await fetch("/api/courses/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, size: file.size }),
    });
    const prepData = (await prep.json().catch(() => ({}))) as { path?: string; signedUrl?: string; error?: string };
    if (!prep.ok || !prepData.path || !prepData.signedUrl) return { error: prepData.error ?? "Import impossible." };

    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    const put = await fetch(prepData.signedUrl, { method: "PUT", body: form });
    if (!put.ok) return { error: "L'envoi du fichier a échoué (connexion interrompue ?)." };

    const res = await fetch("/api/courses/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: prepData.path, filename: file.name, eventId, subjectId, date }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok || !data.id) return { error: data.error ?? "Import impossible." };
    return { courseId: data.id };
  }

  async function confirmImport() {
    const valid = staged.filter((s) => !s.tooBig && !s.badExt);
    if (!valid.length) return;
    setSending(true);
    const batch: Result[] = valid.map((s) => ({ key: s.key, name: s.file.name, status: "uploading" }));
    setResults(batch);
    setStaged((cur) => cur.filter((s) => s.tooBig || s.badExt));

    const finished: Result[] = [];
    for (const s of valid) {
      const { courseId, error } = await importOne(s.file);
      const item: Result = error ? { key: s.key, name: s.file.name, status: "error", error } : { key: s.key, name: s.file.name, status: "done", courseId };
      finished.push(item);
      setResults((cur) => cur.map((r) => (r.key === s.key ? item : r)));
    }
    setSending(false);

    if (finished.length === 1 && finished[0].status === "done" && finished[0].courseId) {
      router.push(`/cours/${finished[0].courseId}`);
    }
  }

  const hasInvalid = staged.some((s) => s.tooBig || s.badExt);
  const validCount = staged.filter((s) => !s.tooBig && !s.badExt).length;

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !sending && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          stage(Array.from(e.dataTransfer.files ?? []));
        }}
        className={cn(
          "pressable flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center transition-colors",
          compact ? "px-4 py-4" : "px-6 py-10",
          over ? "border-accent bg-accent-dim" : "border-border-strong hover:border-accent/50 hover:bg-surface-2",
          sending && "pointer-events-none opacity-70",
        )}
      >
        <FileUp size={compact ? 18 : 24} className="text-accent" />
        <div className="text-sm font-medium">Choisir un ou plusieurs cours</div>
        {!compact && <div className="text-xs text-text-3">Glisse des .docx ou .pdf ici, ou clique pour choisir ({Math.round(MAX_BYTES / 1024 / 1024)} Mo max par fichier)</div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          stage(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {staged.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3">
          <ul className="flex flex-col gap-1.5">
            {staged.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-xs">
                {s.tooBig || s.badExt ? <AlertCircle size={14} className="shrink-0 text-danger" /> : <FileUp size={14} className="shrink-0 text-text-3" />}
                <span className={cn("min-w-0 flex-1 truncate", (s.tooBig || s.badExt) && "text-danger")}>
                  {s.file.name}
                  <span className="ml-1.5 text-text-3">
                    · {s.badExt ? "format non accepté" : s.tooBig ? `trop lourd (${formatSize(s.file.size)})` : formatSize(s.file.size)}
                  </span>
                </span>
                <button type="button" onClick={() => removeStaged(s.key)} className="icon-btn h-6 w-6 shrink-0" aria-label={`Retirer ${s.file.name}`}>
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
          {hasInvalid && <p className="text-xs text-danger">Retire les fichiers en rouge, ou seuls les autres seront importés.</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setStaged([])} disabled={sending} className="btn-ghost px-3 py-1.5 text-xs">
              Tout retirer
            </button>
            <button type="button" onClick={confirmImport} disabled={sending || validCount === 0} className="btn-primary px-4 py-1.5 text-xs">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Importer {validCount > 1 ? `(${validCount})` : ""}
            </button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {results.map((item) => (
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
