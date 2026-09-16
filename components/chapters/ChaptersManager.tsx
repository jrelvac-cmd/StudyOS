"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, GitMerge, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { confirmChapterAction, createChapterAction, deleteChapterAction, mergeChaptersAction, renameChapterAction } from "@/lib/actions";
import type { ChapterWithCounts } from "@/lib/db/chapters";
import type { Subject } from "@/lib/db/types";
import { Empty } from "@/components/ui/Empty";
import { cn } from "@/lib/utils";

type Props = { chapters: ChapterWithCounts[]; subjects: Subject[] };

export function ChaptersManager({ chapters, subjects }: Props) {
  if (subjects.length === 0) {
    return <Empty title="Aucune matière" hint="Connecte Google Calendar ou écris un premier cours pour qu'une matière apparaisse ici." />;
  }

  return (
    <div className="stagger flex flex-col gap-6">
      {subjects.map((subject) => {
        const list = chapters.filter((c) => c.subject_id === subject.id);
        return (
          <section key={subject.id}>
            <h2 className="mb-2 text-sm font-semibold text-accent">{subject.name}</h2>
            {list.length > 0 && (
              <ul className="card mb-2 divide-y divide-border">
                {list.map((ch) => (
                  <ChapterRow key={ch.id} chapter={ch} siblings={list.filter((c) => c.id !== ch.id)} />
                ))}
              </ul>
            )}
            <AddChapter subjectId={subject.id} />
          </section>
        );
      })}
    </div>
  );
}

function AddChapter({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  function create() {
    if (!title.trim()) return;
    start(async () => {
      const r = await createChapterAction(subjectId, title);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTitle("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost px-2 py-1.5 text-xs">
        <Plus size={14} /> Nouveau chapitre
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          className="field"
          placeholder="Titre du chapitre…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") setOpen(false);
          }}
          autoFocus
        />
        <button type="button" onClick={create} disabled={pending || !title.trim()} className="icon-btn text-accent shrink-0" aria-label="Créer">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="icon-btn shrink-0" aria-label="Annuler">
          <X size={16} />
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function ChapterRow({ chapter, siblings }: { chapter: ChapterWithCounts; siblings: ChapterWithCounts[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [title, setTitle] = useState(chapter.title);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  function rename() {
    start(async () => {
      const r = await renameChapterAction(chapter.id, title);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function merge() {
    if (!target) return;
    start(async () => {
      const r = await mergeChaptersAction(chapter.id, target);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMerging(false);
      router.refresh();
    });
  }

  return (
    <li className={cn("flex flex-col gap-2 px-4 py-3", chapter.status === "to_verify" && "bg-accent/[0.04]")}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex gap-2">
              <input
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
              />
              <button type="button" onClick={rename} disabled={pending} className="icon-btn text-accent" aria-label="Valider">
                {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="icon-btn" aria-label="Annuler">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <Link href={`/bibliotheque?subject=${chapter.subject_id}&chapter=${chapter.id}`} className="text-sm font-medium hover:text-accent">
                {chapter.title}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-3">
                <span>{chapter.course_count} cours</span>
                {chapter.sheet_count > 0 && <span>· {chapter.sheet_count} fiche{chapter.sheet_count > 1 ? "s" : ""}</span>}
                {chapter.status === "to_verify" && <span className="badge badge-warn">à vérifier</span>}
              </div>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            {chapter.status === "to_verify" && (
              <button
                type="button"
                className="icon-btn text-accent"
                aria-label="Confirmer ce chapitre"
                title="Confirmer"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await confirmChapterAction(chapter.id);
                    router.refresh();
                  })
                }
              >
                <Check size={16} />
              </button>
            )}
            <button type="button" className="icon-btn" aria-label="Renommer" title="Renommer" onClick={() => setEditing(true)}>
              <Pencil size={16} />
            </button>
            {siblings.length > 0 && (
              <button
                type="button"
                className={cn("icon-btn", merging && "bg-accent-dim text-accent")}
                aria-label="Fusionner avec un autre chapitre"
                title="Fusionner"
                onClick={() => setMerging((m) => !m)}
              >
                <GitMerge size={16} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn hover:text-danger"
              aria-label="Supprimer"
              title="Supprimer"
              disabled={pending}
              onClick={() => {
                const msg = chapter.course_count
                  ? `Supprimer « ${chapter.title} » ? Les ${chapter.course_count} cours resteront mais ne seront plus rattachés à ce chapitre.`
                  : `Supprimer « ${chapter.title} » ?`;
                if (!confirm(msg)) return;
                start(async () => {
                  await deleteChapterAction(chapter.id);
                  router.refresh();
                });
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {merging && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
          <span className="text-text-2">Fusionner dans</span>
          <select className="field w-auto flex-1" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— Choisir un chapitre —</option>
            {siblings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.course_count} cours)
              </option>
            ))}
          </select>
          <button type="button" onClick={merge} disabled={pending || !target} className="btn-primary px-4 py-1.5">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />} Fusionner
          </button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </li>
  );
}
