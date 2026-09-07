"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, GitMerge, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createSubjectAction,
  deleteSubjectAction,
  mergeSubjectsAction,
  reassignAliasAction,
  renameSubjectAction,
  setAliasHiddenAction,
} from "@/lib/actions";
import type { Subject, SubjectAlias } from "@/lib/db/types";
import { cn } from "@/lib/utils";

type Props = { subjects: Subject[]; aliases: SubjectAlias[] };

export function SubjectsManager({ subjects, aliases }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");

  function add() {
    if (!newName.trim()) return;
    start(async () => {
      await createSubjectAction(newName);
      setNewName("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {subjects.length === 0 && <p className="text-sm text-text-3">Aucune matière pour l&apos;instant.</p>}
      <ul className="flex flex-col gap-2">
        {subjects.map((s) => (
          <SubjectRow
            key={s.id}
            subject={s}
            others={subjects.filter((o) => o.id !== s.id)}
            aliases={aliases.filter((a) => a.subject_id === s.id)}
            allSubjects={subjects}
          />
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="field"
          placeholder="Nouvelle matière…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button type="button" disabled={pending || !newName.trim()} className="btn-secondary shrink-0" onClick={add}>
          <Plus size={14} /> Ajouter
        </button>
      </div>
    </div>
  );
}

function SubjectRow({ subject, others, aliases, allSubjects }: { subject: Subject; others: Subject[]; aliases: SubjectAlias[]; allSubjects: Subject[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [name, setName] = useState(subject.name);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hiddenCount = aliases.filter((a) => a.hidden).length;

  return (
    <li className="card flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Escape" && setEditing(false)} />
            <button
              type="button"
              className="icon-btn text-accent"
              aria-label="Valider"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await renameSubjectAction(subject.id, name);
                  if (!r.ok) return setError(r.error);
                  setEditing(false);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button type="button" className="icon-btn" aria-label="Annuler" onClick={() => setEditing(false)}>
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">{subject.name}</span>
              {aliases.length > 0 && (
                <span className="ml-2 text-xs text-text-3">
                  {aliases.length} titre{aliases.length > 1 ? "s" : ""} Google{hiddenCount ? ` · ${hiddenCount} masqué${hiddenCount > 1 ? "s" : ""}` : ""}
                </span>
              )}
            </div>
            <button type="button" className="icon-btn" aria-label="Renommer" title="Renommer" onClick={() => setEditing(true)}>
              <Pencil size={16} />
            </button>
            {others.length > 0 && (
              <button type="button" className={cn("icon-btn", merging && "bg-accent-dim text-accent")} aria-label="Fusionner" title="Fusionner" onClick={() => setMerging((m) => !m)}>
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
                if (!confirm(`Supprimer « ${subject.name} » ? Ses chapitres seront supprimés ; ses cours et créneaux resteront, sans matière.`)) return;
                start(async () => {
                  await deleteSubjectAction(subject.id);
                  router.refresh();
                });
              }}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>

      {merging && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
          <span className="text-text-2">Fusionner dans</span>
          <select className="field w-auto flex-1" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— Choisir —</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary px-4 py-1.5"
            disabled={pending || !target}
            onClick={() =>
              start(async () => {
                const r = await mergeSubjectsAction(subject.id, target);
                if (!r.ok) return setError(r.error);
                router.refresh();
              })
            }
          >
            <GitMerge size={14} /> Fusionner
          </button>
        </div>
      )}

      {aliases.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-2">
          {aliases.map((a) => (
            <li key={a.id} className={cn("flex flex-wrap items-center gap-2 text-xs", a.hidden && "opacity-60")}>
              <button
                type="button"
                className={cn("icon-btn h-7 w-7 shrink-0", a.hidden ? "text-text-3" : "text-accent")}
                aria-label={a.hidden ? "Afficher ce titre dans le planning" : "Masquer ce titre du planning"}
                title={a.hidden ? "Masqué : cliquer pour réafficher" : "Affiché : cliquer pour masquer (ex. TD d'un autre groupe)"}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await setAliasHiddenAction(a.id, !a.hidden);
                    if (!r.ok) return setError(r.error);
                    router.refresh();
                  })
                }
              >
                {a.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <span className={cn("min-w-0 flex-1 truncate", a.hidden ? "text-text-3 line-through" : "text-text-2")} title={a.alias}>
                {a.alias}
              </span>
              <select
                className="field w-auto py-1 text-xs"
                value={a.subject_id}
                disabled={pending}
                aria-label={`Matière pour ${a.alias}`}
                onChange={(e) =>
                  start(async () => {
                    await reassignAliasAction(a.id, e.target.value);
                    router.refresh();
                  })
                }
              >
                {allSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </li>
  );
}
